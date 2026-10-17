import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Maydon, Tugma, INPUT, SELECT, Tanlov, Almashtirgich } from './ui';
import { SmsHisobi } from '../SmsHisobi';
import { STANDART_SHABLON, RUXSATNOMA_SHABLON, natijaXabari, ruxsatnomaMatni, sanaMatni, vergul, topshirishTuri, topshirishOnlayn } from '../../../lib/imtihon.js';
import { yangiImtihonBoshi } from '../../../lib/imtihonSozlama.js';
import type { ExamSettings } from '../../types';

// Imtihon sozlamasining bo'limlari — har biri o'zi ishlatiladigan bosqichda turadi
// (egasi, 2026-10-17): tuzilma — Imtihonlar tabida (ExamBuilder), o'tkazish — Qatnashchilar
// tabida, natija va xabar — Natijalar tabida. Markazning umumiy sozlamasi
// (ImtihonSozlamalari) xuddi shu bo'limlardan yig'iladi — ikki nusxa yo'q.

type S = ExamSettings;
/** Bo'lim faqat o'z kalitlarini o'zgartiradi. */
type Qoy<K extends keyof S> = (patch: Partial<Pick<S, K>>) => void;

/** Markazning umumiy sozlamasi (lib/imtihonSozlama.js shakli; GET/PUT /api/imtihon-sozlama). */
export interface ImtihonSozlama {
  yangi: {
    duration: number;
    scoring: 'blok' | 'foiz';
    settings: Pick<S, 'source' | 'sessions' | 'variantCount' | 'shuffleQuestions' | 'shuffleOptions' | 'variantBubble'
      | 'seatMode' | 'sessionFill' | 'onlayn' | 'xatoJarima' | 'jarimaNoldan' | 'otish' | 'ranking' | 'topN' | 'orinUsuli'
      | 'showQuestionsAfter' | 'rasch' | 'notify' | 'admit'>;
  };
}

// Manfiy ball: xato javob uchun savol balining qancha qismi ayiriladi (Addmen "negative marking").
export const JARIMALAR: { v: number; nom: string }[] = [
  { v: 0, nom: "Yo'q" }, { v: 0.25, nom: '¼' }, { v: 1 / 3, nom: '⅓' }, { v: 0.5, nom: '½' }, { v: 1, nom: "To'liq" },
];

export const NATIJA_OZGARUVCHILARI = '{ism} {imtihon} {sana} {ball} {maks} {foiz} {holat} {rasch} {daraja} {bloklar} {orin} {markaz} {havola}';
export const RUXSATNOMA_OZGARUVCHILARI = '{ism} {imtihon} {sana} {vaqt} {filial} {xona} {qator} {orin} {markaz}';

const KANALLAR = [
  { v: 'BOTH', nom: "Telegram, bo'lmasa SMS" }, { v: 'TELEGRAM', nom: 'Faqat Telegram' }, { v: 'SMS', nom: 'Faqat SMS' }, { v: 'NONE', nom: 'Yubormaslik' },
] as const;

/**
 * Xabar matni: tahrirlash maydoni, to'ldirilgan namuna va (SMS ketadigan kanalda) necha SMS
 * bo'lishi. `standart` — «Standart matn» tugmasi qaytaradigan matn.
 */
export function XabarShabloni({ nom, ozgaruvchilar, qiymat, onChange, standart, namuna, sms, qatorlar = 5 }: {
  nom: string; ozgaruvchilar: string; qiymat: string; onChange: (matn: string) => void;
  standart: string; namuna: string; sms: boolean; qatorlar?: number;
}) {
  return (
    <>
      <Maydon nom={nom} izoh={ozgaruvchilar}>
        <textarea rows={qatorlar} className={INPUT} value={qiymat} onChange={e => onChange(e.target.value)} />
      </Maydon>
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] text-matn-xira">Namuna:</p>
        {qiymat !== standart && <Tugma type="button" kichik turi="oddiy" onClick={() => onChange(standart)}>Standart matn</Tugma>}
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-ichki border border-chiziq p-3 text-[12.5px] text-matn font-sans">{namuna}</pre>
      {sms && <SmsHisobi matn={namuna} toldirilgan />}
    </>
  );
}

// ——— Tuzilma (qulfgacha) ———

