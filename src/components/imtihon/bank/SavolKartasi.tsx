import React, { useState } from 'react';
import { AlertTriangle, X, Pencil, Trash2, Check, FileText, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Yorliq, Tanlov, SELECT } from '../ui';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { natijaQiyinligi, qiyinlikMosEmas } from '../../../../lib/imtihon.js';
import SavolKorinishi from './SavolKorinishi';
import OxshashSavollar from './OxshashSavollar';
import { QiyinlikTanlov, QiyinlikYorligi, qiyinlikDaraja } from './qiyinlik';
import type { BankDaraxt, Question } from '../../../types';

// Mavzu ichidagi savol kartasi (formulalar bilan) va savol oynasi: to'liq
// ko'rinish, qiyinlik, mavzu va holatni shu yerning o'zida o'zgartirish.

const TUR_QISQA: Record<string, string> = { raqamli: 'Raqamli javob', yozma: 'Yozma' };
const HOLAT_NOMI: Record<string, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };

export function SavolKartasi({ q, onOch, tanlash, tanlangan, onTanla, sudrash }: {
  q: Question; onOch: () => void;
  /** Tanlash rejimi: kartani bosish belgilaydi. */
  tanlash?: boolean; tanlangan?: boolean; onTanla?: () => void;
  /** Kompyuterda kartani boshqa qiyinlik ustuniga sudrab o'tkazish. */
  sudrash?: boolean;
}) {
  const natija = natijaQiyinligi(q.pCorrect);
  const mosEmas = !!natija && !!q.usedCount && qiyinlikMosEmas(q.difficulty, q.pCorrect);
  return (
    <div
      draggable={sudrash && !tanlash}
      onDragStart={e => { e.dataTransfer.setData('text/savol', String(q.id)); e.dataTransfer.effectAllowed = 'move'; }}
      className={`group rounded-xl border bg-sirt transition-colors ${tanlangan ? 'border-brand ring-2 ring-brand/20' : 'border-chiziq hover:border-chiziq-kuchli'} ${q.status === 'arxiv' ? 'opacity-60' : ''}`}>
      <button type="button" onClick={tanlash ? onTanla : onOch} className="w-full text-left px-3 py-2.5 cursor-pointer" aria-pressed={tanlash ? !!tanlangan : undefined}>
        <div className="flex items-start gap-2">
          {tanlash && (
            <span className={`mt-0.5 w-4.5 h-4.5 shrink-0 rounded-md border flex items-center justify-center ${tanlangan ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq-kuchli bg-sirt'}`}>
              {tanlangan && <Check size={12} strokeWidth={3} />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className="text-[10.5px] text-matn-xira raqam">#{q.id}</span>
              {TUR_QISQA[q.type] && <Yorliq rang="brand">{TUR_QISQA[q.type]}</Yorliq>}
              {q.status && q.status !== 'faol' && <Yorliq rang="ogoh">{HOLAT_NOMI[q.status]}</Yorliq>}
              {q.xato && <Yorliq rang="xato"><AlertTriangle size={10} /> {q.xato}</Yorliq>}
              {q.passage && <Yorliq><FileText size={10} /> {q.passage.title || 'Matn'}</Yorliq>}
            </div>
            <div className={`${SAVOL_MATNI} text-[13px] text-matn line-clamp-3 [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) || (q.imageUrl ? '<p>[rasm]</p>' : '<p>—</p>') }} />
            {(!!q.usedCount || mosEmas) && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-matn-xira">
                {!!q.usedCount && <span>{q.usedCount} marta ishlatilgan</span>}
                {q.pCorrect != null && !!q.usedCount && <span className="raqam">{Math.round(q.pCorrect * 100)}% to'g'ri topgan</span>}
                {mosEmas && <span className="inline-flex items-center gap-1 text-ogoh font-semibold"><TrendingUp size={11} />natijaga ko'ra {qiyinlikDaraja(natija!).nom.toLowerCase()}</span>}
              </p>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

/** Savol oynasi: to'liq ko'rinish va tez o'zgartirishlar (qiyinlik, mavzu, holat). */
export function SavolOynasi({ q: boshQ, daraxt, onYop, onOzgardi }: {
  q: Question; daraxt: BankDaraxt | null; onYop: () => void; onOzgardi: () => void;
}) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const ochiradi = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [q, setQ] = useState(boshQ);
  const [band, setBand] = useState(false);
  const [oxshash, setOxshash] = useState(false);
  const natija = natijaQiyinligi(q.pCorrect);
  const fan = daraxt?.fanlar.find(f => f.mavzular.some(m => m.id === q.bankTopicId));
  const mavzu = fan?.mavzular.find(m => m.id === q.bankTopicId);

  const ozgartir = async (patch: { difficulty?: number; status?: string; bankTopicId?: number }, xabar: string) => {
    setBand(true);
    try {
      const r = await soro<{ yangilandi: number; chala: number }>('PUT', 'questions/bulk', { ids: [q.id], ...patch });
      if (patch.status === 'faol' && r.chala) throw new Error("Savol to'liq emas — faol qilish uchun tahrirlab, kamchiligini to'ldiring");
      setQ(x => ({ ...x, ...patch } as Question));
      showNotification(xabar, 'success');
      onOzgardi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const ochir = async () => {
    if (!(await confirm("Savol o'chirilsinmi?"))) return;
    try {
      await soro('DELETE', `questions/${q.id}`);
      showNotification("Savol o'chirildi", 'info');
      onOzgardi();
      onYop();
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={`Savol #${q.id}`}>
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-2xl border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn">Savol #{q.id}</h3>
            <p className="text-[12px] text-matn-xira truncate">{fan?.name || q.subject} › {mavzu?.name || q.topic}</p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <SavolKorinishi q={q} />
          {!!q.usedCount && (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-matn-sokin">
              <span>{q.usedCount} ta imtihonda ishlatilgan</span>
              {q.pCorrect != null && <span className="raqam">· {Math.round(q.pCorrect * 100)}% to'g'ri topgan</span>}
              {natija && <span className="inline-flex items-center gap-1">· natijaga ko'ra <QiyinlikYorligi d={natija} /></span>}
              {tahrir && natija && qiyinlikMosEmas(q.difficulty, q.pCorrect) && (
                <Tugma kichik turi="oddiy" ikonka={<TrendingUp size={13} />} disabled={band} onClick={() => ozgartir({ difficulty: natija }, 'Qiyinlik natijaga moslandi')}>Natijaga moslash</Tugma>
              )}
            </div>
          )}
          {tahrir && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-chiziq p-3">
              <div className="sm:col-span-2">
                <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Qiyinlik</p>
                <QiyinlikTanlov qiymat={qiyinlikDaraja(q.difficulty).d} onChange={d => d !== qiyinlikDaraja(q.difficulty).d && ozgartir({ difficulty: d }, `Qiyinlik: ${qiyinlikDaraja(d).nom.toLowerCase()}`)} />
              </div>
              <label className="block">
                <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Mavzu</span>
                <select className={SELECT} value={q.bankTopicId || ''} disabled={band} onChange={e => e.target.value && ozgartir({ bankTopicId: Number(e.target.value) }, "Savol boshqa mavzuga ko'chirildi")}>
                  {(daraxt?.fanlar || []).map(f => (
                    <optgroup key={f.id} label={f.name}>
                      {f.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div>
                <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Holati</span>
                <Tanlov kichik qiymat={(q.status || 'faol') as 'faol' | 'qoralama' | 'arxiv'} onChange={v => v !== q.status && ozgartir({ status: v }, `Holati: ${HOLAT_NOMI[v].toLowerCase()}`)}
                  variantlar={[{ v: 'faol', nom: 'Faol' }, { v: 'qoralama', nom: 'Qoralama' }, { v: 'arxiv', nom: 'Arxiv' }]} />
              </div>
            </div>
          )}
        </div>
        {tahrir && (
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-chiziq">
            {ochiradi ? <Tugma turi="xavfli" kichik ikonka={<Trash2 size={14} />} onClick={ochir}>O'chirish</Tugma> : <span />}
            <div className="flex flex-wrap justify-end gap-2">
              {daraxt && <Tugma ikonka={<Sparkles size={14} />} onClick={() => setOxshash(true)} title="AI shu savolga o'xshash, sonlari va javobi boshqa savollar tuzadi">O'xshash</Tugma>}
              <Tugma turi="asosiy" ikonka={<Pencil size={14} />} onClick={() => navigate(`/questions/${q.id}/edit`)}>Tahrirlash</Tugma>
            </div>
          </div>
        )}
      </div>
      {oxshash && daraxt && <OxshashSavollar daraxt={daraxt} asl={q} onYop={() => setOxshash(false)} onSaqlandi={onOzgardi} />}
    </div>
  );
}
