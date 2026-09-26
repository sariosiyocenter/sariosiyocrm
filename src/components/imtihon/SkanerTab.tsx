import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Camera, Keyboard, CheckCircle2, AlertTriangle, XCircle, Loader2, Search, Square, RotateCcw, ChevronDown, ClipboardCheck, UserX } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Tanlov, Yorliq, INPUT, SELECT, Maydon, BoshHolat, Yuklanmoqda } from './ui';
import { useOrinlar, type Orin } from './QatnashchilarTab';
import { OmrIshchi, faylSahifalari, type IshchiNatija } from '../../lib/omr/skaner';
import { varaqSahifalari, type VaraqParametrlari } from '../../lib/omr/layout';
import { varaqTuzilmasi, HARFLAR, RAQAM_USTUNLARI } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';
import QulfKerak from './QulfKerak';

// 4-bo'lim: javob varaqalarini o'qish. Asosiy yo'l — ADF skanerdan PDF yoki
// rasmlar (brauzerning o'zi o'qiydi, serverga faqat javoblar va kichik rasm
// boradi). Zaxira — telefon kamerasi. Buzilgan varaq — qo'lda kiritish.

type Holat = 'kutmoqda' | 'oqilmoqda' | 'saqlanmoqda' | 'tayyor' | 'aniqlanmadi' | 'xato';
interface Element {
  id: number;
  nom: string;
  holat: Holat;
  oqish?: IshchiNatija['natija'];
  rasm?: string | null;
  xato?: string;
  natija?: { name: string; score: number; shubhalar: number; sheetCode?: string };
}