/** Xato javob uchun jarima va «0 dan pastga tushmasin». */
export function JarimaTanlovi({ s, qoy, qulf }: { s: Pick<S, 'xatoJarima' | 'jarimaNoldan'>; qoy: Qoy<'xatoJarima' | 'jarimaNoldan'>; qulf?: boolean }) {
  return (
    <Maydon div nom="Xato javob uchun jarima" izoh={qulf ? "Savollar qulflangan — bu qism o'zgarmaydi" : s.xatoJarima
      ? `Har xato javobga savol balining ${JARIMALAR.find(j => j.v === s.xatoJarima)?.nom || s.xatoJarima} qismi ayiriladi; bo'sh javobga jarima yo'q`
      : "Yo'q — xato javob 0 ball (manfiy ball yo'q)"}>
      <div className="space-y-2">
        <Tanlov qiymat={s.xatoJarima} onChange={v => !qulf && qoy({ xatoJarima: v })} variantlar={JARIMALAR} />
        {s.xatoJarima > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-matn cursor-pointer">
            <input type="checkbox" disabled={qulf} className="w-3.5 h-3.5 accent-[var(--color-brand)]" checked={s.jarimaNoldan} onChange={e => qoy({ jarimaNoldan: e.target.checked })} />
            Har fan bali 0 dan pastga tushmasin
          </label>
        )}
      </div>
    </Maydon>
  );
}

// ——— O'tkazish (Qatnashchilar tabi) ———

const TOPSHIRISH_IZOHI = {
  qogoz: "Javob varaqasi chop etiladi, har qatnashchiga xona va o'rin beriladi",
  onlayn: "Hamma shaxsiy havola orqali telefonda yechadi (Telegram'da ham ochiladi). Xona va o'rin kerak emas",
  ikkalasi: "O'rin berilganlar zalda qog'ozda topshiradi, o'rinsizlar onlayn (ruxsatnomada test havolasi)",
} as const;

/** Qanday topshiriladi: qog'oz, onlayn yoki ikkalasi (onlayn.yoqilgan + onlayn.faqat). */
export function TopshirishTanlovi({ onlayn, onChange, kalitRejimi }: { onlayn: S['onlayn']; onChange: (o: S['onlayn']) => void; kalitRejimi?: boolean }) {
  const tur = topshirishTuri(onlayn) as keyof typeof TOPSHIRISH_IZOHI;
  return (
    <Maydon div nom="Qanday topshiriladi" izoh={tur !== 'qogoz' && kalitRejimi
      ? `${TOPSHIRISH_IZOHI[tur]}. «Faqat kalit»: savollar qog'oz kitobchada, javoblar onlayn varaqqa belgilanadi`
      : TOPSHIRISH_IZOHI[tur]}>
      <Tanlov qiymat={tur} onChange={v => onChange(topshirishOnlayn(v, onlayn))}
        variantlar={[{ v: 'qogoz', nom: "Qog'oz" }, { v: 'onlayn', nom: 'Onlayn' }, { v: 'ikkalasi', nom: 'Ikkalasi' }]} />
    </Maydon>
  );
}

