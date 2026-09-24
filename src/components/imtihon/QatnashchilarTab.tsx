import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, UserPlus, Trash2, LayoutGrid, Shuffle, Search, CheckCircle2, XCircle, AlertTriangle, DoorOpen, ArrowLeftRight, X, Send, Square } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Yorliq, Maydon, INPUT, SELECT, Tanlov, Yuklanmoqda, BoshHolat } from './ui';
import XonaSxemasi from './XonaSxemasi';
import { xonaOrinlari } from '../../../lib/imtihon.js';
import { toDateStr } from '../../../lib/lessons.js';
import type { ImtihonTafsil } from '../ExamDetail';
import type { Room } from '../../types';

// 2-bo'lim: kim qatnashadi (kurslar + tashqi qatnashchilar), qaysi xonalarda,
// o'rinlashtirish va eshikdagi keldi/kelmadi belgisi.

export interface Orin {
  id: number; studentId: number | null; name: string; photo: string | null; phone: string | null; mehmon: boolean;
  schoolId: number; groupId: number | null; groupName: string; session: number; roomId: number | null; roomName: string;
  row: number | null; col: number | null; variant: string | null; sheetCode: string; status: 'rejada' | 'keldi' | 'kelmadi';
  resultId: number | null; reviewStatus: string | null; score: number | null;
  admitSentAt: string | null; admitStatus: 'yuborildi' | 'yuborilmoqda' | 'xato' | 'aloqa yoq' | 'yangilanadi' | null;
  leadId: number | null;
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
  const lidQiladi = ozgartira('lidlar.royxat');
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
  // Ko'chirish: xaritada tanlangan qatnashchi va boshqa xonaga ko'chirish oynasi.
  const [tanlangan, setTanlangan] = useState<Orin | null>(null);
  const [kochiriladi, setKochiriladi] = useState<Orin | null>(null);
  const [ruxsatnoma, setRuxsatnoma] = useState<{ yuborildi: number; xato: number; qoldi: number } | null>(null);
  const toxtaRef = useRef(false);

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