export default function SkanerTab({ exam, yangila, onTekshirish }: { exam: ImtihonTafsil; yangila: () => Promise<any>; onTekshirish?: () => void }) {
  const { ozgartira, showNotification, students } = useCRM();
  // Varaqdagi "O'quvchi ID raqami": 5 xonali o'quvchi ID si (2026-09-26 dan
  // o'quvchi va ota-ona biladigan raqam) yoki eski ichki №.
  const idniTop = useCallback((raqam: string) => {
    const n = parseInt(raqam);
    if (!n) return 0;
    if (n >= 10000) return students.find(s => s.kod === n)?.id ?? 0;
    return n;
  }, [students]);
  const skanerlaydi = ozgartira('imtihonlar.natija');
  const { soro } = useImtihonApi();
  const { data: orinData, yukla: orinlarniYukla } = useOrinlar(exam.id);
  const [rejim, setRejim] = useState<'fayl' | 'kamera' | 'qolda'>('fayl');
  // "Skaner holati"dan qo'lda kiritishga o'tilgan qatnashchi.
  const [qoldaOrin, setQoldaOrin] = useState<Orin | null>(null);
  const [navbat, setNavbat] = useState<Element[]>([]);
  const [ishlamoqda, setIshlamoqda] = useState(false);
  const ishchiRef = useRef<OmrIshchi | null>(null);
  const idRef = useRef(0);
  const s = exam.settings;

  const params: VaraqParametrlari = useMemo(() => ({
    tuzilma: varaqTuzilmasi(exam.blocks, exam.scoring) as any,
    optionCount: s.optionCount, variantCount: s.variantCount, variantBubble: s.variantBubble,
  }), [exam, s]);
  const sahifalar = useMemo(() => varaqSahifalari(params), [params]);

  const ishchi = () => (ishchiRef.current ??= new OmrIshchi());
  useEffect(() => () => ishchiRef.current?.yop(), []);

  const yangilaEl = (id: number, patch: Partial<Element>) => setNavbat(n => n.map(e => (e.id === id ? { ...e, ...patch } : e)));

  /** O'qilgan varaqni serverga yuborish (kod yoki o'quvchi aniq bo'lsa). */
  const yubor = useCallback(async (el: Element, qoshimcha: { sheetCode?: string; studentId?: number; session?: number } = {}, source = 'skaner') => {
    const o = el.oqish!;
    const sahifa = sahifalar.find(x => x.page === o.page);
    const pageItems = sahifa ? [...sahifa.yopiq.map(q => q.n), ...sahifa.raqamli.map(q => q.n), ...sahifa.yozma.map(q => q.n)] : [];
    const body: any = {
      page: o.page, answers: o.javoblar, flags: o.shubhalar.filter(f => f.n > 0), pageItems,
      variant: o.variant, image: el.rasm, source,
    };
    if (qoshimcha.sheetCode) body.sheetCode = qoshimcha.sheetCode;
    else if (o.qr?.turi === 'S') body.sheetCode = o.qr.sheetCode;
    if (!body.sheetCode) {
      const sid = qoshimcha.studentId ?? (o.idRaqam ? idniTop(o.idRaqam) : 0);
      if (!sid) { yangilaEl(el.id, { holat: 'aniqlanmadi', xato: o.qr ? "O'quvchi ID raqami o'qilmadi — o'quvchini tanlang" : "QR o'qilmadi — varaq kodini kiriting" }); return; }
      body.studentId = sid;
      body.session = qoshimcha.session ?? o.qr?.session ?? 1;
    }
    yangilaEl(el.id, { holat: 'saqlanmoqda', xato: undefined });
    try {
      const r = await soro<any>('POST', `exams/${exam.id}/scans`, body);
      yangilaEl(el.id, { holat: 'tayyor', natija: { name: r.name, score: r.score, shubhalar: r.shubhalar, sheetCode: r.sheetCode } });
    } catch (e: any) {
      yangilaEl(el.id, { holat: e.status === 404 ? 'aniqlanmadi' : 'xato', xato: e.message });
    }
  }, [exam.id, sahifalar, soro, idniTop]);

  const fayllar = async (files: FileList | null) => {
    if (!files?.length) return;
    setIshlamoqda(true);
    try {
      for (const file of Array.from(files)) {
        try {
          for await (const { bitmap, nom } of faylSahifalari(file)) {
            const el: Element = { id: ++idRef.current, nom, holat: 'oqilmoqda' };
            setNavbat(n => [el, ...n]);
            try {
              const r = await ishchi().oqi(bitmap, params);
              el.oqish = r.natija;
              el.rasm = r.rasm;
              if (!r.natija.ok) { yangilaEl(el.id, { holat: 'xato', xato: r.natija.xato, oqish: r.natija }); continue; }
              yangilaEl(el.id, { oqish: r.natija, rasm: r.rasm });
              await yubor(el);
            } catch (e: any) {
              yangilaEl(el.id, { holat: 'xato', xato: e.message });
            }
          }
        } catch (e: any) {
          showNotification(`${file.name}: ${e.message}`, 'error');
        }
      }
    } finally {
      setIshlamoqda(false);
      orinlarniYukla();
      yangila();
    }
  };

  const hisob = {
    jami: navbat.length,
    tayyor: navbat.filter(e => e.holat === 'tayyor').length,
    shubhali: navbat.filter(e => e.holat === 'tayyor' && e.natija!.shubhalar > 0).length,
    muammo: navbat.filter(e => e.holat === 'xato' || e.holat === 'aniqlanmadi').length,
  };

  if (!exam.lockedAt) {
    return <QulfKerak examId={exam.id} ikonka={<Upload size={20} />}
      izoh="«Imtihonlar» tabida savollar (yoki «faqat kalit» rejimida kitobcha kaliti) tayyor bo'lgach — «Savollarni qulflash». Keyin javob varaqalari chop etiladi va to'ldirilgan varaqlar shu yerda skanerlanadi." />;
  }
  if (!skanerlaydi) return <Karta><BoshHolat ikonka={<Upload size={20} />} sarlavha="Skanerlashga ruxsatingiz yo'q" /></Karta>;

  const kelmadi = async (o: Orin) => {
    try {
      await soro('PUT', `exams/${exam.id}/seats/${o.id}`, { status: 'kelmadi' });
      await orinlarniYukla();
      yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
    <div className="lg:col-span-2 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tanlov qiymat={rejim} onChange={v => { setRejim(v); setQoldaOrin(null); }} variantlar={[
          { v: 'fayl', nom: <span className="inline-flex items-center gap-1.5"><Upload size={14} /> Skaner fayli</span> },
          { v: 'kamera', nom: <span className="inline-flex items-center gap-1.5"><Camera size={14} /> Kamera</span> },
          { v: 'qolda', nom: <span className="inline-flex items-center gap-1.5"><Keyboard size={14} /> Qo'lda kiritish</span> },
        ]} />
        {hisob.jami > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Yorliq rang="yaxshi">{hisob.tayyor} saqlandi</Yorliq>
            {hisob.shubhali > 0 && <Yorliq rang="ogoh">{hisob.shubhali} tasida shubha</Yorliq>}
            {hisob.muammo > 0 && <Yorliq rang="xato">{hisob.muammo} muammo</Yorliq>}
          </div>
        )}
      </div>

      {rejim === 'fayl' && (
        <Karta>
          <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${ishlamoqda ? 'border-brand bg-brand-fon/40' : 'border-chiziq hover:border-brand hover:bg-ichki'}`}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!ishlamoqda) fayllar(e.dataTransfer.files); }}>
            {ishlamoqda ? <Loader2 size={26} className="animate-spin text-brand" /> : <Upload size={26} className="text-matn-xira" />}
            <span className="text-[13.5px] font-semibold text-matn">{ishlamoqda ? "O'qilmoqda…" : 'PDF yoki rasmlarni tanlang (yoki shu yerga tashlang)'}</span>
            <span className="text-[12px] text-matn-xira max-w-lg">Skanerda: oq-qora yoki kulrang, 200–300 dpi. Bitta PDF da yuzlab varaq bo'lishi mumkin — hammasi ketma-ket o'qiladi. Qayta skanerlash xavfsiz: operator tasdiqlagan javoblar o'zgarmaydi.</span>
            <input type="file" multiple accept="application/pdf,image/*" className="hidden" disabled={ishlamoqda} onChange={e => { fayllar(e.target.files); e.target.value = ''; }} />
          </label>
        </Karta>
      )}
      {rejim === 'kamera' && <KameraSkaner params={params} ishchi={ishchi} onVaraq={async (natija, rasm) => {
        const el: Element = { id: ++idRef.current, nom: 'Kamera', holat: 'saqlanmoqda', oqish: natija, rasm };
        setNavbat(n => [el, ...n]);
        await yubor(el, {}, 'kamera');
      }} />}
      {rejim === 'qolda' && <QoldaKiritish key={qoldaOrin?.id ?? 0} exam={exam} orinlar={orinData?.seats || []} boshlangich={qoldaOrin} onSaqlandi={() => { setQoldaOrin(null); orinlarniYukla(); yangila(); }} />}

      {navbat.length > 0 && (
        <Karta sarlavha="O'qilgan varaqlar" ichki="p-0">
          <ul className="divide-y divide-chiziq">
            {navbat.map(el => <NavbatQatori key={el.id} el={el} orinlar={orinData?.seats || []} onYubor={(q) => yubor(el, q, el.nom === 'Kamera' ? 'kamera' : 'skaner')} />)}
          </ul>
        </Karta>
      )}
    </div>
      <SkanerHolati exam={exam} orinlar={orinData?.seats ?? null} onKelmadi={kelmadi} onTekshirish={onTekshirish}
        onQolda={o => { setQoldaOrin(o); setRejim('qolda'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    </div>
  );
}

/**
 * Skaner holati — xona bo'yicha: kutilgan varaqlar, skanerlangani, kelmaganlar
 * va hali varag'i yo'qlar. Qolganini "kelmadi" deb belgilash yoki qo'lda
 * kiritish shu yerdan — e'londan oldin hech kim tushib qolmasin.
 */
function SkanerHolati({ exam, orinlar, onKelmadi, onQolda, onTekshirish }: {
  exam: ImtihonTafsil; orinlar: Orin[] | null; onKelmadi: (o: Orin) => void; onQolda: (o: Orin) => void; onTekshirish?: () => void;
}) {
  const [ochiq, setOchiq] = useState<string | null>(null);
  const kopSmena = exam.settings.sessions.length > 1;
  const guruhlar = useMemo(() => {
    const m = new Map<string, { kalit: string; nom: string; kelmadi: number; skanerlangan: number; shubhali: number; qolgan: Orin[] }>();
    for (const o of orinlar || []) {
      const kalit = `${o.session}|${o.roomId ?? 0}`;
      if (!m.has(kalit)) {
        const smena = exam.settings.sessions.find(x => x.id === o.session)?.name || `${o.session}-smena`;
        m.set(kalit, { kalit, nom: `${kopSmena ? `${smena} · ` : ''}${o.roomName || 'Xonasiz'}`, kelmadi: 0, skanerlangan: 0, shubhali: 0, qolgan: [] });
      }
      const g = m.get(kalit)!;
      if (o.resultId) { g.skanerlangan++; if (o.reviewStatus === 'shubhali') g.shubhali++; }
      else if (o.status === 'kelmadi') g.kelmadi++;
      else g.qolgan.push(o);
    }
    return [...m.values()];
  }, [orinlar, exam.settings.sessions, kopSmena]);

  if (!orinlar) return <Karta sarlavha="Skaner holati"><Yuklanmoqda /></Karta>;
  if (!orinlar.length) {
    return <Karta sarlavha="Skaner holati"><p className="text-[12.5px] text-matn-xira">Qatnashchilar o'rinlashtirilmagan — skanerlangan varaq o'quvchi ID raqami bo'yicha saqlanadi.</p></Karta>;
  }
  const jami = guruhlar.reduce((a, g) => ({ skaner: a.skaner + g.skanerlangan, kelmadi: a.kelmadi + g.kelmadi, qolgan: a.qolgan + g.qolgan.length, shubhali: a.shubhali + g.shubhali }), { skaner: 0, kelmadi: 0, qolgan: 0, shubhali: 0 });
  const kutilgan = jami.skaner + jami.qolgan;

  return (
    <Karta sarlavha="Skaner holati" izoh={jami.qolgan ? `${jami.qolgan} ta qatnashchining varag'i hali yo'q` : 'Hamma varaq skanerlangan'}>
      <div className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[22px] font-bold text-matn raqam">{jami.skaner}<span className="text-[13px] font-semibold text-matn-xira"> / {kutilgan}</span></span>
            <span className="text-[12px] text-matn-xira">skanerlangan</span>
          </div>
          <Chiziq qism={jami.skaner} jami={kutilgan} />
          {(jami.kelmadi > 0 || jami.shubhali > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {jami.kelmadi > 0 && <Yorliq>{jami.kelmadi} kelmagan</Yorliq>}
              {jami.shubhali > 0 && (
                <button type="button" onClick={onTekshirish} disabled={!onTekshirish} className="cursor-pointer disabled:cursor-default">
                  <Yorliq rang="ogoh"><ClipboardCheck size={11} />{jami.shubhali} ta shubhali — tekshirish</Yorliq>
                </button>
              )}
            </div>
          )}
        </div>
        <ul className="divide-y divide-chiziq border-t border-chiziq -mx-4">
          {guruhlar.map(g => {
            const kut = g.skanerlangan + g.qolgan.length;
            const ochilgan = ochiq === g.kalit;
            return (
              <li key={g.kalit}>
                <button type="button" onClick={() => setOchiq(ochilgan ? null : g.kalit)} disabled={!g.qolgan.length} aria-expanded={g.qolgan.length ? ochilgan : undefined}
                  className="w-full px-4 py-2.5 text-left cursor-pointer disabled:cursor-default hover:bg-ichki/60 disabled:hover:bg-transparent">
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="font-semibold text-matn truncate">{g.nom}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {g.qolgan.length ? <span className="text-ogoh font-semibold">{g.qolgan.length} qoldi</span> : <CheckCircle2 size={14} className="text-yaxshi" />}
                      <span className="raqam text-matn-xira">{g.skanerlangan}/{kut}</span>
                      {g.qolgan.length > 0 && <ChevronDown size={14} className={`text-matn-xira transition-transform ${ochilgan ? 'rotate-180' : ''}`} />}
                    </span>
                  </div>
                  <Chiziq qism={g.skanerlangan} jami={kut} />
                </button>
                {ochilgan && (
                  <ul className="px-4 pb-3 space-y-1.5">
                    {g.qolgan.map(o => (
                      <li key={o.id} className="flex items-center gap-1 rounded-lg bg-ichki/70 pl-2.5 pr-1 py-1.5">
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] font-semibold text-matn truncate">{o.name}</span>
                          <span className="block text-[11px] text-matn-xira">{o.row ? `${o.row}-qator, ${o.col}-o'rin · ` : ''}{o.sheetCode}{o.status === 'keldi' ? ' · keldi' : ''}</span>
                        </span>
                        <Tugma kichik turi="oddiy" ikonka={<Keyboard size={13} />} onClick={() => onQolda(o)} aria-label={`${o.name}: qo'lda kiritish`}>Qo'lda</Tugma>
                        <Tugma kichik turi="oddiy" ikonka={<UserX size={13} />} onClick={() => onKelmadi(o)} aria-label={`${o.name}: kelmadi`}>Kelmadi</Tugma>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Karta>
  );
}

function Chiziq({ qism, jami }: { qism: number; jami: number }) {
  const foiz = jami ? Math.min(100, Math.round((qism / jami) * 100)) : 0;
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-ichki overflow-hidden" role="progressbar" aria-valuenow={foiz} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${foiz === 100 ? 'bg-yaxshi' : 'bg-brand'}`} style={{ width: `${foiz}%` }} />
    </div>
  );
}

