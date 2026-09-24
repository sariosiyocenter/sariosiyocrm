import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Trash2, LayoutGrid, Shuffle, Search, CheckCircle2, XCircle, AlertTriangle, DoorOpen } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Yorliq, Maydon, INPUT, SELECT, Tanlov, Yuklanmoqda, BoshHolat } from './ui';
import XonaSxemasi from './XonaSxemasi';
import { xonaOrinlari } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from '../ExamDetail';
import type { Room } from '../../types';

// 2-bo'lim: kim qatnashadi (kurslar + tashqi qatnashchilar), qaysi xonalarda,
// o'rinlashtirish va eshikdagi keldi/kelmadi belgisi.

export interface Orin {
  id: number; studentId: number | null; name: string; photo: string | null; phone: string | null; mehmon: boolean;
  schoolId: number; groupId: number | null; groupName: string; session: number; roomId: number | null; roomName: string;
  row: number | null; col: number | null; variant: string | null; sheetCode: string; status: 'rejada' | 'keldi' | 'kelmadi';
  resultId: number | null; reviewStatus: string | null; score: number | null;
}

export function useOrinlar(examId: number) {
  const { soro } = useImtihonApi();
  const [data, setData] = useState<{ seats: Orin[]; rooms: Room[] } | null>(null);
  const yukla = useCallback(() => soro<{ seats: Orin[]; rooms: Room[] }>('GET', `exams/${examId}/seats`).then(setData), [examId, soro]);
  useEffect(() => { yukla().catch(() => setData({ seats: [], rooms: [] })); }, [yukla]);
  return { data, yukla };
}

interface Qatnashchilar {
  filiallar: number[];
  kurslar: { id: number; name: string; schoolId: number; soni: number }[];
  oquvchilar: number;
  mehmonlar: number;
  xonalar: Room[];
}

