import React, { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle2, ListChecks, X, LayoutList, Loader2 } from 'lucide-react';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT, SELECT, Tanlov } from '../ui';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { QIYINLIK, QiyinlikYorligi, useQiyinlik } from '../bank/qiyinlik';
import { fanniTop, mavzuniTop } from '../bank/useBankDaraxt';
import SavolTanlash, { type TanlovGuruhi } from '../bank/SavolTanlash';
import { andozadanQoidalar } from './andozadan';
import { taqsimla, tengYoy, QIYINLIK_ARALASHMASI, qoidaQiyinligi, qoidaBali, tanlanganSavollar, vergul, qismSoni, qismTekshiruvi } from '../../../../lib/imtihon.js';
import type { Andoza, BankDaraxt, BankFan, BelgiGuruhi, BlokTaqsimot, ExamBlock, Question, SavolTuri, TopicRule } from '../../../types';

// Imtihonning bitta fan bloki (bank rejimi). Odatiy yo'l: fan → savollar soni →
// qiyinlik (oson ko'proq / muvozanatli / qiyin ko'proq) → mavzular — taqsimot
// o'zi hisoblanadi va jadvalda ko'rinadi. Jadval katagini o'zgartirsa — "qo'lda".
// Aniq savollar kerak bo'lsa — "Savollarni tanlash" (fan → mavzu → qiyinlik).

type Aralash = BlokTaqsimot['aralash'];
type Qator = { kalit: string; mavzuId: number | null; nom: string; sonlar: number[]; bor: number[] };

const ARALASH_NOMI: { v: Exclude<Aralash, 'qolda'>; nom: string }[] = [
  { v: 'oson', nom: "Oson ko'proq" },
  { v: 'muvozanat', nom: 'Muvozanatli' },
  { v: 'qiyin', nom: "Qiyin ko'proq" },
];
const yig = (a: number[]) => a.reduce((s, x) => s + x, 0);

/** Eski (yoki qo'lda yozilgan) qoidalardan taqsimot holati. */
function taqsimotQoidalardan(blok: ExamBlock, fan: BankFan | null): BlokTaqsimot {
  const tasodifiy = blok.topicRules.filter(r => !tanlanganSavollar(r).length);
  const mavzular = new Set<number>();
  for (const r of tasodifiy) {
    const m = mavzuniTop(fan, r.mavzuId, r.topic);
    if (m) mavzular.add(m.id);
  }
  const sum = (t: SavolTuri) => tasodifiy.filter(r => (r.type || 'yopiq') === t).reduce((a, r) => a + (Number(r.count) || 0), 0);
  const qismQoida = tasodifiy.find(r => r.type === 'qismli');
  const qism = qismSoni(qismQoida);
  return {
    jami: sum('yopiq'), aralash: 'qolda', mavzular: [...mavzular], raqamli: sum('raqamli'), moslash: sum('moslash'), yozma: sum('yozma'),
    yozmaBal: tasodifiy.find(r => r.type === 'yozma' && r.points != null)?.points ?? null,
    juft: sum('juft'), juftBal: tasodifiy.find(r => r.type === 'juft' && r.points != null)?.points ?? null,
    qismli: Math.floor(sum('qismli') / qism), qismBal: qismQoida?.points ?? null, qismSoni: qism, qismTekshir: qismTekshiruvi(qismQoida),
  };
}

/** Yopiq savollar jadvali (mavzu × oson / o'rta / qiyin / aralash) — qoidalardan. */
function jadvalQoidalardan(blok: ExamBlock, fan: BankFan | null): Map<string, { mavzuId: number | null; nom: string; sonlar: number[] }> {
  const out = new Map<string, { mavzuId: number | null; nom: string; sonlar: number[] }>();
  for (const r of blok.topicRules) {
    if (tanlanganSavollar(r).length || (r.type || 'yopiq') !== 'yopiq') continue;
    const m = mavzuniTop(fan, r.mavzuId, r.topic);
    const kalit = m ? `m${m.id}` : r.topic?.trim() ? `n:${r.topic.trim().toLowerCase()}` : 'x';
    if (!out.has(kalit)) out.set(kalit, { mavzuId: m?.id ?? null, nom: m?.name || r.topic || '', sonlar: [0, 0, 0, 0] });
    const d = qoidaQiyinligi(r);
    out.get(kalit)!.sonlar[d ? d - 1 : 3] += Number(r.count) || 0;
  }
  return out;
}