function NavbatQatori({ el, orinlar, onYubor }: { el: Element; orinlar: Orin[]; onYubor: (q: { sheetCode?: string; studentId?: number }) => void }) {
  const [kod, setKod] = useState('');
  const [qidiruv, setQidiruv] = useState('');
  const mos = useMemo(() => (qidiruv.length < 2 ? [] : orinlar.filter(o => o.studentId && o.name.toLowerCase().includes(qidiruv.toLowerCase())).slice(0, 6)), [qidiruv, orinlar]);
  const ikonka = el.holat === 'tayyor'
    ? (el.natija!.shubhalar ? <AlertTriangle size={17} className="text-ogoh" /> : <CheckCircle2 size={17} className="text-yaxshi" />)
    : el.holat === 'xato' || el.holat === 'aniqlanmadi' ? <XCircle size={17} className="text-xato" /> : <Loader2 size={17} className="animate-spin text-brand" />;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{ikonka}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className="font-semibold text-matn">{el.natija?.name || el.nom}</span>
            {el.natija && <span className="text-matn-sokin">{el.natija.score} ball{el.natija.shubhalar ? ` · ${el.natija.shubhalar} ta shubhali javob` : ''}</span>}
            {el.oqish?.page ? <span className="text-matn-xira text-[12px]">{el.oqish.page}-sahifa</span> : null}
          </div>
          {el.xato && <p className="text-[12px] text-xato mt-0.5">{el.xato}</p>}
          {el.holat === 'aniqlanmadi' && el.oqish?.ok && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {el.oqish.qr?.turi !== 'U' ? (
                <>
                  <input className={`${INPUT} w-40 py-1.5 font-mono uppercase`} placeholder="Varaq kodi" value={kod} onChange={e => setKod(e.target.value.toUpperCase())} />
                  <Tugma kichik turi="asosiy" disabled={kod.length < 5} onClick={() => onYubor({ sheetCode: kod })}>Saqlash</Tugma>
                </>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-matn-xira" />
                  <input className={`${INPUT} w-56 py-1.5 pl-8`} placeholder="O'quvchi ismi" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
                  {mos.length > 0 && (
                    <div className="absolute z-10 mt-1 w-72 rounded-xl border border-chiziq bg-sirt shadow-lg">
                      {mos.map(o => <button key={o.id} onClick={() => onYubor({ studentId: o.studentId! })} className="block w-full text-left px-3 py-2 text-[12.5px] hover:bg-ichki cursor-pointer">{o.name} <span className="text-matn-xira">· {o.groupName}</span></button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {el.rasm && <a href={el.rasm} target="_blank" rel="noreferrer" className="shrink-0"><img src={el.rasm} alt="" className="h-14 w-10 object-cover rounded border border-chiziq bg-white" /></a>}
      </div>
    </li>
  );
}

/** Telefon kamerasi: varaq ramkaga tushsa — o'zi oladi (bir varaqni ikki marta olmaydi). */
function KameraSkaner({ params, ishchi, onVaraq }: { params: VaraqParametrlari; ishchi: () => OmrIshchi; onVaraq: (n: IshchiNatija['natija'], rasm: string | null) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const oqimRef = useRef<MediaStream | null>(null);
  const [yoqilgan, setYoqilgan] = useState(false);
  const [xabar, setXabar] = useState('Varaqni to\'liq ramkaga joylang');
  const [yashil, setYashil] = useState(false);
  const oxirgi = useRef<{ kalit: string; vaqt: number } | null>(null);
  const band = useRef(false);

  const toxtat = useCallback(() => {
    oqimRef.current?.getTracks().forEach(t => t.stop());
    oqimRef.current = null;
    setYoqilgan(false);
  }, []);
  useEffect(() => toxtat, [toxtat]);

  const yoq = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      oqimRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
      setYoqilgan(true);
    } catch {
      setXabar("Kameraga ruxsat berilmadi — brauzer sozlamalarini tekshiring");
    }
  };

  useEffect(() => {
    if (!yoqilgan) return;
    const t = setInterval(async () => {
      const v = videoRef.current;
      if (!v || band.current || v.readyState < 2 || !v.videoWidth) return;
      band.current = true;
      try {
        const bitmap = await createImageBitmap(v);
        const r = await ishchi().oqi(bitmap, params);
        if (!r.natija.ok) { setXabar(r.natija.xato || 'Varaq topilmadi'); return; }
        const kalit = `${r.natija.qr?.sheetCode || r.natija.idRaqam || '?'}|${r.natija.page}`;
        if (oxirgi.current && oxirgi.current.kalit === kalit && Date.now() - oxirgi.current.vaqt < 8000) { setXabar('Bu varaq olindi — keyingisini qo\'ying'); return; }
        oxirgi.current = { kalit, vaqt: Date.now() };
        setYashil(true);
        setTimeout(() => setYashil(false), 700);
        if (navigator.vibrate) navigator.vibrate(80);
        setXabar(`Olindi: ${r.natija.qr?.sheetCode || 'universal'} · ${r.natija.page}-sahifa`);
        await onVaraq(r.natija, r.rasm);
      } catch (e: any) {
        setXabar(e.message);
      } finally {
        band.current = false;
      }
    }, 600);
    return () => clearInterval(t);
  }, [yoqilgan, ishchi, params, onVaraq]);

  return (
    <Karta>
      <div className="space-y-3">
        <div className={`relative mx-auto max-w-md aspect-[3/4] rounded-2xl overflow-hidden bg-black border-4 transition-colors ${yashil ? 'border-yaxshi' : 'border-transparent'}`}>
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          {!yoqilgan && <div className="absolute inset-0 flex items-center justify-center"><Tugma turi="asosiy" ikonka={<Camera size={15} />} onClick={yoq}>Kamerani yoqish</Tugma></div>}
          {yoqilgan && <div className="absolute inset-4 border-2 border-white/60 rounded-xl pointer-events-none" />}
          {yoqilgan && <p className="absolute bottom-3 inset-x-3 text-center text-[12.5px] text-white bg-black/50 rounded-lg px-2 py-1">{xabar}</p>}
        </div>
        {yoqilgan && <div className="flex justify-center"><Tugma ikonka={<Square size={13} />} onClick={toxtat}>To'xtatish</Tugma></div>}
        <p className="text-[12px] text-matn-xira text-center">To'rt burchakdagi qora kvadrat ko'rinsin, varaq yorug' joyda, soyasiz tursin. Ko'p varaq uchun skaner qulayroq.</p>
      </div>
    </Karta>
  );
}

/** Buzilgan varaq: javoblarni qo'lda kiritish. */
function QoldaKiritish({ exam, orinlar, boshlangich, onSaqlandi }: { exam: ImtihonTafsil; orinlar: Orin[]; boshlangich?: Orin | null; onSaqlandi: () => void }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [qidiruv, setQidiruv] = useState('');
  const [orin, setOrin] = useState<Orin | null>(boshlangich ?? null);
  const [javob, setJavob] = useState<Record<number, string>>({});
  const [variant, setVariant] = useState(boshlangich?.variant || '');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const tuzilma = useMemo(() => varaqTuzilmasi(exam.blocks, exam.scoring), [exam]);
  const harflar = HARFLAR.slice(0, exam.settings.optionCount);
  const mos = useMemo(() => (qidiruv.length < 2 ? [] : orinlar.filter(o => o.name.toLowerCase().includes(qidiruv.toLowerCase()) || o.sheetCode.includes(qidiruv.toUpperCase())).slice(0, 8)), [qidiruv, orinlar]);

  const saqla = async () => {
    if (!orin) return;
    setSaqlanmoqda(true);
    try {
      const answers: Record<number, string> = {};
      for (const sv of tuzilma.savollar) if (sv.tur !== 'yozma') answers[sv.n] = javob[sv.n] || '';
      const r = await soro<any>('POST', `exams/${exam.id}/scans`, { sheetCode: orin.sheetCode, page: 1, answers, pageItems: tuzilma.savollar.map((x: any) => x.n), variant: variant || undefined, source: 'qolda' });
      showNotification(`${r.name}: ${r.score} ball saqlandi`, 'success');
      setOrin(null); setJavob({}); setVariant(''); setQidiruv('');
      onSaqlandi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  return (
    <Karta sarlavha="Qo'lda kiritish" izoh="Varaq yirtilgan yoki skanerlanmaydigan bo'lsa">
      {!orin ? (
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
          <input className={`${INPUT} pl-9`} placeholder="Ism yoki varaq kodi" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
          {mos.length > 0 && (
            <div className="mt-1 rounded-xl border border-chiziq bg-sirt divide-y divide-chiziq">
              {mos.map(o => <button key={o.id} onClick={() => { setOrin(o); setVariant(o.variant || ''); }} className="block w-full text-left px-3 py-2 text-[13px] hover:bg-ichki cursor-pointer">{o.name} <span className="text-matn-xira">· {o.sheetCode} · variant {o.variant || '—'}</span></button>)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-matn">{orin.name}</p>
              <p className="text-[12px] text-matn-xira">{orin.sheetCode} · {orin.roomName}</p>
            </div>
            <div className="flex items-end gap-2">
              <Maydon nom="Kitobcha varianti" className="w-40">
                <select className={SELECT} value={variant} onChange={e => setVariant(e.target.value)}>
                  {exam.variantlar.filter(v => v.session === orin.session).map(v => <option key={v.code} value={v.code}>{v.code}</option>)}
                </select>
              </Maydon>
              <Tugma turi="oddiy" ikonka={<RotateCcw size={13} />} onClick={() => setOrin(null)}>Boshqasi</Tugma>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
            {tuzilma.savollar.filter((x: any) => x.tur !== 'yozma').map((sv: any) => (
              <div key={sv.n} className="flex items-center gap-2">
                <span className="w-7 text-right text-[12px] font-semibold text-matn-sokin raqam">{sv.n}</span>
                {sv.tur === 'yopiq' ? (
                  <div className="flex gap-1">
                    {harflar.map(h => (
                      <button key={h} onClick={() => setJavob(j => ({ ...j, [sv.n]: j[sv.n] === h ? '' : h }))}
                        className={`w-8 h-8 rounded-full border text-[12px] font-bold cursor-pointer ${javob[sv.n] === h ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq text-matn-sokin hover:border-brand'}`}>{h}</button>
                    ))}
                  </div>
                ) : (
                  <input className={`${INPUT} py-1.5 w-28`} maxLength={RAQAM_USTUNLARI} placeholder="Javob" value={javob[sv.n] || ''} onChange={e => setJavob(j => ({ ...j, [sv.n]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          {tuzilma.yozma > 0 && <p className="text-[12px] text-matn-xira">Yozma savollar «Tekshirish» bo'limida baholanadi.</p>}
          <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} onClick={saqla}>Saqlash</Tugma>
        </div>
      )}
    </Karta>
  );
}