/** Onlayn test vaqti: qachon ochiladi, yopiladi va har qatnashchiga necha daqiqa. */
export function OnlaynVaqti({ onlayn, onChange, davom }: { onlayn: S['onlayn']; onChange: (o: S['onlayn']) => void; davom: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Maydon nom="Ochiladi" izoh="Bo'sh — qulflangandan keyin darhol">
        <input type="datetime-local" className={INPUT} value={onlayn.ochiladi} onChange={e => onChange({ ...onlayn, ochiladi: e.target.value })} />
      </Maydon>
      <Maydon nom="Yopiladi" izoh="Bo'sh — cheklovsiz">
        <input type="datetime-local" className={INPUT} value={onlayn.yopiladi} onChange={e => onChange({ ...onlayn, yopiladi: e.target.value })} />
      </Maydon>
      <Maydon nom="Har qatnashchiga, daqiqa" izoh={`Bo'sh — imtihon davomiyligi (${davom})`}>
        <input type="number" min={0} max={600} className={INPUT} value={onlayn.daqiqa || ''} placeholder={String(davom)}
          onChange={e => onChange({ ...onlayn, daqiqa: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} />
      </Maydon>
    </div>
  );
}

/** Smenalar: nomi va vaqti. `sonOzgaradi` — qo'shish va o'chirish (soni variantlarga ta'sir qiladi). */
export function SmenalarRoyxati({ sessions, onChange, sonOzgaradi }: { sessions: S['sessions']; onChange: (l: S['sessions']) => void; sonOzgaradi?: boolean }) {
  const qoy = (i: number, patch: Partial<S['sessions'][number]>) => onChange(sessions.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {sessions.map((ss, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={INPUT} aria-label={`${i + 1}-smena nomi`} value={ss.name} onChange={e => qoy(i, { name: e.target.value })} />
          <input type="time" className={`${INPUT} w-32`} aria-label={`${i + 1}-smena vaqti`} value={ss.time} onChange={e => qoy(i, { time: e.target.value })} />
          {sonOzgaradi && sessions.length > 1 && (
            <button type="button" aria-label="Smenani o'chirish" onClick={() => onChange(sessions.filter((_, j) => j !== i))} className="p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      {sonOzgaradi && sessions.length < 10 && (
        <Tugma type="button" kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => onChange([...sessions, { id: sessions.length + 1, name: `${sessions.length + 1}-smena`, time: '' }])}>Smena qo'shish</Tugma>
      )}
    </div>
  );
}

const BOLISH_IZOHI = {
  teng: "Har smenaga teng sondagi qatnashchi",
  ketma: "Avval 1-smena to'ladi, sig'maganlar keyingisiga",
  kurs: "Har kurs butunligicha bitta smenada",
} as const;

/** Qatnashchilar smenalarga qanday bo'linadi. */
export function SmenagaBolish({ qiymat, onChange }: { qiymat: S['sessionFill']; onChange: (v: S['sessionFill']) => void }) {
  return (
    <Maydon div nom="Smenalarga bo'lish" izoh={BOLISH_IZOHI[qiymat]}>
      <Tanlov qiymat={qiymat} onChange={onChange} variantlar={[{ v: 'teng', nom: 'Teng' }, { v: 'ketma', nom: "Birinchisi to'lgach" }, { v: 'kurs', nom: 'Kurs bittada' }]} />
    </Maydon>
  );
}

/** O'rin tartibi: har o'rin yoki shaxmat. */
export function OrinTartibi({ qiymat, onChange }: { qiymat: S['seatMode']; onChange: (v: S['seatMode']) => void }) {
  return (
    <Maydon div nom="O'rin tartibi" izoh={qiymat === 'shaxmat' ? "Har o'rindan keyin bittasi bo'sh (oldida ham, yonida ham) — xonalar ikki barobar ko'p kerak" : "Xonadagi hamma o'rin ishlatiladi"}>
      <Tanlov qiymat={qiymat} onChange={onChange} variantlar={[{ v: 'hammasi', nom: "Har o'rin" }, { v: 'shaxmat', nom: 'Shaxmat tartibi' }]} />
    </Maydon>
  );
}

/** Ruxsatnoma: o'zi yuborilsinmi, kanal, kimga va matn. */
export function RuxsatnomaSozlamasi({ s, qoy, standart, namuna }: { s: Pick<S, 'admit'>; qoy: Qoy<'admit'>; standart: string; namuna: string }) {
  const a = s.admit;
  return (
    <div className="space-y-3">
      <Almashtirgich yoqilgan={a.auto} onChange={v => qoy({ admit: { ...a, auto: v } })}
        nom="Imtihondan bir kun oldin o'zi yuborilsin" izoh="Soat 12:00 dan keyin, o'rin berilgan qatnashchilarga. O'rni o'zgarganga yangisi ketadi." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Maydon nom="Kanal">
          <select className={SELECT} value={a.channel} onChange={e => qoy({ admit: { ...a, channel: e.target.value as S['admit']['channel'] } })}>
            {[KANALLAR[1], KANALLAR[0], KANALLAR[2], KANALLAR[3]].map(k => <option key={k.v} value={k.v}>{k.nom}</option>)}
          </select>
        </Maydon>
        <Maydon nom="Kimga">
          <select className={SELECT} value={a.to} onChange={e => qoy({ admit: { ...a, to: e.target.value as S['admit']['to'] } })}>
            <option value="ALL">O'quvchi va ota-onaga</option><option value="STUDENT">O'quvchiga</option><option value="PARENT">Ota-onaga</option>
          </select>
        </Maydon>
      </div>
      {a.channel !== 'NONE' && (
        <XabarShabloni nom="Matn" ozgaruvchilar={RUXSATNOMA_OZGARUVCHILARI} qiymat={a.template} standart={standart} qatorlar={6}
          onChange={template => qoy({ admit: { ...a, template } })} namuna={namuna} sms={a.channel !== 'TELEGRAM'} />
      )}
    </div>
  );
}

// ——— Natija (Natijalar tabi) ———

type NatijaKalitlari = 'otish' | 'ranking' | 'topN' | 'orinUsuli' | 'showQuestionsAfter' | 'rasch';

/** Natija qanday chiqadi: o'tish bali, reyting, teng ball, savollarni ko'rsatish, Rasch. */
export function NatijaQoidalari({ s, qoy, kalitRejimi }: { s: Pick<S, NatijaKalitlari>; qoy: Qoy<NatijaKalitlari>; kalitRejimi?: boolean }) {
  return (
    <div className="space-y-4">
      <Maydon div nom="O'tish bali" izoh={s.otish ? "Natijada «O'tdi / O'tmadi» chiqadi: hisobotlarda, xabarda va natija sahifasida" : "Yo'q — natijada o'tdi/o'tmadi ko'rsatilmaydi"}>
        <div className="flex items-center gap-2">
          <div className="w-28 shrink-0">
            <input type="number" min={0} step="0.1" inputMode="decimal" className={INPUT} placeholder="yo'q" aria-label="O'tish bali" value={s.otish?.qiymat ?? ''}
              onChange={e => { const q = Number(e.target.value); qoy({ otish: e.target.value === '' || !(q > 0) ? null : { turi: s.otish?.turi || 'foiz', qiymat: q } }); }} />
          </div>
          <Tanlov qiymat={s.otish?.turi || 'foiz'} onChange={v => s.otish && qoy({ otish: { ...s.otish, turi: v } })} variantlar={[{ v: 'foiz', nom: '%' }, { v: 'ball', nom: 'ball' }]} />
        </div>
      </Maydon>
      <Maydon div nom="Reyting">
        <div className="flex flex-wrap items-center gap-2">
          <Tanlov qiymat={s.ranking} onChange={v => qoy({ ranking: v })} variantlar={[{ v: 'hammasi', nom: "Hammaga o'rni" }, { v: 'top', nom: 'Faqat eng yaxshilar' }, { v: 'yoq', nom: "O'rin yo'q" }]} />
          {s.ranking === 'top' && <input type="number" min={1} className={`${INPUT} w-24`} value={s.topN} onChange={e => qoy({ topN: Number(e.target.value) || 10 })} aria-label="Nechta" />}
        </div>
      </Maydon>
      {s.ranking !== 'yoq' && (
        <Maydon div nom="Teng ball to'plaganlar" izoh={s.orinUsuli === 'ketma' ? "Bir o'rin, keyingisi ketma-ket: 1, 2, 2, 3" : "Bir o'rin, keyingisi tashlab: 1, 2, 2, 4 (musobaqa tartibi)"}>
          <Tanlov qiymat={s.orinUsuli} onChange={v => qoy({ orinUsuli: v })} variantlar={[{ v: 'otkazib', nom: '1, 2, 2, 4' }, { v: 'ketma', nom: '1, 2, 2, 3' }]} />
        </Maydon>
      )}
      <Almashtirgich yoqilgan={s.showQuestionsAfter} onChange={v => qoy({ showQuestionsAfter: v })}
        nom={kalitRejimi ? "Natijadan keyin o'quvchi har savoldagi javobini ko'radi" : "Natijadan keyin o'quvchi savollar va yechimlarni ko'radi"}
        izoh={kalitRejimi ? "Savol raqami, o'z javobi va to'g'ri javob (savol matni kitobchada)" : "Ko'rsatilgan savollar keyingi imtihonlarga tushmasligi kerak"} />
      <Almashtirgich yoqilgan={s.rasch.enabled} onChange={v => qoy({ rasch: { ...s.rasch, enabled: v } })}
        nom="Rasch bali (Milliy sertifikat uslubi)" izoh="Har qatnashchiga T-ball (o'rtacha 50) va daraja; reyting shu ball bo'yicha. Qiyin savolni topgan yuqoriroq turadi. Yozma savollar hisobga olinmaydi." />
      {s.rasch.enabled && (
        <Maydon div nom="Darajalar" izoh="Har daraja uchun eng kam T-ball">
          <div className="flex flex-wrap gap-1.5">
            {s.rasch.grades.map((g, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-chiziq bg-ichki px-2 py-1">
                <input aria-label="Daraja nomi" className="w-8 bg-transparent text-[12.5px] font-semibold text-matn outline-none" value={g.label}
                  onChange={e => qoy({ rasch: { ...s.rasch, grades: s.rasch.grades.map((x, j) => (j === i ? { ...x, label: e.target.value.slice(0, 6) } : x)) } })} />
                <span className="text-matn-xira text-[12px]">≥</span>
                <input aria-label={`${g.label} uchun eng kam ball`} inputMode="decimal" className="w-10 bg-transparent text-[12.5px] text-matn outline-none raqam" value={g.min}
                  onChange={e => qoy({ rasch: { ...s.rasch, grades: s.rasch.grades.map((x, j) => (j === i ? { ...x, min: Number(e.target.value.replace(',', '.')) || 0 } : x)) } })} />
              </span>
            ))}
          </div>
        </Maydon>
      )}
    </div>
  );
}

/** Natija xabari: kanal, kimga va matn. */
export function NatijaXabariSozlamasi({ s, qoy, standart, namuna }: { s: Pick<S, 'notify'>; qoy: Qoy<'notify'>; standart: string; namuna: string }) {
  const n = s.notify;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Maydon nom="Kanal">
          <select className={SELECT} value={n.channel} onChange={e => qoy({ notify: { ...n, channel: e.target.value as S['notify']['channel'] } })}>
            {KANALLAR.map(k => <option key={k.v} value={k.v}>{k.nom}</option>)}
          </select>
        </Maydon>
        <Maydon nom="Kimga">
          <select className={SELECT} value={n.to} onChange={e => qoy({ notify: { ...n, to: e.target.value as S['notify']['to'] } })}>
            <option value="PARENT">Ota-onaga</option><option value="STUDENT">O'quvchiga</option><option value="ALL">Ikkalasiga</option>
          </select>
        </Maydon>
      </div>
      {n.channel !== 'NONE' && (
        <XabarShabloni nom="Xabar matni" ozgaruvchilar={NATIJA_OZGARUVCHILARI} qiymat={n.template} standart={standart}
          onChange={template => qoy({ notify: { ...n, template } })} namuna={namuna} sms={n.channel !== 'TELEGRAM'} />
      )}
    </div>
  );
}

// ——— Namunalar ———

/** Natija xabarining to'ldirilgan namunasi (namuna o'quvchi bilan). */
export function natijaNamunasi(s: Pick<S, 'notify' | 'ranking' | 'rasch' | 'otish'>, d: { imtihon?: string; sana?: string; maks?: number; markaz: string; bloklar?: string }) {
  return natijaXabari(s.notify.template, {
    ism: 'ALIYEV VALI', imtihon: d.imtihon || 'Oylik sinov', sana: sanaMatni(d.sana || ''), ball: '142,3', maks: vergul(d.maks ?? 189), foiz: '75,3',
    bloklar: d.bloklar ?? '• Matematika: 25,3 / 31\n• Fizika: 21,7 / 31',
    orin: s.ranking === 'yoq' ? '' : s.ranking === 'top' ? "🏆 O'rni: umumiy 7-o'rin" : "🏆 O'rni: kursda 3/25 · umumiy 15/400",
    markaz: d.markaz, havola: `${window.location.origin}/natija/…`,
    rasch: s.rasch.enabled ? '63,2' : '', daraja: s.rasch.enabled ? s.rasch.grades[1]?.label || s.rasch.grades[0]?.label || '' : '',
    holat: s.otish ? "✅ O'tdi" : '',
  });
}

/** Ruxsatnomaning to'ldirilgan namunasi (1-smena vaqti bilan). */
export function ruxsatnomaNamunasi(s: Pick<S, 'admit' | 'sessions'>, d: { imtihon?: string; sana?: string; filial: string; markaz: string }) {
  return ruxsatnomaMatni(s.admit.template, {
    ism: 'ALIYEV VALI', imtihon: d.imtihon || 'Oylik sinov', sana: sanaMatni(d.sana || ''),
    vaqt: `${s.sessions[0]?.time || '09:00'}${s.sessions.length > 1 ? ` (${s.sessions[0]?.name})` : ''}`,
    filial: d.filial, xona: '7-xona', qator: 2, orin: 3, markaz: d.markaz,
  });
}

/**
 * Markazning standart xabar matnlari («Standart matn» tugmasi shularga qaytaradi).
 * O'qilmasa — tizim standarti.
 */
export function useMarkazMatnlari() {
  const { soro } = useImtihonApi();
  const [m, setM] = useState({ natija: STANDART_SHABLON, ruxsatnoma: RUXSATNOMA_SHABLON });
  useEffect(() => {
    let tirik = true;
    soro<{ sozlama: unknown }>('GET', 'imtihon-sozlama').then(r => {
      if (!tirik) return;
      const y = yangiImtihonBoshi(r.sozlama);
      setM({ natija: y.settings.notify.template, ruxsatnoma: y.settings.admit.template });
    }).catch(() => { /* tizim standarti qoladi */ });
    return () => { tirik = false; };
  }, [soro]);
  return m;
}

// ——— Bitta imtihonning sozlamasini o'z tabida saqlash ———

/** Sozlamaning bir qismini darhol saqlash (tanlov tugmalari uchun): PUT /exams/:id {settings: qism}. */
export function useSozlamaSaqla(examId: number, yangila: () => Promise<unknown>) {
  const { soro } = useImtihonApi();
  const { showNotification } = useCRM();
  const [band, setBand] = useState(false);
  const saqla = useCallback(async (body: { settings?: Partial<S>; branchIds?: number[] }) => {
    setBand(true);
    try {
      await soro('PUT', `exams/${examId}`, body);
      await yangila();
      return true;
    } catch (e: any) {
      showNotification(e.message, 'error');
      return false;
    } finally {
      setBand(false);
    }
  }, [examId, soro, yangila, showNotification]);
  return { saqla, band };
}

/**
 * Matn va vaqt yoziladigan bo'lim: o'zgartirilgani qoralamada turadi, «Saqlash» bosilganda
 * faqat `kalitlar` dagi sozlamalar yuboriladi. Serverdan yangisi kelsa — qoralama yangilanadi.
 */
export function SozlamaKartasi<K extends keyof S>({ exam, yangila, kalitlar, tahrir, sarlavha, izoh, className, children }: {
  exam: { id: number; settings: S }; yangila: () => Promise<unknown>; kalitlar: readonly K[]; tahrir: boolean;
  sarlavha: React.ReactNode; izoh?: React.ReactNode; className?: string;
  /** `ozgardi` — saqlanmagan o'zgarish bor (shu sozlama bilan ishlaydigan amallar kutib tursin). */
  children: (s: Pick<S, K>, qoy: Qoy<K>, ozgardi: boolean) => React.ReactNode;
}) {
  const { showNotification } = useCRM();
  const { saqla, band } = useSozlamaSaqla(exam.id, yangila);
  const saqlanganJson = JSON.stringify(Object.fromEntries(kalitlar.map(k => [k, exam.settings[k]])));
  const [q, setQ] = useState<Pick<S, K>>(() => JSON.parse(saqlanganJson));
  useEffect(() => { setQ(JSON.parse(saqlanganJson)); }, [saqlanganJson]);
  const ozgardi = JSON.stringify(q) !== saqlanganJson;
  const qoy: Qoy<K> = patch => { if (tahrir) setQ(x => ({ ...x, ...patch })); };

  const saqlash = async () => {
    if (await saqla({ settings: q as Partial<S> })) showNotification('Saqlandi', 'success');
  };

  return (
    <Karta sarlavha={sarlavha} izoh={izoh} className={className}>
      {/* Saqlanayotganda ham yopiq: server javobi kelgach qoralama yangilanadi, shu orada yozilgani yo'qolmasin. */}
      <fieldset disabled={!tahrir || band} className="min-w-0">
        {children(q, qoy, ozgardi)}
      </fieldset>
      {ozgardi && (
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-chiziq">
          <Tugma kichik turi="oddiy" disabled={band} onClick={() => setQ(JSON.parse(saqlanganJson))}>Bekor qilish</Tugma>
          <Tugma kichik turi="asosiy" ikonka={<Save size={13} />} yuklanmoqda={band} onClick={saqlash}>Saqlash</Tugma>
        </div>
      )}
    </Karta>
  );
}