  // Tashqi qatnashchilar → lidlar (telefoni borlari; oldin bor lidga izoh qo'shiladi).
  const lidlargaQosh = async () => {
    const soni = lidBolmagan;
    if (!(await confirm(`${soni} ta tashqi qatnashchi «Lidlar» bo'limiga qo'shiladi (manba: Imtihon${exam.publishedAt ? ', izohda natijasi' : ''}). Davom etilsinmi?`))) return;
    setBand('lid');
    try {
      const r = await soro<{ yaratildi: number; bor: number; telefonsiz: number }>('POST', `exams/${exam.id}/guests/leads`, {});
      showNotification([`${r.yaratildi} ta yangi lid`, r.bor ? `${r.bor} tasi oldin bor edi (izoh qo'shildi)` : '', r.telefonsiz ? `${r.telefonsiz} tasida telefon yo'q` : ''].filter(Boolean).join(', '), 'success');
      await yukla();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
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

  // Band o'ringa ko'chirilsa — tasdiqdan keyin joy almashadi. Variant o'ringa
  // bog'liq, shuning uchun chop etilgan varaq eskiradi.
  const kochir = async (o: Orin, joy: { session: number; roomId: number; row: number; col: number }, b?: Orin) => {
    if (b && b.id === o.id) return false;
    if (b) {
      if (b.resultId) { showNotification(`${b.name}ning natijasi bor — uni ko'chirib bo'lmaydi`, 'error'); return false; }
      if (!(await confirm(`${o.name} va ${b.name} o'rinlari almashtirilsinmi?`))) return false;
    }
    try {
      const r = await soro<{ variant: string | null }>('PUT', `exams/${exam.id}/seats/${o.id}`, { ...joy, almashtir: !!b });
      await yukla();
      showNotification(exam.lockedAt
        ? `O'rin o'zgardi${r.variant ? ` (variant ${r.variant})` : ''}. ${b ? 'Ikkalasining' : 'Uning'} javob varag'ini qayta chop eting: Chop etish → Javob varaqalari → bitta qatnashchi.`
        : "O'rin o'zgardi", 'success');
      return true;
    } catch (e: any) {
      showNotification(e.message, 'error');
      return false;
    }
  };

  const xaritadaBos = async (joy: { row: number; col: number }, o?: Orin) => {
    if (!tanlangan) {
      if (!o) return;
      if (o.resultId) return showNotification("Natijasi bor qatnashchini ko'chirib bo'lmaydi", 'error');
      setTanlangan(o);
      return;
    }
    if (o && o.id === tanlangan.id) return setTanlangan(null);
    if (typeof xonaId !== 'number') return;
    if (await kochir(tanlangan, { session: smena, roomId: xonaId, ...joy }, o)) setTanlangan(null);
  };

  // Ruxsatnoma: bo'lib-bo'lib yuboriladi (bir so'rovda 10 ta), to'xtatsa bo'ladi.
  const ruxsatnomaYubor = async (qayta: boolean) => {
    const kanal = { BOTH: "Telegram, bo'lmasa SMS", TELEGRAM: 'Telegram', SMS: 'SMS', NONE: '' }[s.admit.channel];
    const savol = qayta
      ? `Ruxsatnoma hamma ${seats.filter(x => x.roomId).length} qatnashchiga qaytadan yuboriladi (${kanal}). Davom etilsinmi?`
      : `${kutmoqda} ta qatnashchiga ruxsatnoma yuboriladi (${kanal}).${s.admit.channel !== 'TELEGRAM' ? ' SMS pullik.' : ''} Davom etilsinmi?`;
    if (!(await confirm(savol))) return;
    toxtaRef.current = false;
    setBand('ruxsatnoma');
    let jami = { yuborildi: 0, xato: 0, qoldi: kutmoqda };
    setRuxsatnoma(jami);
    try {
      let birinchi = true;
      while (!toxtaRef.current) {
        const r = await soro<{ yuborildi: number; xato: number; qoldi: number }>('POST', `exams/${exam.id}/admit-cards`, { limit: 10, ...(birinchi && qayta ? { qayta: true } : {}) });
        birinchi = false;
        jami = { yuborildi: jami.yuborildi + r.yuborildi, xato: jami.xato + r.xato, qoldi: r.qoldi };
        setRuxsatnoma({ ...jami });
        if (!r.qoldi || (!r.yuborildi && !r.xato)) break;
      }
      showNotification(`Ruxsatnoma: ${jami.yuborildi} ta yuborildi${jami.xato ? `, ${jami.xato} tasiga yetmadi` : ''}`, jami.xato ? 'info' : 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
      yukla();
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
  const kutmoqda = seats.filter(x => x.roomId && !x.admitSentAt).length;
  const ruxsatnomaOldi = seats.filter(x => x.admitSentAt && x.admitStatus === 'yuborildi').length;
  // Ruxsatnoma imtihongacha kerak: e'lon qilingan yoki o'tib ketgan imtihonda ko'rsatilmaydi.
  const ruxsatnomaVaqti = !exam.publishedAt && exam.date >= toDateStr();
  const lidBolmagan = seats.filter(x => x.mehmon && !x.leadId && x.phone).length;
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
          {tahrir && ruxsatnomaVaqti && seats.some(x => x.roomId) && s.admit.channel !== 'NONE' && (
            <div className="mt-4 pt-3 border-t border-chiziq space-y-2">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-matn">Ruxsatnoma</span>
                <span className="text-matn-sokin raqam">{ruxsatnomaOldi} ta oldi{kutmoqda ? ` · ${kutmoqda} ta kutmoqda` : ''}</span>
              </div>
              {band === 'ruxsatnoma' && ruxsatnoma ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-matn-sokin">{ruxsatnoma.yuborildi} ta yuborildi{ruxsatnoma.xato ? `, ${ruxsatnoma.xato} ta yetmadi` : ''} · {ruxsatnoma.qoldi} ta qoldi</span>
                  <Tugma kichik turi="oddiy" ikonka={<Square size={12} />} onClick={() => { toxtaRef.current = true; }}>To'xtatish</Tugma>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {kutmoqda > 0 && <Tugma kichik ikonka={<Send size={13} />} onClick={() => ruxsatnomaYubor(false)}>{kutmoqda} ta yuborish</Tugma>}
                  {ruxsatnomaOldi > 0 && <Tugma kichik turi="oddiy" onClick={() => ruxsatnomaYubor(true)}>Hammaga qaytadan</Tugma>}
                </div>
              )}
              <p className="text-[11.5px] text-matn-xira">{s.admit.auto ? "Imtihondan bir kun oldin, soat 12:00 dan o'zi ham yuboriladi. O'rni o'zgarganga yangisi ketadi." : "Avtomatik yuborish o'chiq (imtihon sozlamasi)."}</p>
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
                        <span className={`w-4 h-4 rounded border flex items-center justify-center ${bel ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq-kuchli'}`}>{bel && <CheckCircle2 size={11} />}</span>
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
                  <span className="min-w-0">
                    <span className="block truncate text-matn">{m.name}{m.leadId && <Yorliq rang="brand" className="ml-1.5">lid</Yorliq>}</span>
                    <span className="text-matn-xira">{m.phone || "telefon yo'q"}</span>
                  </span>
                  {tahrir && !m.resultId && <button aria-label="Olib tashlash" onClick={() => orinOchir(m)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          ) : <p className="text-[12px] text-matn-xira">Hozircha yo'q</p>}
          {lidQiladi && lidBolmagan > 0 && (
            <Tugma kichik className="w-full mt-3" yuklanmoqda={band === 'lid'} onClick={lidlargaQosh}>
              {lidBolmagan} tasini lidlarga qo'shish
            </Tugma>
          )}
        </Karta>
      </div>

      <Karta sarlavha="O'rinlar" izoh={seats.length ? `${seats.length} qatnashchi · ${seats.filter(x => x.status === 'keldi').length} keldi · ${seats.filter(x => x.status === 'kelmadi').length} kelmadi` : undefined}
        amallar={seats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {s.sessions.length > 1 && <Tanlov kichik qiymat={smena} onChange={v => { setSmena(v); setXonaId('royxat'); setTanlangan(null); }} variantlar={s.sessions.map(x => ({ v: x.id, nom: x.name }))} />}
            <select className={`${SELECT} py-1.5 w-44`} value={xonaId} onChange={e => { setXonaId(e.target.value === 'royxat' ? 'royxat' : Number(e.target.value)); setTanlangan(null); }}>
              <option value="royxat">Ro'yxat</option>
              {xonalarBuSmenada.map(([id, nom]) => <option key={id!} value={id!}>{nom} — xarita</option>)}
            </select>
          </div>
        )}>
        {!data ? <Yuklanmoqda /> : !seats.length ? (
          <BoshHolat ikonka={<Users size={20} />} sarlavha="Hali o'rinlashtirilmagan" izoh="Kurslarni tanlang va «O'rinlashtirish»ni bosing." />
        ) : xonaId !== 'royxat' ? (
          <div className="space-y-2">
            {tahrir && (
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[12.5px] ${tanlangan ? 'border-brand/40 bg-brand-fon dark:bg-brand/15' : 'border-chiziq bg-ichki'}`}>
                <span className="text-matn-sokin">
                  {tanlangan
                    ? <><b className="text-matn">{tanlangan.name}</b> tanlandi — bo'sh o'ringa bosing (ko'chadi) yoki boshqa qatnashchiga (joy almashadi).</>
                    : "Ko'chirish uchun qatnashchini bosing."}
                </span>
                {tanlangan && (
                  <span className="flex gap-2">
                    <Tugma kichik ikonka={<ArrowLeftRight size={13} />} onClick={() => { setKochiriladi(tanlangan); setTanlangan(null); }}>Boshqa xonaga</Tugma>
                    <Tugma kichik turi="oddiy" onClick={() => setTanlangan(null)}>Bekor</Tugma>
                  </span>
                )}
              </div>
            )}
            <XonaXaritasi orinlar={smenaOrinlari.filter(x => x.roomId === xonaId)} xona={(q?.xonalar || []).find(r => r.id === xonaId) || data.rooms.find(r => r.id === xonaId)}
              tanlanganId={tanlangan?.id ?? null} onBos={tahrir ? xaritadaBos : undefined} />
          </div>
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
                        {o.admitStatus === 'yuborildi' && <Yorliq rang="brand" className="ml-1.5">ruxsatnoma</Yorliq>}
                        {(o.admitStatus === 'xato' || o.admitStatus === 'aloqa yoq') && <Yorliq rang="xato" className="ml-1.5">{o.admitStatus === 'aloqa yoq' ? "ruxsatnoma: aloqa yo'q" : 'ruxsatnoma yetmadi'}</Yorliq>}
                        {o.admitStatus === 'yangilanadi' && <Yorliq rang="ogoh" className="ml-1.5">ruxsatnoma yangilanadi</Yorliq>}
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
                      {tahrir && (
                        <td className="px-2 py-2">
                          {!o.resultId && (
                            <div className="flex items-center justify-end gap-0.5">
                              <button aria-label="O'rnini o'zgartirish" title="O'rnini o'zgartirish" onClick={() => setKochiriladi(o)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand cursor-pointer"><ArrowLeftRight size={14} /></button>
                              <button aria-label="Ro'yxatdan olish" title="Ro'yxatdan olish" onClick={() => orinOchir(o)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </td>
                      )}
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
      {kochiriladi && (
        <OrinOynasi o={kochiriladi} smenalar={s.sessions} orinlar={seats} onKochir={kochir} onYop={() => setKochiriladi(null)}
          xonalar={(q?.xonalar || []).filter(x => !s.roomIds.length || s.roomIds.includes(x.id) || x.id === kochiriladi.roomId)} />
      )}
    </div>
  );
}

type Joy = { row: number; col: number };

/**
 * Xona xaritasi: har o'rinda ism va variant (eshikka ilish uchun ham shu
 * ko'rinish). `onBos` berilsa — o'rinlar bosiladi (ko'chirish uchun):
 * yopilgan o'rin (ustun, singan parta) bosilmaydi.
 */
export function XonaXaritasi({ orinlar, xona, tanlanganId, onBos }: {
  orinlar: Orin[]; xona?: Room; tanlanganId?: number | null; onBos?: (joy: Joy, o?: Orin) => void;
}) {
  const ishlaydi = useMemo(() => new Set(xona ? xonaOrinlari(xona, 'hammasi').map(j => `${j.row}-${j.col}`) : []), [xona]);
  const rows = Math.max(xona?.rows || 0, ...[...ishlaydi].map(k => Number(k.split('-')[0]) + 1), ...orinlar.map(o => (o.row ?? 0) + 1), 1);
  const cols = Math.max(xona?.cols || 0, ...[...ishlaydi].map(k => Number(k.split('-')[1]) + 1), ...orinlar.map(o => (o.col ?? 0) + 1), 1);
  const joy = new Map(orinlar.map(o => [`${o.row}-${o.col}`, o]));
  const tanlashRejimi = !!onBos && tanlanganId != null;
  return (
    <div className="overflow-auto rounded-xl border border-chiziq bg-ichki p-3">
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-matn-xira mb-2"><DoorOpen size={13} /> Doska</div>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(92px, 1fr))` }}>
        {Array.from({ length: rows }, (_, r) => (
          <React.Fragment key={r}>
            <span className="text-[10px] text-matn-xira pr-1 self-center raqam">{r + 1}</span>
            {Array.from({ length: cols }, (_, c) => {
              const k = `${r}-${c}`;
              const o = joy.get(k);
              const nom = `${r + 1}-qator, ${c + 1}-o'rin`;
              if (o) {
                const tanlangan = o.id === tanlanganId;
                const rang = tanlangan ? 'border-brand bg-brand-fon ring-2 ring-brand/40 dark:bg-brand/20'
                  : o.status === 'kelmadi' ? 'border-xato-chiziq bg-xato-fon' : o.status === 'keldi' ? 'border-yaxshi/30 bg-yaxshi-fon' : 'border-chiziq bg-sirt';
                const ichi = (
                  <>
                    <div className="flex items-center justify-between gap-1"><b className="text-brand">{o.variant || '·'}</b><span className="text-matn-xira">{o.resultId ? <CheckCircle2 size={11} className="inline text-yaxshi" /> : c + 1}</span></div>
                    <div className="text-matn truncate" title={o.name}>{o.name}</div>
                  </>
                );
                return onBos ? (
                  <button key={c} type="button" onClick={() => onBos({ row: r, col: c }, o)} aria-label={`${o.name}, ${nom}`} aria-pressed={tanlangan}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight text-left cursor-pointer transition-colors ${rang} ${tanlashRejimi && !tanlangan ? 'hover:border-brand' : ''}`}>
                    {ichi}
                  </button>
                ) : <div key={c} className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${rang}`}>{ichi}</div>;
              }
              if (xona && !ishlaydi.has(k)) return <div key={c} title="Ishlatilmaydi" className="rounded-lg min-h-10 flex items-center justify-center text-[11px] text-matn-xira/60">×</div>;
              return tanlashRejimi ? (
                <button key={c} type="button" onClick={() => onBos!({ row: r, col: c })} aria-label={`Bo'sh o'rin: ${nom}`}
                  className="rounded-lg border border-dashed border-brand/40 min-h-10 text-[10.5px] text-brand/70 hover:bg-brand-fon hover:border-brand cursor-pointer dark:hover:bg-brand/15">
                  shu yerga
                </button>
              ) : <div key={c} className="rounded-lg border border-dashed border-chiziq min-h-10" />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Bitta qatnashchining o'rnini o'zgartirish (boshqa xona yoki smenaga ham):
 * bo'sh o'ringa bossangiz ko'chadi, band o'ringa — joy almashadi.
 */
function OrinOynasi({ o, smenalar, xonalar, orinlar, onKochir, onYop }: {
  o: Orin; smenalar: { id: number; name: string }[]; xonalar: Room[]; orinlar: Orin[];
  onKochir: (o: Orin, joy: { session: number; roomId: number } & Joy, band?: Orin) => Promise<boolean>; onYop: () => void;
}) {
  const [smena, setSmena] = useState(o.session);
  const [xonaId, setXonaId] = useState<number>(o.roomId ?? xonalar[0]?.id ?? 0);
  const [band, setBand] = useState(false);
  const xona = xonalar.find(x => x.id === xonaId);
  const bu = orinlar.filter(x => x.session === smena && x.roomId === xonaId);
  const hozir = o.roomId ? `${smenalar.length > 1 ? `${smenalar.find(x => x.id === o.session)?.name || `${o.session}-smena`} · ` : ''}${o.roomName} · ${(o.row ?? 0) + 1}-qator · ${(o.col ?? 0) + 1}-o'rin${o.variant ? ` · variant ${o.variant}` : ''}` : "o'rin berilmagan";

  const bos = async (joy: Joy, b?: Orin) => {
    if (band || b?.id === o.id) return;
    setBand(true);
    const ok = await onKochir(o, { session: smena, roomId: xonaId, ...joy }, b);
    setBand(false);
    if (ok) onYop();
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-4xl border border-chiziq">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn truncate">{o.name} — o'rnini o'zgartirish</h3>
            <p className="text-[12px] text-matn-xira">Hozir: {hozir}</p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {smenalar.length > 1 && (
              <Maydon nom="Smena" className="w-44">
                <select className={SELECT} value={smena} onChange={e => setSmena(Number(e.target.value))}>
                  {smenalar.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Maydon>
            )}
            <Maydon nom="Xona" className="w-60">
              <select className={SELECT} value={xonaId} onChange={e => setXonaId(Number(e.target.value))}>
                {xonalar.map(x => <option key={x.id} value={x.id}>{x.name} ({orinlar.filter(y => y.session === smena && y.roomId === x.id).length}/{xonaOrinlari(x, 'hammasi').length})</option>)}
              </select>
            </Maydon>
            <p className="pb-2.5 text-[12px] text-matn-xira">Bo'sh o'ringa bosing — ko'chadi; band o'ringa — joy almashadi.</p>
          </div>
          {xona ? <XonaXaritasi orinlar={bu} xona={xona} tanlanganId={o.id} onBos={bos} /> : <p className="text-[12.5px] text-matn-xira">Xona yo'q</p>}
        </div>
      </div>
    </div>
  );
}
