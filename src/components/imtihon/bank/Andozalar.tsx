import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Copy, LayoutList, AlertTriangle, CheckCircle2, Printer, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Yuklanmoqda } from '../ui';
import { andozaSavolSoni } from '../../../../lib/imtihon.js';
import AndozadanQogoz from '../AndozadanQogoz';
import SavolTanlash from './SavolTanlash';
import AndozaSavollari from './AndozaSavollari';
import AndozaQoidalari from './AndozaQoidalari';
import { AndozaMaydonlari, AndozaToliqligi, SonTanlagich } from './AndozaQismlari';
import { SavolOynasi } from './SavolKartasi';
import { andozaQoidali, sonniOqi } from './andoza';
import type { Andoza, AndozaQatori, AndozaSavoli, AndozaTafsil, BankDaraxt } from '../../../types';

// Andoza — tayyor savollar to'plami (egasi, 2026-10-10): «nomi va savol soni kiritib
// yaratiladi — keyin unga savollar qo'shiladi». Bitta asosiy yo'l:
//   1) nomi va savollar soni  →  2) bankdan savol qo'shish (12 / 30)  →  3) savol qog'ozi.
// Imtihonga aynan shu savollar tushadi (variantlarda tartibi va javoblari aralashadi).
// Ikkinchi darajali yo'l — «Qoidalar bo'yicha avtomatik to'ldirish» (AndozaQoidalari); eski,
// faqat qoidalardan iborat andozalar avvalgidek ishlaydi (savollar har safar tasodifiy).

type Qoshildi = Andoza & { qoshildi: number; yaroqsiz?: number; qatorlar?: { kerak: number; bor: number; qoshildi: number }[] };

