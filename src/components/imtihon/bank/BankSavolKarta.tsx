import React, { memo, useMemo } from 'react';
import { Check, Folder, Lightbulb, MoreHorizontal } from 'lucide-react';
import { Yorliq } from '../ui';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../../lib/matn';
import { TUR_NOMI } from '../../../lib/savolTuri';
import { HARFLAR } from '../../../../lib/imtihon.js';
import MoslashJadvali from './MoslashJadvali';
import { CHIP_BOR, CHIP_BOSH, type BankQatori, type MenyuTuri } from './bankTurlari';
import type { BelgiGuruhi } from '../../../types';

/**
 * Bank ro'yxatidagi savol kartasi: matn (formulalar bilan), variantlar va to'g'ri javob ochmasdan
 * ko'rinadi. Yorliqlar (mavzu, qiyinlik, filtrlar) bosilsa — shu yerning o'zida o'zgartiriladi;
 * karta chapdagi mavzu yoki filtr qatoriga sudrab tashlanadi. Yechimi bor savolda — sokin
 * «Yechim» belgisi (bosilsa yechim ochiladi); yechim amallari — «⋯» menyusida.
 */
export default memo(function BankSavolKarta({ q, raqam, tanlangan, yangi, tanlanadi, tahrir, mavzu, darajaNom, darajaNuqta, guruhlar, onTanla, onKor, onSudra, onMenyu, onYechim }: {
  q: BankQatori;
  /** Ro'yxatdagi tartib raqami — har ko'rinishda (fan, bo'lim, mavzu, filtr) 1 dan boshlanadi. */
  raqam: number;
  tanlangan: boolean; yangi: boolean; tanlanadi: boolean; tahrir: boolean; mavzu: string; darajaNom: string; darajaNuqta: string; guruhlar: BelgiGuruhi[];
  onTanla: (id: number) => void; onKor: (id: number) => void; onSudra?: (id: number, e: React.DragEvent) => void;
  onMenyu: (tur: MenyuTuri, el: HTMLElement, id: number, guruh?: number) => void;
  /** Yechimni ko'rish (berilmasa — belgi chiqmaydi). */
  onYechim?: (id: number) => void;
}) {
  const html = useMemo(() => formulaliHtml(q.text || ''), [q.text]);
  const variantlar = useMemo(() => (q.options || []).map(o => formulaliHtml(o)), [q.options]);
  const qisqa = useMemo(() => (q.options || []).every(o => oddiyMatn(o).length <= 22 && !/<img/i.test(o)), [q.options]);
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  const raqamliJavob = q.type === 'raqamli' ? [...new Set([q.correctAnswer, ...(q.answers || [])].filter(Boolean))].join(' · ') : '';
  const teglar = q.tagIds || [];
  /** Yorliq: tahrir huquqi bo'lsa — tugma (menyu ochadi), bo'lmasa oddiy yozuv. */
  const yorliq = (tur: MenyuTuri, sinf: string, nom: string, ichi: React.ReactNode, guruh?: number) => (tahrir
    ? <button key={`${tur}${guruh || ''}`} type="button" title={nom} aria-label={`#${q.id}: ${nom}`} aria-haspopup="menu" className={`${sinf} cursor-pointer hover:border-brand`} onClick={e => onMenyu(tur, e.currentTarget, q.id, guruh)}>{ichi}</button>
    : <span key={`${tur}${guruh || ''}`} title={nom} className={sinf}>{ichi}</span>);

  return (
    <li draggable={!!onSudra} onDragStart={onSudra ? e => onSudra(q.id, e) : undefined} onDoubleClick={() => onKor(q.id)}
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 pl-2.5 pr-3 py-3 rounded-xl border transition-colors ${tanlangan ? 'border-brand bg-brand-fon/50 dark:bg-brand/10' : 'border-chiziq bg-sirt'} ${onSudra ? 'cursor-grab' : ''} ${q.status === 'arxiv' ? 'opacity-60' : ''}`}>
      <div className="pt-0.5">
        {tanlanadi ? <input type="checkbox" aria-label={`#${q.id} savolni tanlash`} className="w-[17px] h-[17px] accent-[var(--color-brand)] cursor-pointer" checked={tanlangan} onChange={() => onTanla(q.id)} /> : <span className="block w-1" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="raqam text-[13px] font-bold text-matn mr-0.5">{raqam}.</span>
          {yangi && <span className="px-1.5 py-0.5 rounded-md bg-yaxshi-fon text-yaxshi text-[10.5px] font-bold">yangi</span>}
          {yorliq('mavzu', mavzu ? CHIP_BOR : CHIP_BOSH, mavzu ? `mavzu — ${mavzu}` : 'mavzusi yo\'q', <><Folder size={12} className="shrink-0" /><span className="truncate max-w-56">{mavzu || 'mavzu?'}</span></>)}
          {yorliq('daraja', CHIP_BOR, `qiyinlik — ${darajaNom}`, <><span className={`w-2 h-2 rounded-full shrink-0 ${darajaNuqta}`} /><span className="truncate max-w-40">{darajaNom}</span></>)}
          {guruhlar.map(g => {
            const t = g.tags.find(x => teglar.includes(x.id));
            if (t) return yorliq('guruh', CHIP_BOR, `${g.name} — ${t.name}`, <span className="truncate max-w-40">{t.name}</span>, g.id);
            return g.tags.length && tahrir ? yorliq('guruh', CHIP_BOSH, `${g.name} qo'yilmagan`, <span className="truncate max-w-40">{g.name.toLowerCase()}?</span>, g.id) : null;
          })}
          {q.type !== 'yopiq' && <Yorliq rang="brand">{TUR_NOMI[q.type]}</Yorliq>}
          {q.status === 'qoralama' && <Yorliq rang="ogoh">Qoralama</Yorliq>}
          {q.status === 'arxiv' && <Yorliq>Arxiv</Yorliq>}
          {q.passageId && <Yorliq>matnli</Yorliq>}
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-matn-xira">
            {q.yechimBor && onYechim && (
              <button type="button" onClick={() => onYechim(q.id)} aria-label={`#${q.id} — yechimni ko'rish`}
                title={q.solutionStatus === 'tasdiqlangan' ? "Yechimi bor — ko'rish" : "Yechimi bor (tasdiqlanmagan) — ko'rish"}
                className="inline-flex items-center gap-1 font-semibold text-matn-sokin hover:text-brand cursor-pointer"><Lightbulb size={12} />Yechim</button>
            )}
            {!!q.usedCount && <span>{q.usedCount} marta ishlatilgan</span>}
            <span className="raqam" title="Savolning bankdagi doimiy raqami (ID) — qaysi mavzuda turishidan qat'i nazar o'zgarmaydi">ID {q.id}</span>
            <button type="button" aria-label={`#${q.id} — amallar`} title="Ochish, yechim, o'chirish" aria-haspopup="menu" onClick={e => onMenyu('savol', e.currentTarget, q.id)}
              className="p-1 -mr-1 rounded-lg text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer"><MoreHorizontal size={16} /></button>
          </span>
        </div>
        <div className={`${SAVOL_MATNI} mt-1.5 text-[14px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: html || '<p>—</p>' }} />
        {q.imageUrl && <img src={q.imageUrl} alt="" loading="lazy" draggable={false} className="mt-2 max-h-40 rounded-lg border border-chiziq bg-white" />}
        {q.type === 'yopiq' && variantlar.length > 0 && (
          <ol className={`mt-2 grid gap-1.5 ${q.joylashuv === 1 ? 'grid-cols-1' : q.joylashuv === 2 ? 'grid-cols-2' : q.joylashuv === 4 || qisqa ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {variantlar.map((h, i) => (
              <li key={i} className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] border ${i === togri ? 'bg-yaxshi-fon border-yaxshi/40 text-matn' : 'bg-ichki border-chiziq text-matn'}`}>
                <b className={`shrink-0 ${i === togri ? 'text-yaxshi' : 'text-matn-xira'}`}>{HARFLAR[i]})</b>
                <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0 [&_img]:max-h-24`} dangerouslySetInnerHTML={{ __html: h }} />
                {i === togri && <Check size={14} strokeWidth={3} className="shrink-0 mt-0.5 text-yaxshi" aria-label="to'g'ri javob" />}
              </li>
            ))}
          </ol>
        )}
        {q.type === 'yopiq' && togri < 0 && <p className="mt-1.5 text-[11.5px] font-semibold text-xato">To'g'ri javob belgilanmagan</p>}
        {q.type === 'raqamli' && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-yaxshi-fon ring-1 ring-yaxshi/35 px-2.5 py-1 text-[12.5px]">
            <span className="text-matn-sokin">Javob:</span><b className="text-yaxshi raqam">{raqamliJavob || '—'}</b>
          </p>
        )}
        {q.type === 'moslash' && <div className="mt-2"><MoslashJadvali ixcham chap={q.options || []} ong={q.answers || []} kalit={q.correctAnswer || ''} /></div>}
        {q.type === 'yozma' && <p className="mt-2 text-[12px] text-matn-xira">Yozma javob — ustoz baholaydi{q.points ? ` (${q.points} ball)` : ''}</p>}
        {(q.source || q.toplam || q.remark) && <p className="mt-1.5 text-[11px] text-matn-xira">{[q.source, q.toplam && `fayl: ${q.toplam}`, q.remark && `izoh: ${q.remark}`].filter(Boolean).join(' · ')}</p>}
      </div>
    </li>
  );
});