export default function QatnashchilarTab({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => Promise<any> }) {
  const { groups, schools, ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.imtihon');
  const belgilaydi = tahrir || ozgartira('imtihonlar.natija');
  const xonaTahrir = ozgartira('sozlamalar.xonalar');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const { data, yukla } = useOrinlar(exam.id);
  const [q, setQ] = useState<Qatnashchilar | null>(null);
  const [mehmon, setMehmon] = useState({ name: '', phone: '', schoolId: exam.schoolId });
  const [band, setBand] = useState<string | null>(null);
  const [sxema, setSxema] = useState<Room | null>(null);
  const [natija, setNatija] = useState<{ joylashdi: number; sigmadi: string[]; olibTashlandi: number } | null>(null);
  const [smena, setSmena] = useState(1);
  const [xonaId, setXonaId] = useState<number | 'royxat'>('royxat');
  const [qidiruv, setQidiruv] = useState('');

  const filiallar = useMemo(() => [...new Set([exam.schoolId, ...(exam.branchIds || [])])], [exam]);
  const filialNomi = (id: number) => schools.find(s => s.id === id)?.name || '';
  const s = exam.settings;

  const qatnashchilarniYukla = useCallback(() => soro<Qatnashchilar>('GET', `exams/${exam.id}/participants`).then(setQ).catch(e => showNotification(e.message, 'error')), [exam.id, soro, showNotification]);
  useEffect(() => { qatnashchilarniYukla(); }, [qatnashchilarniYukla]);

  const biriktirilgan = new Set(exam.assignments.map(a => a.groupId));
  const kurslar = groups.filter(g => filiallar.includes(g.schoolId));

  const kursniAlmashtir = async (gid: number) => {
    setBand(`kurs-${gid}`);
    try {
      if (biriktirilgan.has(gid)) await soro('DELETE', `exams/${exam.id}/assignments/${gid}`);
      else await soro('POST', `exams/${exam.id}/assignments`, { groupIds: [gid] });
      await Promise.all([yangila(), qatnashchilarniYukla()]);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const hammaKurs = async (belgi: boolean) => {
    setBand('kurslar');
    try {
      if (belgi) await soro('POST', `exams/${exam.id}/assignments`, { groupIds: kurslar.map(k => k.id) });
      else for (const k of kurslar.filter(k => biriktirilgan.has(k.id))) await soro('DELETE', `exams/${exam.id}/assignments/${k.id}`);
      await Promise.all([yangila(), qatnashchilarniYukla()]);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const mehmonQosh = async () => {
    if (!mehmon.name.trim()) return showNotification('Ismini kiriting', 'error');
    setBand('mehmon');
    try {
      await soro('POST', `exams/${exam.id}/guests`, mehmon);
      setMehmon({ name: '', phone: '', schoolId: mehmon.schoolId });
      await Promise.all([yukla(), qatnashchilarniYukla()]);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const orinOchir = async (o: Orin) => {
    if (!(await confirm(`${o.name} ro'yxatdan olib tashlansinmi?`))) return;
    try {
      await soro('DELETE', `exams/${exam.id}/seats/${o.id}`);
      await Promise.all([yukla(), qatnashchilarniYukla(), yangila()]);
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const xonaniAlmashtir = async (rid: number) => {
    const hozir = s.roomIds.length ? s.roomIds : (q?.xonalar || []).map(x => x.id);
    const yangi = hozir.includes(rid) ? hozir.filter(x => x !== rid) : [...hozir, rid];
    try {
      await soro('PUT', `exams/${exam.id}`, { settings: { roomIds: yangi } });
      await yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const orinlashtir = async () => {
    if (data?.seats.some(x => x.roomId) && !(await confirm("O'rinlar qaytadan taqsimlanadi. Chop etilgan varaq va ro'yxatlar eskiradi (varaq kodlari o'zgarmaydi). Davom etilsinmi?"))) return;
    setBand('orin');
    try {
      const r = await soro<{ joylashdi: number; sigmadi: string[]; olibTashlandi: number }>('POST', `exams/${exam.id}/seating`);
      setNatija(r);
      showNotification(`${r.joylashdi} kishi o'rinlashtirildi`, 'success');
      await Promise.all([yukla(), yangila()]);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const belgila = async (o: Orin, status: Orin['status']) => {
    try {
      await soro('PUT', `exams/${exam.id}/seats/${o.id}`, { status: o.status === status ? 'rejada' : status });
      await yukla();
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // Sig'im: har filial xonalari × smenalar.
  const ishlatilganXonalar = (q?.xonalar || []).filter(x => !s.roomIds.length || s.roomIds.includes(x.id));
  const sigim = ishlatilganXonalar.reduce((a, x) => a + xonaOrinlari(x, s.seatMode).length, 0) * s.sessions.length;
  const jami = (q?.oquvchilar || 0) + (q?.mehmonlar || 0);
  const mehmonlar = (data?.seats || []).filter(x => x.mehmon);
  const seats = data?.seats || [];
  const smenaOrinlari = seats.filter(x => x.session === smena && x.roomId);
  const xonalarBuSmenada = [...new Map(smenaOrinlari.map(x => [x.roomId, x.roomName])).entries()];
  const joylashmagan = seats.filter(x => !x.roomId);
  const royxat = seats.filter(x => !qidiruv || x.name.toLowerCase().includes(qidiruv.toLowerCase()) || x.sheetCode.includes(qidiruv.toUpperCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Karta sarlavha="Kurslar" izoh={`Faol va sinovdagi o'quvchilar; "Imtihonga kelmaydi" belgilanganlar kirmaydi`} className="lg:col-span-2"
          amallar={tahrir && kurslar.length > 1 && (
            <>
              <Tugma kichik turi="oddiy" yuklanmoqda={band === 'kurslar'} onClick={() => hammaKurs(true)}>Hammasi</Tugma>
              {biriktirilgan.size > 0 && <Tugma kichik turi="oddiy" onClick={() => hammaKurs(false)}>Tozalash</Tugma>}
            </>
          )}>
          {!kurslar.length ? <p className="text-[12.5px] text-matn-xira">Bu filiallarda kurs yo'q</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
              {kurslar.map(g => {
                const bel = biriktirilgan.has(g.id);
                const soni = q?.kurslar.find(k => k.id === g.id)?.soni;
                return (
                  <button key={g.id} disabled={!tahrir || band === `kurs-${g.id}`} onClick={() => kursniAlmashtir(g.id)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] cursor-pointer disabled:cursor-default ${bel ? 'bg-brand-fon border-brand/30 dark:bg-brand/15' : 'bg-ichki border-chiziq hover:border-chiziq-kuchli'}`}>
                    <span className="min-w-0">
                      <span className={`block truncate font-semibold ${bel ? 'text-brand-dark dark:text-brand-accent' : 'text-matn'}`}>{g.name}</span>
                      {filiallar.length > 1 && <span className="block text-[11px] text-matn-xira">{filialNomi(g.schoolId)}</span>}
                    </span>
                    <span className="text-[11.5px] text-matn-sokin raqam shrink-0">{bel && soni != null ? `${soni} ta` : `${g.studentIds.length}`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Karta>

        <Karta sarlavha="Hisob">
          {!q ? <Yuklanmoqda /> : (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-matn-sokin">Kurslardan</span><b className="raqam">{q.oquvchilar}</b></div>
              <div className="flex justify-between"><span className="text-matn-sokin">Tashqi qatnashchilar</span><b className="raqam">{q.mehmonlar}</b></div>
              <div className="flex justify-between border-t border-chiziq pt-2"><span className="text-matn">Jami qatnashchi</span><b className="raqam">{jami}</b></div>
              <div className="flex justify-between"><span className="text-matn-sokin">O'rinlar ({s.sessions.length} smena)</span><b className={`raqam ${sigim < jami ? 'text-xato' : 'text-yaxshi'}`}>{sigim}</b></div>
              {sigim < jami && <p className="text-[12px] text-xato flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> O'rin yetmaydi: smena qo'shing, xona sxemasini tekshiring yoki shaxmat tartibini o'chiring.</p>}
              {tahrir && <Tugma turi="asosiy" className="w-full mt-2" ikonka={<Shuffle size={14} />} yuklanmoqda={band === 'orin'} disabled={!jami} onClick={orinlashtir}>{seats.some(x => x.roomId) ? "Qayta o'rinlashtirish" : "O'rinlashtirish"}</Tugma>}
              {!exam.lockedAt && <p className="text-[11.5px] text-matn-xira">Variant harflari savollar qulflangach aniq bo'ladi (o'rin shu tartibda qoladi).</p>}
            </div>
          )}
        </Karta>
      </div>

      {natija && (natija.sigmadi.length > 0 || natija.olibTashlandi > 0) && (
        <Karta className="border-ogoh/40">
          <p className="text-[13px] text-matn"><b>{natija.joylashdi}</b> kishi o'rinlashdi.
            {natija.olibTashlandi > 0 && <> {natija.olibTashlandi} kishi kursdan chiqqani uchun ro'yxatdan olindi.</>}
            {natija.sigmadi.length > 0 && <span className="text-xato"> {natija.sigmadi.length} kishiga o'rin yetmadi: {natija.sigmadi.slice(0, 12).join(', ')}{natija.sigmadi.length > 12 ? '…' : ''}</span>}
          </p>
        </Karta>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Karta sarlavha="Xonalar" izoh="Imtihonda ishlatiladiganlarini belgilang" className="lg:col-span-2">
          {!q ? <Yuklanmoqda /> : !q.xonalar.length ? <p className="text-[12.5px] text-matn-xira">Xona yo'q — Sozlamalar → Xonalar</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.xonalar.map(x => {
                const bel = !s.roomIds.length || s.roomIds.includes(x.id);
                const orinlar = xonaOrinlari(x, s.seatMode).length;
                return (
                  <div key={x.id} className={`rounded-xl border px-3 py-2.5 ${bel ? 'border-chiziq bg-sirt' : 'border-dashed border-chiziq bg-ichki opacity-70'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button disabled={!tahrir} onClick={() => xonaniAlmashtir(x.id)} className="flex items-center gap-2 text-left cursor-pointer disabled:cursor-default">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center ${bel ? 'bg-brand border-brand text-white' : 'border-chiziq-kuchli'}`}>{bel && <CheckCircle2 size={11} />}</span>
                        <span className="text-[13px] font-semibold text-matn">{x.name}</span>
                        {filiallar.length > 1 && <span className="text-[11px] text-matn-xira">{filialNomi(x.schoolId)}</span>}
                      </button>
                      {xonaTahrir && <Tugma kichik turi="oddiy" ikonka={<LayoutGrid size={13} />} onClick={() => setSxema(x)}>Sxema</Tugma>}
                    </div>
                    <p className="text-[12px] text-matn-sokin mt-1 pl-6">
                      {x.rows && x.cols ? `${x.rows} qator × ${x.cols} o'rin` : `sxema yo'q — sig'imdan (${x.capacity}), 6 tadan qator`} · <b className="text-matn">{orinlar}</b> ta o'rin
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Karta>

        <Karta sarlavha="Tashqi qatnashchilar" izoh="Markazda o'qimaydigan abituriyentlar (ochiq sinov)">
          {tahrir && (
            <div className="space-y-2 mb-3">
              <input className={INPUT} placeholder="Familiya va ism" value={mehmon.name} onChange={e => setMehmon({ ...mehmon, name: e.target.value })} />
              <div className="flex gap-2">
                <input className={INPUT} placeholder="Telefon (natija SMS)" value={mehmon.phone} onChange={e => setMehmon({ ...mehmon, phone: e.target.value })} inputMode="tel" />
                {filiallar.length > 1 && (
                  <select className={`${SELECT} w-36`} value={mehmon.schoolId} onChange={e => setMehmon({ ...mehmon, schoolId: Number(e.target.value) })}>
                    {filiallar.map(f => <option key={f} value={f}>{filialNomi(f)}</option>)}
                  </select>
                )}
              </div>
              <Tugma className="w-full" ikonka={<UserPlus size={14} />} yuklanmoqda={band === 'mehmon'} onClick={mehmonQosh}>Qo'shish</Tugma>
            </div>
          )}
          {mehmonlar.length ? (
            <ul className="divide-y divide-chiziq max-h-64 overflow-y-auto">
              {mehmonlar.map(m => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                  <span className="min-w-0"><span className="block truncate text-matn">{m.name}</span><span className="text-matn-xira">{m.phone || "telefon yo'q"}</span></span>
                  {tahrir && !m.resultId && <button aria-label="Olib tashlash" onClick={() => orinOchir(m)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          ) : <p className="text-[12px] text-matn-xira">Hozircha yo'q</p>}
        </Karta>
      </div>

      <Karta sarlavha="O'rinlar" izoh={seats.length ? `${seats.length} qatnashchi · ${seats.filter(x => x.status === 'keldi').length} keldi · ${seats.filter(x => x.status === 'kelmadi').length} kelmadi` : undefined}
        amallar={seats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {s.sessions.length > 1 && <Tanlov kichik qiymat={smena} onChange={v => { setSmena(v); setXonaId('royxat'); }} variantlar={s.sessions.map(x => ({ v: x.id, nom: x.name }))} />}
            <select className={`${SELECT} py-1.5 w-44`} value={xonaId} onChange={e => setXonaId(e.target.value === 'royxat' ? 'royxat' : Number(e.target.value))}>
              <option value="royxat">Ro'yxat</option>
              {xonalarBuSmenada.map(([id, nom]) => <option key={id!} value={id!}>{nom} — xarita</option>)}
            </select>
          </div>
        )}>
        {!data ? <Yuklanmoqda /> : !seats.length ? (
          <BoshHolat ikonka={<Users size={20} />} sarlavha="Hali o'rinlashtirilmagan" izoh="Kurslarni tanlang va «O'rinlashtirish»ni bosing." />
        ) : xonaId !== 'royxat' ? (
          <XonaXaritasi orinlar={smenaOrinlari.filter(x => x.roomId === xonaId)} xona={data.rooms.find(r => r.id === xonaId)} />
        ) : (
          <div className="space-y-3">
            <div className="relative max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
              <input className={`${INPUT} pl-9`} placeholder="Ism yoki varaq kodi" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
            </div>
            {joylashmagan.length > 0 && <p className="text-[12.5px] text-xato flex items-center gap-1.5"><AlertTriangle size={14} /> {joylashmagan.length} kishiga o'rin berilmagan</p>}
            <div className="overflow-x-auto rounded-xl border border-chiziq">
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead className="bg-ichki text-matn-sokin">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Qatnashchi</th>
                    <th className="px-3 py-2 text-left font-semibold">Kurs</th>
                    <th className="px-3 py-2 text-left font-semibold">Joyi</th>
                    <th className="px-3 py-2 text-center font-semibold">Variant</th>
                    <th className="px-3 py-2 text-left font-semibold">Varaq kodi</th>
                    <th className="px-3 py-2 text-center font-semibold">Keldi</th>
                    {tahrir && <th className="px-2 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-chiziq">
                  {royxat.slice(0, 400).map(o => (
                    <tr key={o.id} className="hover:bg-ichki/50">
                      <td className="px-3 py-2">
                        <span className="text-matn font-medium">{o.name}</span>
                        {o.mehmon && <Yorliq className="ml-1.5">tashqi</Yorliq>}
                        {o.resultId && <Yorliq rang={o.reviewStatus === 'shubhali' ? 'ogoh' : 'yaxshi'} className="ml-1.5">{o.score} ball</Yorliq>}
                      </td>
                      <td className="px-3 py-2 text-matn-sokin">{o.groupName || '—'}</td>
                      <td className="px-3 py-2 text-matn-sokin">{o.roomId ? `${s.sessions.length > 1 ? `${o.session}-sm · ` : ''}${o.roomName} · ${(o.row ?? 0) + 1}-qator · ${(o.col ?? 0) + 1}-o'rin` : <span className="text-xato">o'rin yo'q</span>}</td>
                      <td className="px-3 py-2 text-center font-bold text-matn">{exam.lockedAt ? o.variant || '—' : '·'}</td>
                      <td className="px-3 py-2 font-mono text-matn-sokin">{o.sheetCode}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button disabled={!belgilaydi} onClick={() => belgila(o, 'keldi')} aria-label="Keldi" className={`p-1 rounded-md cursor-pointer disabled:cursor-default ${o.status === 'keldi' ? 'text-yaxshi' : 'text-matn-xira hover:text-yaxshi'}`}><CheckCircle2 size={17} /></button>
                          <button disabled={!belgilaydi} onClick={() => belgila(o, 'kelmadi')} aria-label="Kelmadi" className={`p-1 rounded-md cursor-pointer disabled:cursor-default ${o.status === 'kelmadi' ? 'text-xato' : 'text-matn-xira hover:text-xato'}`}><XCircle size={17} /></button>
                        </div>
                      </td>
                      {tahrir && <td className="px-2 py-2">{!o.resultId && <button aria-label="Ro'yxatdan olish" onClick={() => orinOchir(o)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {royxat.length > 400 && <p className="text-[12px] text-matn-xira">Birinchi 400 tasi ko'rsatildi — qidiruvdan foydalaning.</p>}
          </div>
        )}
      </Karta>
      {sxema && <XonaSxemasi xona={sxema} onYop={saqlandi => { setSxema(null); if (saqlandi) qatnashchilarniYukla(); }} />}
    </div>
  );
}

/** Xona xaritasi: har o'rinda ism va variant (eshikka ilish uchun ham shu ko'rinish). */
export function XonaXaritasi({ orinlar, xona }: { orinlar: Orin[]; xona?: Room }) {
  const rows = Math.max(xona?.rows || 0, ...orinlar.map(o => (o.row ?? 0) + 1), 1);
  const cols = Math.max(xona?.cols || 0, ...orinlar.map(o => (o.col ?? 0) + 1), 1);
  const joy = new Map(orinlar.map(o => [`${o.row}-${o.col}`, o]));
  return (
    <div className="overflow-auto rounded-xl border border-chiziq bg-ichki p-3">
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-matn-xira mb-2"><DoorOpen size={13} /> Doska</div>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(92px, 1fr))` }}>
        {Array.from({ length: rows }, (_, r) => (
          <React.Fragment key={r}>
            <span className="text-[10px] text-matn-xira pr-1 self-center raqam">{r + 1}</span>
            {Array.from({ length: cols }, (_, c) => {
              const o = joy.get(`${r}-${c}`);
              return o ? (
                <div key={c} className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${o.status === 'kelmadi' ? 'border-xato-chiziq bg-xato-fon' : o.status === 'keldi' ? 'border-yaxshi/30 bg-yaxshi-fon' : 'border-chiziq bg-sirt'}`}>
                  <div className="flex items-center justify-between gap-1"><b className="text-brand">{o.variant || '·'}</b><span className="text-matn-xira">{c + 1}</span></div>
                  <div className="text-matn truncate" title={o.name}>{o.name}</div>
                </div>
              ) : <div key={c} className="rounded-lg border border-dashed border-chiziq min-h-10" />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