export default function BlokMuharriri({ blok, index, daraxt, scoring, kopaytma, qulf, onChange, onOchir }: {
  blok: ExamBlock; index: number; daraxt: BankDaraxt; scoring: 'blok' | 'foiz'; kopaytma: number; qulf: boolean;
  onChange: (b: ExamBlock) => void; onOchir?: () => void;
}) {
  const fan = fanniTop(daraxt, blok.fanId, blok.subject);
  const t = blok.taqsimot ?? taqsimotQoidalardan(blok, fan);
  const [tanlashOchiq, setTanlashOchiq] = useState(false);
  const [andozaOchiq, setAndozaOchiq] = useState(false);
  const qolda = blok.topicRules.filter(r => tanlanganSavollar(r).length);
  const qoldaIds = qolda.flatMap(r => tanlanganSavollar(r));

  // Yangi fan tanlanganda yoki eski imtihon ochilganda — fan id si bilan bog'lanadi.
  useEffect(() => {
    if (qulf || !fan || (blok.fanId === fan.id && blok.subject === fan.name)) return;
    onChange({ ...blok, fanId: fan.id, subject: fan.name });
  }, [fan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tanlanganMavzular = (fan?.mavzular || []).filter(m => t.mavzular.includes(m.id));
  const jadval = jadvalQoidalardan(blok, fan);

  /** Taqsimot (va qo'lda jadval) dan qoidalar yasab, blokni yangilaydi. */
  const qayta = (yangiT: BlokTaqsimot, qoldaJadval?: Map<string, { mavzuId: number | null; nom: string; sonlar: number[] }>, yangiQolda?: TopicRule[]) => {
    if (!fan) return;
    const mavzular = fan.mavzular.filter(m => yangiT.mavzular.includes(m.id));
    const rules: TopicRule[] = [];
    let jadvalYangi = qoldaJadval;
    if (yangiT.aralash !== 'qolda') {
      const r = taqsimla({ jami: yangiT.jami, ulush: QIYINLIK_ARALASHMASI[yangiT.aralash], mavzular: mavzular.map(m => ({ id: m.id, bor: m.bor.yopiq })) });
      jadvalYangi = new Map(mavzular.map(m => [`m${m.id}`, { mavzuId: m.id, nom: m.name, sonlar: [...r.jadval[m.id], 0] }]));
      // Tanlangan mavzularda yetmasa — qolgani fanning istalgan mavzusidan (tekshiruv yetmasligini ko'rsatadi).
      if (r.yetmadi) jadvalYangi.set('x', { mavzuId: null, nom: '', sonlar: [0, 0, 0, r.yetmadi] });
    }
    for (const [, q] of jadvalYangi || new Map()) {
      q.sonlar.forEach((n, i) => {
        if (n > 0) rules.push({ topic: q.nom, ...(q.mavzuId ? { mavzuId: q.mavzuId } : {}), type: 'yopiq', count: n, ...(i < 3 ? { difficulty: i + 1 } : {}) });
      });
    }
    for (const tur of ['raqamli', 'moslash', 'yozma'] as const) {
      const kerak = yangiT[tur] || 0;
      if (!kerak) continue;
      const yoy = tengYoy(kerak, mavzular.map(m => ({ id: m.id, bor: yig(m.bor[tur]) })));
      const points = tur === 'yozma' && yangiT.yozmaBal != null ? { points: yangiT.yozmaBal } : {};
      for (const m of mavzular) if (yoy.jadval[m.id]) rules.push({ topic: m.name, mavzuId: m.id, type: tur, count: yoy.jadval[m.id], ...points });
      if (yoy.yetmadi) rules.push({ topic: '', type: tur, count: yoy.yetmadi, ...points });
    }
    // Guruhli savollar: guruh butunligicha olinadi, shuning uchun mavzularga bo'linmaydi (fanning istalgan mavzusidan).
    if (yangiT.juft) rules.push({ topic: '', type: 'juft', count: yangiT.juft, ...(yangiT.juftBal != null ? { points: yangiT.juftBal } : {}) });
    if (yangiT.qismli) {
      const qism = qismSoni({ qism: yangiT.qismSoni });
      rules.push({ topic: '', type: 'qismli', count: yangiT.qismli * qism, qism, tekshir: qismTekshiruvi({ tekshir: yangiT.qismTekshir }), ...(yangiT.qismBal != null ? { points: yangiT.qismBal } : {}) });
    }
    rules.push(...(yangiQolda ?? qolda));
    onChange({ ...blok, fanId: fan.id, subject: fan.name, taqsimot: yangiT, topicRules: rules });
  };

  const fanTanla = (id: number) => {
    const f = daraxt.fanlar.find(x => x.id === id);
    if (!f) return;
    const yangiT: BlokTaqsimot = { jami: t.jami || 10, aralash: 'muvozanat', mavzular: f.mavzular.filter(m => yig(m.bor.yopiq) > 0).map(m => m.id), raqamli: 0, moslash: 0, yozma: 0, yozmaBal: null };
    const mavzular = f.mavzular.filter(m => yangiT.mavzular.includes(m.id));
    const r = taqsimla({ jami: yangiT.jami, ulush: QIYINLIK_ARALASHMASI.muvozanat, mavzular: mavzular.map(m => ({ id: m.id, bor: m.bor.yopiq })) });
    const rules: TopicRule[] = [];
    for (const m of mavzular) r.jadval[m.id].forEach((n, i) => { if (n) rules.push({ topic: m.name, mavzuId: m.id, type: 'yopiq', count: n, difficulty: i + 1 }); });
    if (r.yetmadi) rules.push({ topic: '', type: 'yopiq', count: r.yetmadi });
    onChange({ ...blok, fanId: f.id, subject: f.name, taqsimot: yangiT, topicRules: rules });
  };

  const mavzuAlmashtir = (id: number) => {
    const bor = t.mavzular.includes(id);
    const yangiT = { ...t, mavzular: bor ? t.mavzular.filter(x => x !== id) : [...t.mavzular, id] };
    if (t.aralash !== 'qolda') return qayta(yangiT);
    const j = new Map(jadval);
    if (bor) j.delete(`m${id}`);
    yangiT.jami = [...j.values()].reduce((a, q) => a + yig(q.sonlar), 0);
    qayta(yangiT, j);
  };

  const katak = (kalit: string, qator: Qator, i: number, qiymat: number) => {
    const j = new Map(jadval);
    const eski = j.get(kalit) || { mavzuId: qator.mavzuId, nom: qator.nom, sonlar: [0, 0, 0, 0] };
    const sonlar = [...eski.sonlar];
    sonlar[i] = Math.max(0, Math.min(300, qiymat || 0));
    j.set(kalit, { ...eski, sonlar });
    const yangiT = { ...t, aralash: 'qolda' as const, jami: [...j.values()].reduce((a, q) => a + yig(q.sonlar), 0) };
    if (qator.mavzuId && !yangiT.mavzular.includes(qator.mavzuId)) yangiT.mavzular = [...yangiT.mavzular, qator.mavzuId];
    qayta(yangiT, j);
  };

  // Jadval qatorlari: tanlangan mavzular, eski qoidalardagi (bankda yo'q) mavzular va "istalgan mavzu".
  const qatorlar: Qator[] = [];
  for (const m of tanlanganMavzular) {
    qatorlar.push({ kalit: `m${m.id}`, mavzuId: m.id, nom: m.name, sonlar: jadval.get(`m${m.id}`)?.sonlar || [0, 0, 0, 0], bor: [...m.bor.yopiq, yig(m.bor.yopiq)] });
  }
  for (const [kalit, q] of jadval) {
    if (kalit.startsWith('n:')) qatorlar.push({ kalit, mavzuId: null, nom: q.nom, sonlar: q.sonlar, bor: [0, 0, 0, 0] });
  }
  const fanBor = [0, 1, 2].map(i => (fan?.mavzular || []).reduce((a, m) => a + m.bor.yopiq[i], 0));
  qatorlar.push({ kalit: 'x', mavzuId: null, nom: '', sonlar: jadval.get('x')?.sonlar || [0, 0, 0, 0], bor: [...fanBor, yig(fanBor)] });

  const ustunJami = [0, 1, 2, 3].map(i => qatorlar.reduce((a, q) => a + q.sonlar[i], 0));
  // Bankda olib tashlangan qiyinlik darajasining ustuni ko'rinmaydi (eski qoidada soni bo'lmasa).
  useQiyinlik();
  const ustunBor = (i: number) => i === 3 || !QIYINLIK[i].yashirin || ustunJami[i] > 0;
  const tasodifiyYopiq = yig(ustunJami);
  const raqamliBor = (fan?.mavzular || []).filter(m => t.mavzular.includes(m.id)).reduce((a, m) => a + yig(m.bor.raqamli), 0);
  const yozmaBor = (fan?.mavzular || []).filter(m => t.mavzular.includes(m.id)).reduce((a, m) => a + yig(m.bor.yozma), 0);
  const moslashBor = (fan?.mavzular || []).filter(m => t.mavzular.includes(m.id)).reduce((a, m) => a + yig(m.bor.moslash || [0]), 0);
  const tMoslash = t.moslash || 0;
  const fandaRaqamli = (fan?.mavzular || []).some(m => yig(m.bor.raqamli) > 0) || t.raqamli > 0;
  const fandaYozma = (fan?.mavzular || []).some(m => yig(m.bor.yozma) > 0) || t.yozma > 0;
  const fandaMoslash = (fan?.mavzular || []).some(m => yig(m.bor.moslash || [0]) > 0) || tMoslash > 0;
  // Guruhli savollar fanning istalgan mavzusidan olinadi.
  const juftBor = (fan?.mavzular || []).reduce((a, m) => a + yig(m.bor.juft || [0]), 0);
  const qismBor = (fan?.mavzular || []).reduce((a, m) => a + yig(m.bor.qismli || [0]), 0);
  const tJuft = t.juft || 0;
  const tQismli = t.qismli || 0;
  const tQism = qismSoni({ qism: t.qismSoni });
  const fandaJuft = juftBor > 0 || tJuft > 0;
  const fandaQismli = qismBor > 0 || tQismli > 0;
  const qoldaSavol = qolda.reduce((a, r) => a + tanlanganSavollar(r).length / (r.type === 'qismli' ? qismSoni(r) : 1), 0);
  // Qismli savolning qismlari bitta savol sanaladi.
  const jamiSavol = blok.topicRules.reduce((a, r) => a + (Number(r.count) || 0) / (r.type === 'qismli' ? qismSoni(r) : 1), 0);
  const jamiBall = blok.topicRules.reduce((a, r) => a + (Number(r.count) || 0) * qoidaBali(r, blok, scoring), 0);
  const kamchilik = qatorlar.some(q => q.sonlar.some((n, i) => n > 0 && n * kopaytma > q.bor[i]))
    || (t.raqamli > 0 && t.raqamli * kopaytma > raqamliBor) || (t.yozma > 0 && t.yozma * kopaytma > yozmaBor)
    || (tMoslash > 0 && tMoslash * kopaytma > moslashBor)
    || (tJuft > 0 && tJuft * kopaytma > juftBor) || (tQismli > 0 && tQismli * tQism * kopaytma > qismBor);

  const guruhQoidasimi = (r: TopicRule) => r.type === 'juft' || r.type === 'qismli';
  const qoldaTanlandi = (ids: number[], turlar: Record<number, SavolTuri>, guruhlar: Record<number, TanlovGuruhi> = {}) => {
    // Turi: tanlash oynasida yuklanganidan, bo'lmasa oldingi qoidadan.
    const eskiTur = new Map<number, SavolTuri>();
    for (const r of qolda) for (const id of tanlanganSavollar(r) as number[]) eskiTur.set(id, (r.type || 'yopiq') as SavolTuri);
    const qoldi = new Set(ids);
    // Guruhli savol — har guruh o'z qoidasi: butunligicha qo'shiladi va butunligicha olinadi.
    // Oldin tanlangan guruh hamon to'liq tanlangan bo'lsa — qoidasi o'zicha qoladi.
    const guruhQoidalari: TopicRule[] = [];
    for (const r of qolda) {
      if (!guruhQoidasimi(r)) continue;
      const l = tanlanganSavollar(r) as number[];
      if (l.every(id => qoldi.has(id))) { guruhQoidalari.push(r); l.forEach(id => qoldi.delete(id)); } else l.forEach(id => qoldi.delete(id));
    }
    const yangiGuruhlar = new Map<number, number[]>();
    for (const id of [...qoldi]) {
      const tur = turlar[id] || eskiTur.get(id);
      if (tur !== 'juft' && tur !== 'qismli') continue;
      qoldi.delete(id);
      const pa = guruhlar[id]?.pa;
      if (pa) yangiGuruhlar.set(pa, [...(yangiGuruhlar.get(pa) || []), id]);
    }
    for (const azolar of yangiGuruhlar.values()) {
      const l = [...azolar].sort((a, b) => a - b);
      // Qismli savolda ko'pi bilan 4 qism (a–d) — ko'pi varaqqa sig'maydi (tanlash oynasi ham bunga yo'l qo'ymaydi).
      if (turlar[l[0]] === 'qismli' && l.length > 4) continue;
      if (turlar[l[0]] === 'juft') guruhQoidalari.push({ topic: '', type: 'juft', count: l.length, questionIds: l, ...(t.juftBal != null ? { points: t.juftBal } : {}) });
      else {
        // Skaner faqat hamma qismi son bo'lgan savolni tekshira oladi; aks holda — ustoz.
        const son = qismTekshiruvi({ tekshir: t.qismTekshir }) === 'son' && l.every(id => guruhlar[id]?.son);
        guruhQoidalari.push({ topic: '', type: 'qismli', count: l.length, qism: l.length, tekshir: son ? 'son' : 'ustoz', questionIds: l, ...(t.qismBal != null ? { points: t.qismBal } : {}) });
      }
    }
    const guruh: Record<SavolTuri, number[]> = { yopiq: [], raqamli: [], moslash: [], juft: [], qismli: [], yozma: [] };
    for (const id of qoldi) guruh[turlar[id] || eskiTur.get(id) || 'yopiq'].push(id);
    const yangi: TopicRule[] = (Object.keys(guruh) as SavolTuri[]).filter(k => guruh[k].length).map(k => ({
      topic: '', type: k, count: guruh[k].length, questionIds: guruh[k], ...(k === 'yozma' && t.yozmaBal != null ? { points: t.yozmaBal } : {}),
    }));
    qayta(t, t.aralash === 'qolda' ? jadval : undefined, [...yangi, ...guruhQoidalari]);
  };

  return (
    <div className="rounded-xl border border-chiziq bg-ichki/50 p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-52">
          <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">{index + 1}-fan</span>
          <select className={SELECT} disabled={qulf} value={fan?.id ?? ''} aria-label={`${index + 1}-blok fani`} onChange={e => fanTanla(Number(e.target.value))}>
            <option value="">{blok.subject && !fan ? `«${blok.subject}» — bankda yo'q, fanni tanlang` : 'Fanni tanlang'}</option>
            {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name} ({f.faol} ta savol)</option>)}
          </select>
        </label>
        {scoring === 'blok' && (
          <label className="w-32">
            <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Bir savol bali</span>
            <input className={INPUT} disabled={qulf} inputMode="decimal" value={blok.pointsPerQuestion} aria-label="Bir savol bali"
              onChange={e => onChange({ ...blok, pointsPerQuestion: Number(e.target.value.replace(',', '.')) || 0 })} />
          </label>
        )}
        <label className="w-28">
          <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Hisoblanadi</span>
          <input className={INPUT} disabled={qulf} inputMode="numeric" value={blok.tanlab ?? ''} placeholder="hammasi" aria-label="Nechta javob hisoblanadi"
            title="«m tadan n tasini yeching»: o'quvchi istalgan n tasini yechadi, birinchi n ta javob hisoblanadi"
            onChange={e => onChange({ ...blok, tanlab: parseInt(e.target.value.replace(/\D/g, '')) || null })} />
        </label>
        {!qulf && onOchir && <button aria-label="Blokni o'chirish" onClick={onOchir} className="mb-1 p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={15} /></button>}
      </div>

      {!qulf && (
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          <Tugma kichik turi={blok.andoza ? 'ikkinchi' : 'oddiy'} ikonka={<LayoutList size={13} />} onClick={() => setAndozaOchiq(true)}>
            {blok.andoza ? 'Boshqa andoza' : 'Andozadan'}
          </Tugma>
          {!blok.andoza && <span className="text-[11.5px] text-matn-xira">Savollar banki → Andoza (Blueprint) da saqlangan tuzilma</span>}
        </div>
      )}

      {fan && blok.andoza ? (
        <AndozaBloki blok={blok} fan={fan} kopaytma={kopaytma} scoring={scoring} qulf={qulf}
          onChiqish={() => onChange({ ...blok, andoza: null, taqsimot: undefined, topicRules: [] })} />
      ) : !fan ? (
        <p className="text-[12.5px] text-matn-sokin rounded-lg bg-sirt border border-chiziq px-3 py-2">Fan tanlangach — savollar soni, qiyinlik va mavzular.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <label className="w-28">
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Savollar soni</span>
              <input className={INPUT} type="number" min={0} max={300} disabled={qulf || t.aralash === 'qolda'} value={t.aralash === 'qolda' ? tasodifiyYopiq : t.jami} aria-label="Savollar soni"
                onChange={e => qayta({ ...t, jami: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })} />
            </label>
            <div>
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Qiyinlik</span>
              <div className="flex flex-wrap items-center gap-2">
                <Tanlov kichik qiymat={t.aralash === 'qolda' ? ('' as any) : t.aralash} onChange={v => !qulf && qayta({ ...t, aralash: v, jami: t.aralash === 'qolda' ? tasodifiyYopiq : t.jami })}
                  variantlar={ARALASH_NOMI.map(a => ({ v: a.v, nom: a.nom }))} />
                {t.aralash === 'qolda' && <span className="text-[11.5px] font-semibold text-ogoh">qo'lda taqsimlangan</span>}
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="text-[12px] font-semibold text-matn-sokin">Mavzular <span className="font-normal text-matn-xira">— {tanlanganMavzular.length} / {fan.mavzular.length} tanlangan</span></span>
              {!qulf && (
                <span className="flex gap-3 text-[11.5px]">
                  <button className="text-brand hover:underline cursor-pointer" onClick={() => qayta({ ...t, mavzular: fan.mavzular.filter(m => yig(m.bor.yopiq) > 0).map(m => m.id) })}>Hammasi</button>
                  <button className="text-matn-sokin hover:underline cursor-pointer" onClick={() => qayta({ ...t, mavzular: [] }, t.aralash === 'qolda' ? new Map([...jadval].filter(([k]) => !k.startsWith('m'))) : undefined)}>Tozalash</button>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fan.mavzular.map(m => {
                const bor = yig(m.bor.yopiq) + yig(m.bor.raqamli) + yig(m.bor.moslash || [0]) + yig(m.bor.yozma);
                const tanlangan = t.mavzular.includes(m.id);
                return (
                  <button key={m.id} type="button" disabled={qulf || (!bor && !tanlangan)} onClick={() => mavzuAlmashtir(m.id)} aria-pressed={tanlangan}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] cursor-pointer disabled:cursor-default disabled:opacity-40 ${tanlangan ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn'}`}>
                    {m.name}<span className={`raqam text-[11px] ${tanlangan ? 'opacity-80' : 'text-matn-xira'}`}>{bor}</span>
                  </button>
                );
              })}
              {!fan.mavzular.length && <span className="text-[12px] text-matn-xira">Fanda mavzu yo'q — bankda qo'shing</span>}
            </div>
          </div>

          {/* Telefonda — har mavzu alohida karta, to'rtta katak bir qatorda. */}
          <div className="sm:hidden space-y-2">
            {qatorlar.map(q => (
              <div key={q.kalit} className={`rounded-xl border border-chiziq p-2.5 ${q.kalit === 'x' ? 'bg-ichki/60' : 'bg-sirt'}`}>
                <div className="flex items-center justify-between gap-2 mb-2 text-[12.5px]">
                  <span className={`font-semibold truncate ${q.kalit === 'x' ? 'text-matn-sokin' : 'text-matn'}`}>{q.kalit === 'x' ? 'Istalgan mavzu' : q.nom}</span>
                  <span className="text-matn-xira shrink-0">jami <b className="text-matn raqam">{yig(q.sonlar)}</b></span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {q.sonlar.map((n, i) => ustunBor(i) && (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <span className={`text-[10.5px] font-semibold ${i < 3 ? QIYINLIK[i].matn : 'text-matn-sokin'}`}>{i < 3 ? QIYINLIK[i].nom : 'Aralash'}</span>
                      <Katak qator={q} i={i} n={n} kopaytma={kopaytma} disabled={qulf || q.kalit.startsWith('n:')} onChange={v => katak(q.kalit, q, i, v)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="flex flex-wrap justify-between gap-2 px-1 text-[12.5px] font-semibold text-matn">
              <span>Jami <span className="raqam">{tasodifiyYopiq}</span></span>
              <span className="flex gap-2">{ustunJami.slice(0, 3).map((n, i) => ustunBor(i) && <span key={i} className={`raqam ${QIYINLIK[i].matn}`}>{QIYINLIK[i].nom} {n}</span>)}{ustunJami[3] > 0 && <span className="raqam text-matn-sokin">aralash {ustunJami[3]}</span>}</span>
            </p>
          </div>
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-chiziq bg-sirt">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead className="bg-ichki text-matn-sokin">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Mavzu</th>
                  {QIYINLIK.map(q => ustunBor(q.d - 1) && <th key={q.d} className={`px-1 py-2 text-center font-semibold w-[76px] ${q.matn}`}>{q.nom}</th>)}
                  <th className="px-1 py-2 text-center font-semibold w-[76px]" title="Istalgan qiyinlikdan">Aralash</th>
                  <th className="px-2 py-2 text-center font-semibold w-12">Jami</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chiziq">
                {qatorlar.map(q => {
                  const bankdaYoq = q.kalit.startsWith('n:');
                  return (
                    <tr key={q.kalit} className={q.kalit === 'x' ? 'bg-ichki/40' : ''}>
                      <td className="px-3 py-1.5 text-matn">
                        {q.kalit === 'x' ? <span className="text-matn-sokin">Istalgan mavzu</span> : q.nom}
                        {bankdaYoq && <span className="ml-1.5 text-[11px] text-xato">bankda yo'q</span>}
                      </td>
                      {q.sonlar.map((n, i) => ustunBor(i) && (
                        <td key={i} className="px-1 py-1.5 text-center">
                          <Katak qator={q} i={i} n={n} kopaytma={kopaytma} disabled={qulf || bankdaYoq} onChange={v => katak(q.kalit, q, i, v)} />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-bold text-matn raqam">{yig(q.sonlar) || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-ichki">
                <tr>
                  <td className="px-3 py-2 font-semibold text-matn-sokin">Jami</td>
                  {ustunJami.map((n, i) => ustunBor(i) && <td key={i} className={`px-1 py-2 text-center font-bold raqam ${i < 3 && n ? QIYINLIK[i].matn : 'text-matn'}`}>{n}</td>)}
                  <td className="px-2 py-2 text-center font-bold text-matn raqam">{tasodifiyYopiq}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {(fandaRaqamli || fandaMoslash || fandaYozma || fandaJuft || fandaQismli) && (
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
              {fandaRaqamli && (
                <label className="flex items-end gap-2">
                  <span>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Raqamli javobli</span>
                    <input className={`${INPUT} w-24`} type="number" min={0} disabled={qulf} value={t.raqamli} aria-label="Raqamli javobli savollar soni"
                      onChange={e => qayta({ ...t, raqamli: Math.max(0, Number(e.target.value) || 0) }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </span>
                  <span className={`pb-2.5 text-[11.5px] ${t.raqamli * kopaytma > raqamliBor ? 'text-xato font-semibold' : 'text-matn-xira'}`}>tanlangan mavzularda {raqamliBor}</span>
                </label>
              )}
              {fandaMoslash && (
                <label className="flex items-end gap-2">
                  <span>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Moslashtirish</span>
                    <input className={`${INPUT} w-20`} type="number" min={0} disabled={qulf} value={tMoslash} aria-label="Moslashtirish savollari soni"
                      onChange={e => qayta({ ...t, moslash: Math.max(0, Number(e.target.value) || 0) }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </span>
                  <span className={`pb-2.5 text-[11.5px] ${tMoslash * kopaytma > moslashBor ? 'text-xato font-semibold' : 'text-matn-xira'}`}>bankda {moslashBor}</span>
                </label>
              )}
              {fandaYozma && (
                <label className="flex items-end gap-2">
                  <span>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Yozma</span>
                    <input className={`${INPUT} w-20`} type="number" min={0} disabled={qulf} value={t.yozma} aria-label="Yozma savollar soni"
                      onChange={e => qayta({ ...t, yozma: Math.max(0, Number(e.target.value) || 0) }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </span>
                  <span>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">har biri, ball</span>
                    <input className={`${INPUT} w-20`} inputMode="decimal" disabled={qulf} value={t.yozmaBal ?? ''} placeholder={String(blok.pointsPerQuestion)} aria-label="Yozma savol bali"
                      onChange={e => qayta({ ...t, yozmaBal: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || 0 }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </span>
                  <span className={`pb-2.5 text-[11.5px] ${t.yozma * kopaytma > yozmaBor ? 'text-xato font-semibold' : 'text-matn-xira'}`}>bankda {yozmaBor}</span>
                </label>
              )}
              {fandaJuft && (
                <div className="flex items-end gap-2" role="group" aria-label="Moslashtirish guruhi">
                  <label>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5" title="Bir nechta savol bitta umumiy javoblar ro'yxatidan (A–F) javob oladi. Guruh butunligicha olinadi.">Moslashtirish guruhi</span>
                    <input className={`${INPUT} w-20`} type="number" min={0} disabled={qulf} value={tJuft} aria-label="Moslashtirish guruhi savollari soni"
                      onChange={e => qayta({ ...t, juft: Math.max(0, Number(e.target.value) || 0) }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </label>
                  <label>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">har biri, ball</span>
                    <input className={`${INPUT} w-20`} inputMode="decimal" disabled={qulf} value={t.juftBal ?? ''} placeholder={String(blok.pointsPerQuestion)} aria-label="Moslashtirish guruhi savoli bali"
                      onChange={e => qayta({ ...t, juftBal: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || 0 }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </label>
                  <span className={`pb-2.5 text-[11.5px] ${tJuft * kopaytma > juftBor ? 'text-xato font-semibold' : 'text-matn-xira'}`}>bankda {juftBor} · guruh butun olinadi</span>
                </div>
              )}
              {fandaQismli && (
                <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Qismli savol">
                  <label>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5" title="Bitta raqam ostida a), b) qismlari: 36a, 36b.">Qismli savol (a, b)</span>
                    <input className={`${INPUT} w-20`} type="number" min={0} disabled={qulf} value={tQismli} aria-label="Qismli savollar soni"
                      onChange={e => qayta({ ...t, qismli: Math.max(0, Number(e.target.value) || 0) }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </label>
                  <label>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">qismlar</span>
                    <select className={`${SELECT} w-16`} disabled={qulf} value={tQism} aria-label="Bitta savoldagi qismlar soni"
                      onChange={e => qayta({ ...t, qismSoni: Number(e.target.value) }, t.aralash === 'qolda' ? jadval : undefined)}>
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">har qism, ball</span>
                    <input className={`${INPUT} w-20`} inputMode="decimal" disabled={qulf} value={t.qismBal ?? ''} placeholder={String(blok.pointsPerQuestion)} aria-label="Qism bali"
                      onChange={e => qayta({ ...t, qismBal: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || 0 }, t.aralash === 'qolda' ? jadval : undefined)} />
                  </label>
                  <label>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">javobni tekshiradi</span>
                    <select className={`${SELECT} w-44`} disabled={qulf} value={qismTekshiruvi({ tekshir: t.qismTekshir })} aria-label="Qism javobini kim tekshiradi"
                      onChange={e => qayta({ ...t, qismTekshir: e.target.value as 'son' | 'ustoz' }, t.aralash === 'qolda' ? jadval : undefined)}>
                      <option value="ustoz">Ustoz (yozma maydon)</option>
                      <option value="son">Skaner (son katagi)</option>
                    </select>
                  </label>
                  <span className={`pb-2.5 text-[11.5px] ${tQismli * tQism * kopaytma > qismBor ? 'text-xato font-semibold' : 'text-matn-xira'}`}>bankda {qismBor} qism</span>
                </div>
              )}
            </div>
          )}

          <QoldaTanlangan ids={qoldaIds} qulf={qulf} onTanla={() => setTanlashOchiq(true)} onOlib={id => {
            // Guruhli savolning bo'lagi olinsa — butun guruh (o'z qoidasi) olinadi.
            const qoldi = qolda.filter(r => !(guruhQoidasimi(r) && tanlanganSavollar(r).includes(id)))
              .map(r => ({ ...r, questionIds: tanlanganSavollar(r).filter(x => x !== id) })).filter(r => r.questionIds.length).map(r => ({ ...r, count: r.questionIds.length }));
            qayta(t, t.aralash === 'qolda' ? jadval : undefined, qoldi);
          }} />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-chiziq">
            <p className="text-[12.5px] text-matn">
              <b className="raqam">{jamiSavol}</b> ta savol
              {qoldaIds.length > 0 && <span className="text-matn-xira"> ({jamiSavol - qoldaSavol} tasodifiy + {qoldaSavol} tanlangan)</span>}
              {scoring === 'blok' && <> · <b className="raqam">{vergul(Math.round(jamiBall * 100) / 100)}</b> ball</>}
            </p>
            <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${kamchilik ? 'text-xato' : 'text-yaxshi'}`}>
              {kamchilik ? <><AlertTriangle size={13} /> bankda yetmaydi — qizil kataklarni kamaytiring</> : <><CheckCircle2 size={13} /> bankda yetadi</>}
            </span>
          </div>
        </>
      )}
      {andozaOchiq && (
        <AndozaTanlash daraxt={daraxt} onYop={() => setAndozaOchiq(false)} onTanla={(a, guruhlar) => {
          setAndozaOchiq(false);
          const f = daraxt.fanlar.find(x => x.id === a.subjectId);
          if (!f) return;
          onChange({ ...blok, fanId: f.id, subject: f.name, taqsimot: undefined, andoza: { id: a.id, nomi: a.name }, topicRules: andozadanQoidalar(a, f, guruhlar, t.yozmaBal) });
        }} />
      )}
      {tanlashOchiq && fan && (
        <SavolTanlash fan={fan} daraxt={daraxt} tanlangan={qoldaIds} onYop={() => setTanlashOchiq(false)}
          onTanla={(ids, turlar, guruhlar) => { setTanlashOchiq(false); qoldaTanlandi(ids, turlar, guruhlar); }} />
      )}
    </div>
  );
}

/** Qo'lda tanlangan savollar ro'yxati (qisqa) va "tanlash" tugmasi. */
function QoldaTanlangan({ ids, qulf, onTanla, onOlib }: { ids: number[]; qulf: boolean; onTanla: () => void; onOlib: (id: number) => void }) {
  const { soro } = useImtihonApi();
  const [savollar, setSavollar] = useState<Question[]>([]);
  const kalit = ids.join(',');
  useEffect(() => {
    if (!ids.length) { setSavollar([]); return; }
    soro<{ items: Question[] }>('GET', `questions?ids=${kalit}&soni=200`).then(r => {
      setSavollar(ids.map(id => r.items.find(q => q.id === id)).filter(Boolean) as Question[]);
    }).catch(() => {});
  }, [kalit, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Tugma kichik disabled={qulf} ikonka={<ListChecks size={14} />} onClick={onTanla}>{ids.length ? `Tanlangan savollar (${ids.length})` : 'Aniq savollarni tanlash'}</Tugma>
        {!ids.length && <span className="text-[11.5px] text-matn-xira">ixtiyoriy — bankdan fan → mavzu → qiyinlik bo'yicha</span>}
      </div>
      {savollar.length > 0 && (
        <ul className="rounded-xl border border-chiziq bg-sirt divide-y divide-chiziq">
          {savollar.map(q => (
            <li key={q.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]">
              <QiyinlikYorligi d={q.difficulty} />
              <span className="text-matn-xira shrink-0 truncate max-w-[30%]">{q.bankTopic?.name || q.topic}</span>
              <span className={`${SAVOL_MATNI} flex-1 min-w-0 line-clamp-1 text-matn [&_p]:inline [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
              {!qulf && <button aria-label="Olib tashlash" onClick={() => onOlib(q.id)} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Andozadan olingan blok: qatorlar va har biriga bankda nechta savol borligi. */
function AndozaBloki({ blok, fan, kopaytma, scoring, qulf, onChiqish }: {
  blok: ExamBlock; fan: BankFan; kopaytma: number; scoring: 'blok' | 'foiz'; qulf: boolean; onChiqish: () => void;
}) {
  const { soro } = useImtihonApi();
  const [hisob, setHisob] = useState<{ boshQolgan: number }[] | null>(null);
  const kalit = JSON.stringify(blok.topicRules);
  useEffect(() => {
    const rows = blok.topicRules.map(r => ({
      bolim: r.section || null, mavzuId: r.mavzuId || null, qiyinlik: r.difficulty || 0, manba: r.source || null,
      tagIds: r.tagIds || [], tur: r.type || 'yopiq', soni: (Number(r.count) || 0) * kopaytma,
    }));
    soro<{ qatorlar: { boshQolgan: number }[] }>('POST', 'bank/andozalar/hisob', { subjectId: fan.id, rows }).then(r => setHisob(r.qatorlar)).catch(() => setHisob(null));
  }, [kalit, fan.id, kopaytma, soro]); // eslint-disable-line react-hooks/exhaustive-deps
  const jami = blok.topicRules.reduce((a, r) => a + (Number(r.count) || 0), 0);
  const ball = blok.topicRules.reduce((a, r) => a + (Number(r.count) || 0) * qoidaBali(r, blok, scoring), 0);
  const yetmaydi = hisob?.some((h, i) => (Number(blok.topicRules[i]?.count) || 0) * kopaytma > h.boshQolgan);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-matn">Andoza: <b>{blok.andoza?.nomi}</b> <span className="text-matn-xira">· {blok.topicRules.length} qator</span></p>
        {!qulf && <button className="text-[11.5px] text-matn-sokin hover:text-xato hover:underline cursor-pointer" onClick={onChiqish}>Andozani olib tashlash</button>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-chiziq bg-sirt">
        <table className="w-full min-w-[420px] text-[12.5px]">
          <thead className="bg-ichki text-matn-sokin text-[11.5px]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Qator</th>
              <th className="px-2 py-2 text-left font-semibold w-24">Tur</th>
              <th className="px-2 py-2 text-center font-semibold w-14">Soni</th>
              <th className="px-2 py-2 text-center font-semibold w-20">Bankda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chiziq">
            {blok.topicRules.map((r, i) => {
              const kam = hisob ? (Number(r.count) || 0) * kopaytma > (hisob[i]?.boshQolgan ?? 0) : false;
              return (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-matn">{r.label || r.topic || 'Istalgan'}</td>
                  <td className="px-2 py-1.5 text-matn-sokin">{r.type === 'raqamli' ? 'Raqamli' : r.type === 'moslash' ? 'Moslashtirish' : r.type === 'yozma' ? 'Yozma' : r.type === 'juft' ? 'Moslashtirish guruhi' : r.type === 'qismli' ? `Qismli savol (${qismTekshiruvi(r) === 'son' ? 'skaner' : 'ustoz'})` : 'Variantli'}</td>
                  <td className="px-2 py-1.5 text-center font-bold raqam">{r.count}</td>
                  <td className={`px-2 py-1.5 text-center raqam ${kam ? 'text-xato font-bold' : 'text-matn-sokin'}`}>
                    {hisob ? hisob[i]?.boshQolgan ?? 0 : <Loader2 size={12} className="inline animate-spin" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-chiziq">
        <p className="text-[12.5px] text-matn"><b className="raqam">{jami}</b> ta savol{scoring === 'blok' && <> · <b className="raqam">{vergul(Math.round(ball * 100) / 100)}</b> ball</>}</p>
        <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${yetmaydi ? 'text-xato' : 'text-yaxshi'}`}>
          {yetmaydi ? <><AlertTriangle size={13} /> bankda yetmaydi — andozani yoki bankni to'ldiring</> : <><CheckCircle2 size={13} /> bankda yetadi</>}
        </span>
      </div>
    </div>
  );
}

/** Andoza tanlash oynasi (Savollar banki → Andoza da saqlanganlar). */
function AndozaTanlash({ daraxt, onYop, onTanla }: { daraxt: BankDaraxt; onYop: () => void; onTanla: (a: Andoza, guruhlar: BelgiGuruhi[]) => void }) {
  const { soro } = useImtihonApi();
  const [royxat, setRoyxat] = useState<Andoza[] | null>(null);
  const [guruhlar, setGuruhlar] = useState<BelgiGuruhi[]>([]);
  const [xato, setXato] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([soro<Andoza[]>('GET', 'bank/andozalar'), soro<BelgiGuruhi[]>('GET', 'bank/belgilar')])
      .then(([a, g]) => { setRoyxat(a); setGuruhlar(g); }).catch(e => setXato(e.message));
  }, [soro]);
  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Andoza tanlash">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-lg border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn">Andozadan</h3>
            <p className="text-[12px] text-matn-xira">Blokning fani va qoidalari andozadan olinadi</p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-3">
          {xato ? <p className="px-2 py-4 text-[12.5px] text-xato">{xato}</p>
            : !royxat ? <p className="px-2 py-6 text-center text-[12.5px] text-matn-xira"><Loader2 size={14} className="inline animate-spin" /> Yuklanmoqda</p>
            : !royxat.length ? <p className="px-2 py-6 text-center text-[12.5px] text-matn-xira">Andoza yo'q — Savollar banki → «Andoza (Blueprint)» da yarating</p>
            : (
              <ul className="divide-y divide-chiziq max-h-[60vh] overflow-y-auto">
                {royxat.map(a => {
                  const f = daraxt.fanlar.find(x => x.id === a.subjectId);
                  return (
                    <li key={a.id}>
                      <button disabled={!f} onClick={() => onTanla(a, guruhlar)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-50 disabled:cursor-default">
                        <span className="block text-[13px] font-semibold text-matn"><span className="text-matn-xira raqam">{a.id}-</span>{a.name}</span>
                        <span className="block text-[11.5px] text-matn-xira">{f?.name || 'fan topilmadi'} · {a.rows.length} qator · {a.rows.reduce((s, r) => s + r.soni, 0)} savol</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </div>
    </div>
  );
}

/** Jadval katagi: savollar soni va bankdagisi (yetmasa — qizil). */
function Katak({ qator, i, n, kopaytma, disabled, onChange }: { qator: Qator; i: number; n: number; kopaytma: number; disabled: boolean; onChange: (v: number) => void }) {
  const oshdi = n > 0 && n * kopaytma > qator.bor[i];
  const bankdaYoq = qator.kalit.startsWith('n:');
  return (
    <div className="inline-flex flex-col items-center">
      <input aria-label={`${qator.kalit === 'x' ? 'Istalgan mavzu' : qator.nom}: ${i < 3 ? QIYINLIK[i].nom : 'aralash'}`} inputMode="numeric" disabled={disabled}
        className={`w-12 rounded-lg border px-1 py-1 text-center text-[13px] raqam outline-none focus:border-brand ${n ? 'font-bold text-matn' : 'text-matn-xira'} ${oshdi ? 'border-xato bg-xato-fon' : 'border-chiziq bg-ichki'}`}
        value={n || ''} placeholder="0" onChange={e => onChange(parseInt(e.target.value.replace(/\D/g, '')))} />
      <span className={`text-[10px] raqam ${oshdi ? 'text-xato font-semibold' : 'text-matn-xira'}`}>{bankdaYoq ? '—' : `bankda ${qator.bor[i]}`}</span>
    </div>
  );
}