export default function Andozalar({ daraxt }: { daraxt: BankDaraxt }) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar') || ozgartira('imtihonlar.imtihon');
  const qogozYaratadi = ozgartira('imtihonlar.imtihon');
  const navigate = useNavigate();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [royxat, setRoyxat] = useState<Andoza[] | null>(null);
  const [tanlangan, setTanlangan] = useState<number | 'yangi' | null>(null);
  const [tafsil, setTafsil] = useState<AndozaTafsil | null>(null);
  const [tanlash, setTanlash] = useState(false);
  const [qogozOyna, setQogozOyna] = useState<number | null>(null);
  const [korish, setKorish] = useState<AndozaSavoli | null>(null);
  const [band, setBand] = useState<'' | 'yarat' | 'qosh' | 'toldir' | 'nusxa'>('');
  // Ochiq andoza (kech kelgan javob boshqa andozaning ustiga yozilmasin) va fondagi amallar navbati.
  const joriy = useRef<number | 'yangi' | null>(null);
  const navbat = useRef<Promise<unknown>>(Promise.resolve());

  const xato = (e: any) => showNotification(e?.message || 'Xatolik', 'error');

  const tafsilniYukla = useCallback(async (id: number) => {
    try {
      const t = await soro<AndozaTafsil>('GET', `bank/andozalar/${id}`);
      if (joriy.current === id) setTafsil(t);
      setRoyxat(l => l && l.map(x => (x.id === id ? qisqa(t) : x)));
    } catch (e) { xato(e); }
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const och = useCallback((id: number | 'yangi') => {
    joriy.current = id;
    setTanlangan(id);
    setTafsil(null);
    if (id !== 'yangi') tafsilniYukla(id);
  }, [tafsilniYukla]);

  const royxatniYukla = useCallback(async () => {
    try {
      const r = await soro<Andoza[]>('GET', 'bank/andozalar');
      setRoyxat(r);
      return r;
    } catch (e) { xato(e); return null; }
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Birinchi andoza o'zi ochiladi; andoza yo'q bo'lsa — yaratish oynasi.
  useEffect(() => {
    royxatniYukla().then(r => { if (r && joriy.current === null) och(r[0]?.id ?? 'yangi'); });
  }, [royxatniYukla, och]);

  const royxatgaQoy = (a: Andoza) => setRoyxat(l => (l && l.some(x => x.id === a.id) ? l.map(x => (x.id === a.id ? qisqa(a) : x)) : [qisqa(a), ...(l || [])]));
  /** Ochiq andozani joyida o'zgartirish (boshqa andoza ochilgan bo'lsa — tegilmaydi). */
  const joyida = (id: number, f: (t: AndozaTafsil) => AndozaTafsil) => setTafsil(t => (t && t.id === id ? f(t) : t));
  /** Fonda bajariladigan amal (olib tashlash, tartib, son): ekran kutmaydi; xato bo'lsa — serverdagi holat qaytadi. */
  const fonda = (id: number, ish: () => Promise<Andoza>) => {
    // Xatodan keyingi qayta yuklash ham navbat ichida: keyingi amal eski javob ustiga yozilmasin.
    navbat.current = navbat.current.then(ish).then(royxatgaQoy).catch(async e => { xato(e); if (joriy.current === id) await tafsilniYukla(id); });
  };

  const yarat = async (nom: string, soni: number) => {
    setBand('yarat');
    try {
      const a = await soro<Andoza>('POST', 'bank/andozalar', { name: nom, soni });
      royxatgaQoy(a);
      joriy.current = a.id;
      setTanlangan(a.id);
      setTafsil({ ...a, savollar: [] });
      showNotification("Andoza yaratildi — endi savollarni qo'shing", 'success');
    } catch (e) { xato(e); } finally { setBand(''); }
  };

  const nomSaqla = (id: number, name: string) => {
    joyida(id, t => ({ ...t, name }));
    fonda(id, () => soro<Andoza>('PUT', `bank/andozalar/${id}`, { name }));
  };
  const soniSaqla = (id: number, soni: number) => {
    joyida(id, t => ({ ...t, soni }));
    fonda(id, () => soro<Andoza>('PUT', `bank/andozalar/${id}`, { soni }));
  };

  const qosh = async (id: number, ids: number[], kengaytir?: boolean) => {
    setBand('qosh');
    try {
      await navbat.current;
      const r = await soro<Qoshildi>('POST', `bank/andozalar/${id}/savollar`, { ids, kengaytir: !!kengaytir });
      setTanlash(false);
      await tafsilniYukla(id);
      showNotification(`${r.qoshildi} ta savol qo'shildi${r.yaroqsiz ? ` · ${r.yaroqsiz} tasi qo'shilmadi (faol emas yoki chala)` : ''}`, 'success');
    } catch (e) { xato(e); } finally { setBand(''); }
  };

  const olib = (id: number, ids: number[]) => {
    const s = new Set(ids);
    joyida(id, t => {
      const savollar = t.savollar.filter(q => !s.has(q.id));
      return { ...t, savollar, questionIds: savollar.map(q => q.id), savolSoni: andozaSavolSoni(savollar) };
    });
    fonda(id, () => soro<Andoza>('POST', `bank/andozalar/${id}/savollar/olib`, { ids }));
  };

  const tartibla = (id: number, ids: number[]) => {
    joyida(id, t => {
      const byId = new Map(t.savollar.map(q => [q.id, q]));
      return { ...t, savollar: ids.map(x => byId.get(x)).filter(Boolean) as AndozaSavoli[], questionIds: ids };
    });
    fonda(id, () => soro<Andoza>('POST', `bank/andozalar/${id}/tartib`, { questionIds: ids }));
  };

  const toldir = async (id: number, rows: AndozaQatori[], subjectId: number) => {
    setBand('toldir');
    try {
      await navbat.current;
      const r = await soro<Qoshildi>('POST', `bank/andozalar/${id}/toldir`, { rows, subjectId });
      await tafsilniYukla(id);
      const kam = (r.qatorlar || []).filter(q => q.bor + q.qoshildi < q.kerak).length;
      if (r.qoshildi) showNotification(`${r.qoshildi} ta savol qo'shildi${kam ? ` · ${kam} ta qoidaga bankda savol yetmadi yoki joy qolmadi` : ''}`, 'success');
      else showNotification(kam ? 'Bankda qoidalarga mos savol topilmadi' : "Qoidalar bo'yicha savollar allaqachon qo'shilgan", 'info');
    } catch (e) { xato(e); } finally { setBand(''); }
  };

  const qoidalarniSaqla = async (id: number, rows: AndozaQatori[], subjectId: number) => {
    try {
      await navbat.current;
      const a = await soro<Andoza>('PUT', `bank/andozalar/${id}`, { rows, subjectId });
      royxatgaQoy(a);
      joyida(id, t => ({ ...t, rows: a.rows, subjectId: a.subjectId, fanId: a.fanId, soni: a.soni }));
      showNotification('Qoidalar saqlandi', 'success');
    } catch (e) { xato(e); }
  };

  const nusxa = async (a: Andoza) => {
    setBand('nusxa');
    try {
      await navbat.current;
      const y = await soro<Andoza>('POST', 'bank/andozalar', { nusxa: a.id });
      royxatgaQoy(y);
      och(y.id);
      showNotification('Nusxa yaratildi', 'success');
    } catch (e) { xato(e); } finally { setBand(''); }
  };

  const ochir = async (a: Andoza) => {
    if (!(await confirm({ title: `«${a.name}» andozasi o'chirilsinmi?`, message: "Savollar bankda qoladi, undan tuzilgan imtihonlar ham o'zgarmaydi.", confirmLabel: "O'chirish", danger: true }))) return;
    try {
      await navbat.current;
      await soro('DELETE', `bank/andozalar/${a.id}`);
      const qoldi = (royxat || []).filter(x => x.id !== a.id);
      setRoyxat(qoldi);
      och(qoldi[0]?.id ?? 'yangi');
      showNotification("Andoza o'chirildi", 'info');
    } catch (e) { xato(e); }
  };

  if (!royxat) return <Yuklanmoqda />;
  const fan = tafsil ? daraxt.fanlar.find(f => f.id === tafsil.fanId) || null : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-3 items-start">
      <aside className="bg-sirt border border-chiziq rounded-xl overflow-hidden" aria-label="Andozalar">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-chiziq">
          <h3 className="text-[12.5px] font-bold text-matn">Andozalar <span className="font-semibold text-matn-xira raqam">{royxat.length}</span></h3>
          {tahrir && <Tugma kichik turi="asosiy" ikonka={<Plus size={13} />} onClick={() => och('yangi')}>Yangi</Tugma>}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-chiziq">
          {!royxat.length && <li className="px-3 py-4 text-[12px] text-matn-xira">Hali andoza yo'q</li>}
          {royxat.map(a => (
            <li key={a.id}>
              <button onClick={() => tanlangan !== a.id && och(a.id)} aria-current={tanlangan === a.id ? 'true' : undefined}
                className={`w-full text-left px-3 py-2 cursor-pointer ${tanlangan === a.id ? 'bg-brand-fon dark:bg-brand/15' : 'hover:bg-ichki'}`}>
                <span className="block text-[12.5px] font-semibold text-matn truncate">{a.name}</span>
                <AndozaToliqligi a={a} className="mt-1" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {tanlangan === 'yangi' || !royxat.length ? (
        <YangiAndoza tahrir={tahrir} band={band === 'yarat'} birinchi={!royxat.length} onYarat={yarat} onBekor={royxat.length ? () => och(royxat[0].id) : undefined} />
      ) : !tafsil ? (
        <div className="bg-sirt border border-chiziq rounded-xl"><Yuklanmoqda /></div>
      ) : (
        <AndozaOynasi key={tafsil.id} a={tafsil} daraxt={daraxt} tahrir={tahrir} band={band}
          onNom={n => nomSaqla(tafsil.id, n)} onSoni={n => soniSaqla(tafsil.id, n)} onQosh={() => setTanlash(true)}
          onOlib={ids => olib(tafsil.id, ids)} onTartib={ids => tartibla(tafsil.id, ids)} onKor={setKorish}
          onToldir={(rows, fanId) => toldir(tafsil.id, rows, fanId)} onQoidalar={(rows, fanId) => qoidalarniSaqla(tafsil.id, rows, fanId)}
          onNusxa={() => nusxa(tafsil)} onOchir={() => ochir(tafsil)} onQogoz={qogozYaratadi ? () => setQogozOyna(tafsil.id) : undefined} />
      )}

      {tanlash && tafsil && (
        <SavolTanlash fan={fan} daraxt={daraxt} tanlangan={[]} band={band === 'qosh'} onYop={() => setTanlash(false)}
          qoshish={{ nom: tafsil.name, bor: tafsil.questionIds, soni: tafsil.soni, joriy: tafsil.savolSoni }}
          onTanla={(ids, _turlar, _guruhlar, kengaytir) => qosh(tafsil.id, ids, kengaytir)} />
      )}
      {korish && <SavolOynasi q={korish} daraxt={daraxt} onYop={() => setKorish(null)} onOzgardi={() => tafsil && tafsilniYukla(tafsil.id)} />}
      {qogozOyna && (
        <AndozadanQogoz boshAndozaId={qogozOyna} onYop={() => setQogozOyna(null)}
          onTayyor={(id, qulflandi) => { setQogozOyna(null); navigate(qulflandi ? `/exams?tab=chop&imtihon=${id}` : `/exams?imtihon=${id}`); }} />
      )}
    </div>
  );
}

/** Ro'yxat uchun: savollarsiz ko'rinish (server javobidagi qo'shimcha maydonlarsiz). */
function qisqa(a: Andoza): Andoza {
  return { id: a.id, name: a.name, soni: a.soni, questionIds: a.questionIds, savolSoni: a.savolSoni, fanId: a.fanId, subjectId: a.subjectId, rows: a.rows, updatedAt: a.updatedAt };
}

/** 1-qadam: faqat nomi va savollar soni. */
function YangiAndoza({ tahrir, band, birinchi, onYarat, onBekor }: {
  tahrir: boolean; band: boolean; birinchi: boolean; onYarat: (nom: string, soni: number) => void; onBekor?: () => void;
}) {
  const [nom, setNom] = useState('');
  const [soni, setSoni] = useState('30');
  const tayyor = !!nom.trim() && sonniOqi(soni) > 0;
  const yarat = () => { if (tayyor && !band) onYarat(nom.trim(), sonniOqi(soni)); };
  return (
    <section className="bg-sirt border border-chiziq rounded-xl p-5 max-w-2xl" aria-label="Yangi andoza">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-ichki flex items-center justify-center text-matn-xira"><LayoutList size={18} /></span>
        <div>
          <h3 className="text-[14px] font-bold text-matn">{birinchi ? 'Birinchi andozani yarating' : 'Yangi andoza'}</h3>
          <p className="text-[12px] text-matn-xira mt-0.5">Andoza — tayyor savollar to'plami: nomi va savollar sonini yozasiz, keyin bankdan savollarni qo'shasiz. Undan bir bosishda variantli savol qog'ozi chiqadi.</p>
        </div>
      </div>
      {tahrir ? (
        <>
          <AndozaMaydonlari nom={nom} soni={soni} onNom={setNom} onSoni={setSoni} onEnter={yarat} disabled={band} autoFocus />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-matn-xira" aria-label="Qadamlar">
              <li className="font-semibold text-matn">1. Nomi va soni</li>
              <li>2. Savollarni qo'shish</li>
              <li>3. Savol qog'ozi</li>
            </ol>
            <div className="flex gap-2">
              {onBekor && <Tugma onClick={onBekor} disabled={band}>Bekor</Tugma>}
              <Tugma turi="asosiy" ikonka={<Plus size={14} />} yuklanmoqda={band} disabled={!tayyor} onClick={yarat}>Andoza yaratish</Tugma>
            </div>
          </div>
        </>
      ) : <p className="text-[12.5px] text-matn-sokin">Andoza yaratishga ruxsat yo'q.</p>}
    </section>
  );
}

/** 2-qadam: andoza — to'lganligi (12 / 30), savollari va amallar. */
function AndozaOynasi({ a, daraxt, tahrir, band, onNom, onSoni, onQosh, onOlib, onTartib, onKor, onToldir, onQoidalar, onNusxa, onOchir, onQogoz }: {
  a: AndozaTafsil; daraxt: BankDaraxt; tahrir: boolean; band: string;
  onNom: (v: string) => void; onSoni: (n: number) => void; onQosh: () => void;
  onOlib: (ids: number[]) => void; onTartib: (ids: number[]) => void; onKor: (q: AndozaSavoli) => void;
  onToldir: (rows: AndozaQatori[], fanId: number) => void; onQoidalar: (rows: AndozaQatori[], fanId: number) => Promise<void>;
  onNusxa: () => void; onOchir: () => void; onQogoz?: () => void;
}) {
  const [nom, setNom] = useState(a.name);
  useEffect(() => { setNom(a.name); }, [a.name]);
  const qoidali = andozaQoidali(a);
  const toldi = a.savolSoni >= a.soni && a.savolSoni > 0;
  const tushmaydi = andozaSavolSoni(a.savollar) - andozaSavolSoni(a.savollar.filter(q => !q.tushmaydi));
  const fanlar = [...new Set(a.savollar.map(q => q.bankTopic?.subjectId).filter(Boolean))].map(id => daraxt.fanlar.find(f => f.id === id)?.name).filter(Boolean);
  const nomniSaqla = () => { const n = nom.trim(); if (n && n !== a.name) onNom(n); else setNom(a.name); };

  return (
    <section className="bg-sirt border border-chiziq rounded-xl min-w-0" aria-label="Andoza">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
        <input aria-label="Andoza nomi" disabled={!tahrir} maxLength={120} value={nom} placeholder="Andoza nomi"
          className="flex-1 min-w-48 -ml-2 px-2 py-1.5 rounded-lg border border-transparent bg-transparent text-[15px] font-bold text-matn outline-none hover:border-chiziq focus:border-brand focus:bg-ichki"
          onChange={e => setNom(e.target.value)} onBlur={nomniSaqla} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        {onQogoz && <Tugma kichik ikonka={<Printer size={13} />} disabled={!qoidali && !a.savolSoni} title={!qoidali && !a.savolSoni ? "Avval savol qo'shing" : "Variantli imtihon: kitobcha, kalit va javob varaqasi"} onClick={onQogoz}>Savol qog'ozi</Tugma>}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-2 pb-4 border-b border-chiziq">
        <div className="flex-1 min-w-52">
          <p className="text-[13px] text-matn-sokin">
            <b className="raqam text-[22px] leading-none text-matn">{a.savolSoni}</b> / <span className="raqam">{a.soni}</span> ta savol
            {toldi && <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-yaxshi"><CheckCircle2 size={13} /> to'ldi</span>}
            {fanlar.length > 0 && <span className="ml-2 text-[12px] text-matn-xira">· {fanlar.slice(0, 2).join(', ')}{fanlar.length > 2 ? ` +${fanlar.length - 2}` : ''}</span>}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-ichki overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={a.soni} aria-valuenow={a.savolSoni} aria-label="Andoza to'lganligi">
            <div className={`h-full rounded-full transition-[width] ${toldi ? 'bg-yaxshi' : 'bg-brand'}`} style={{ width: `${a.soni ? Math.min(100, (a.savolSoni / a.soni) * 100) : 0}%` }} />
          </div>
        </div>
        {tahrir && (
          <>
            <div>
              <span className="block text-[11px] font-semibold text-matn-xira mb-1">Savollar soni</span>
              <SonTanlagich qiymat={a.soni} min={a.savolSoni} onSaqla={onSoni} />
            </div>
            <Tugma turi="asosiy" ikonka={<Plus size={14} />} className="self-end" onClick={onQosh}>Savol qo'shish</Tugma>
          </>
        )}
      </div>

      {qoidali && (
        <p className="flex items-start gap-2 px-4 py-2.5 border-b border-chiziq bg-ichki/50 text-[12px] text-matn-sokin">
          <Info size={14} className="mt-0.5 shrink-0 text-brand" />
          <span>Bu andoza faqat qoidalardan iborat: imtihonga savollar har safar bankdan tasodifiy olinadi. Aniq savollar bilan ishlatish uchun — savol qo'shing yoki pastdagi «Bo'sh o'rinlarni to'ldirish» ni bosing; shundan keyin qog'ozga faqat qo'shilgan savollar tushadi.</span>
        </p>
      )}
      {tushmaydi > 0 && (
        <p className="flex items-start gap-2 px-4 py-2.5 border-b border-chiziq bg-ogoh-fon/60 text-[12px] font-semibold text-ogoh">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{tushmaydi} ta savol qog'ozga tushmaydi (bankda faol emas yoki chala) — ularni bankda to'g'rilang yoki olib tashlab, boshqasini qo'shing.</span>
        </p>
      )}

      {/* Qo'shish yoki to'ldirish ketayotganda ro'yxat qotadi: yangi javob ekrandagi o'zgarish ustiga yozilmasin. */}
      <AndozaSavollari savollar={a.savollar} soni={a.soni} tahrir={tahrir && !band} onOlib={onOlib} onTartib={onTartib} onKor={onKor} onQosh={tahrir ? onQosh : undefined} />

      <AndozaQoidalari a={a} daraxt={daraxt} tahrir={tahrir} band={band === 'toldir'} onToldir={onToldir} onSaqla={onQoidalar} />

      {tahrir && (
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-chiziq">
          <Tugma kichik turi="oddiy" ikonka={<Copy size={13} />} yuklanmoqda={band === 'nusxa'} onClick={onNusxa} title="Shu andozaning nusxasi (savollari bilan)">Nusxa</Tugma>
          <Tugma kichik turi="xavfli" ikonka={<Trash2 size={13} />} onClick={onOchir}>O'chirish</Tugma>
        </div>
      )}
    </section>
  );
}
