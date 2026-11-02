import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, XCircle, Search, Pause, SkipForward, Check } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT } from '../ui';
import { SARALASH, saralashKodi } from '../../../lib/omr/saralash';
import { W, H, type Sahifa, type Quti } from '../../../lib/omr/layout';
import type { Orin } from '../QatnashchilarTab';
import type { Element, OqishRejimi, Yuborish } from './turlar';

// Addmen «Alert» rejimi: muammoli (yoki «tasdiq» rejimida — har) varaq o'qilgach o'qish to'xtaydi
// va shu oyna chiqadi: varaq rasmi, muammo, uni shu yerning o'zida hal qilish (o'quvchini tanlash,
// takror ID da — eski va yangi varaq yonma-yon, shubhali javoblar — doirachalari kesib ko'rsatilgan).

/** Savol katagining varaqdagi joyi (mm) — rasmdan kesib ko'rsatish uchun. */
export function savolQutisi(sahifa: Sahifa | undefined, n: number): Quti | null {
  if (!sahifa) return null;
  const q = sahifa.yopiq.find(x => x.n === n);
  if (q && q.doiralar.length) {
    const r = q.doiralar[0].r;
    const xs = q.doiralar.map(d => d.x);
    const x0 = Math.min(...xs) - r - 9, x1 = Math.max(...xs) + r + 2;
    return { x: x0, y: q.doiralar[0].y - r - 1.6, w: x1 - x0, h: 2 * r + 3.2 };
  }
  const k = sahifa.raqamli.find(x => x.n === n) || (sahifa.moslash || []).find(x => x.n === n);
  return k ? { ...k.quti } : null;
}

/** Varaq rasmining bir bo'lagi (rasm — to'g'rilangan butun varaq, W × H mm). */
export function Kesim({ rasm, quti, kenglik }: { rasm: string; quti: Quti; kenglik: number }) {
  const k = kenglik / quti.w;
  return (
    <div role="img" aria-label="Varaqdan kesim" className="rounded-md border border-chiziq bg-white"
      style={{ width: kenglik, height: quti.h * k, backgroundImage: `url(${rasm})`, backgroundSize: `${W * k}px ${H * k}px`, backgroundPosition: `${-quti.x * k}px ${-quti.y * k}px`, backgroundRepeat: 'no-repeat' }} />
  );
}

type Props = {
  el: Element;
  sahifalar: Sahifa[];
  orinlar: Orin[];
  rejim: OqishRejimi;
  onYubor: (q: Yuborish) => Promise<void>;
  onDavom: () => void;
  onToxtat: () => void;
};

export default function VaraqKorigi({ el, sahifalar, orinlar, rejim, onYubor, onDavom, onToxtat }: Props) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [kod, setKod] = useState('');
  const [qidiruv, setQidiruv] = useState('');
  const [tanlov, setTanlov] = useState<Record<number, string>>({});
  const [band, setBand] = useState(false);
  const kodi = saralashKodi(el);
  const sahifa = sahifalar.find(x => x.page === el.oqish?.page);
  const shubhalar = useMemo(() => (el.holat === 'tayyor' ? (el.oqish?.shubhalar || []).filter(s => s.n > 0) : []), [el]);
  const mos = useMemo(() => (qidiruv.length < 2 ? [] : orinlar.filter(o => (o.studentId || o.mehmon) && o.name.toLowerCase().includes(qidiruv.toLowerCase())).slice(0, 6)), [qidiruv, orinlar]);
  const muammosiz = el.holat === 'tayyor' && !(el.natija?.shubhalar);
  const ishlanmoqda = el.holat === 'oqilmoqda' || el.holat === 'saqlanmoqda';

  // Ogohlantirib rejimida muammo shu yerda hal bo'lsa — o'zi davom etadi.
  useEffect(() => {
    if (rejim === 'ogoh' && muammosiz) onDavom();
  }, [rejim, muammosiz, onDavom]);

  useEffect(() => {
    const bos = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDavom(); }
    };
    window.addEventListener('keydown', bos);
    return () => window.removeEventListener('keydown', bos);
  }, [onDavom]);

  const yubor = async (q: Yuborish) => {
    setBand(true);
    try { await onYubor(q); } finally { setBand(false); }
  };

  /** Shubhali javoblar bo'yicha operator qarori (Tekshirish oynasidagi kabi) va davom. */
  const javoblarniSaqla = async () => {
    const manual = Object.fromEntries(Object.entries(tanlov));
    if (!Object.keys(manual).length || !el.natija?.id) { onDavom(); return; }
    setBand(true);
    try {
      await soro('PUT', `exam-results/${el.natija.id}/review`, { manual });
      onDavom();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const sarlavhaIkonka = muammosiz ? <CheckCircle2 size={18} className="text-yaxshi" />
    : el.holat === 'tayyor' ? <AlertTriangle size={18} className="text-ogoh" /> : <XCircle size={18} className="text-xato" />;
  const qr = el.oqish?.qr;
  const kimgaKod = qr?.turi !== 'U' && !el.takrorId?.kimga.studentId;

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Varaq ko'rigi">
      <div className="bg-sirt rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-chiziq">
          {sarlavhaIkonka}
          <h2 className="text-[14.5px] font-semibold text-matn truncate">{el.natija?.name || el.takrorId?.name || el.nom}</h2>
          {kodi && <span className="px-1.5 rounded bg-ichki border border-chiziq text-[11px] font-bold font-mono text-matn-sokin" title={SARALASH[kodi]}>{kodi}</span>}
          <span className="text-[12px] text-matn-xira truncate">{el.nom}{el.oqish?.page ? ` · ${el.oqish.page}-sahifa` : ''}</span>
          <span className="ml-auto text-[11.5px] text-matn-xira shrink-0">O'qish to'xtab turibdi</span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 p-5">
          <div className="min-w-0 space-y-2">
            {el.takrorId ? (
              <div className="grid grid-cols-2 gap-3">
                {[['Avval o\'qilgan', el.takrorId.oldingiRasm], ['Hozirgi varaq', el.rasm]].map(([nom, src]) => (
                  <figure key={nom as string} className="space-y-1">
                    <figcaption className="text-[11.5px] font-semibold text-matn-sokin">{nom}</figcaption>
                    {src ? <img src={src as string} alt={nom as string} className="w-full rounded-lg border border-chiziq bg-white" /> : <div className="aspect-[210/297] rounded-lg border border-dashed border-chiziq grid place-items-center text-[12px] text-matn-xira">Rasm yo'q</div>}
                  </figure>
                ))}
              </div>
            ) : el.rasm ? (
              <img src={el.rasm} alt="O'qilgan varaq" className="w-full max-h-[70vh] object-contain rounded-lg border border-chiziq bg-white" />
            ) : (
              <div className="aspect-[210/297] max-h-[60vh] rounded-lg border border-dashed border-chiziq grid place-items-center text-[12.5px] text-matn-xira px-6 text-center">Varaq rasmi yo'q — fayl o'qilmadi</div>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            {el.xato && <p className={`text-[13px] ${el.holat === 'xato' ? 'text-xato' : 'text-matn'}`}>{el.xato}</p>}
            {kodi && <p className="text-[12px] text-matn-sokin"><b className="font-mono">{kodi}</b> — {SARALASH[kodi]}</p>}
            {el.natija && (
              <p className="text-[13px] text-matn"><b>{el.natija.score}</b> ball{el.natija.shubhalar ? ` · ${el.natija.shubhalar} ta shubhali javob` : ''}{el.natija.takror ? ' · bu varaq oldin ham skanerlangan' : ''}</p>
            )}

            {el.holat === 'aniqlanmadi' && el.oqish?.ok && (
              <div className="space-y-2.5">
                {el.takrorId && (
                  <div className="rounded-xl border border-ogoh/30 bg-ogoh-fon px-3 py-2.5 space-y-2">
                    <p className="text-[12.5px] text-matn">Agar bu o'sha o'quvchining qayta to'ldirilgan varag'i bo'lsa — eski javoblar o'rniga yoziladi. Boshqa o'quvchiniki bo'lsa — pastda tanlang.</p>
                    <Tugma kichik turi="asosiy" disabled={band} onClick={() => yubor({ ...el.takrorId!.kimga, takror: 'almashtir' })}>Almashtirish — bu {el.takrorId.name || 'o\'sha qatnashchi'}niki</Tugma>
                  </div>
                )}
                <p className="text-[12.5px] font-semibold text-matn-sokin">{el.takrorId ? 'Yoki boshqa qatnashchiga yozish:' : 'Varaq kimniki?'}</p>
                {kimgaKod ? (
                  <div className="flex flex-wrap gap-2">
                    <input autoFocus className={`${INPUT} w-44 py-1.5 font-mono uppercase`} placeholder="Varaq kodi" value={kod} onChange={e => setKod(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === 'Enter' && kod.length >= 5) yubor({ sheetCode: kod }); }} />
                    <Tugma kichik turi="asosiy" disabled={kod.length < 5 || band} onClick={() => yubor({ sheetCode: kod })}>Saqlash</Tugma>
                  </div>
                ) : null}
                <div className="relative max-w-sm">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-matn-xira" />
                  <input autoFocus={!kimgaKod} className={`${INPUT} py-1.5 pl-8`} placeholder="O'quvchi ismi" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
                  {mos.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-chiziq bg-sirt shadow-lg">
                      {mos.map(o => (
                        <button key={o.id} type="button" disabled={band} onClick={() => yubor(o.studentId ? { studentId: o.studentId, session: o.session } : { sheetCode: o.sheetCode })}
                          className="block w-full text-left px-3 py-2 text-[12.5px] hover:bg-ichki cursor-pointer">
                          {o.name} <span className="text-matn-xira">· {o.mehmon ? 'tashqi' : o.groupName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {shubhalar.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12.5px] font-semibold text-matn-sokin">Shubhali javoblar — to'g'risini belgilang (tanlanmagani keyin «Muammolar»da qoladi):</p>
                <ul className="space-y-2">
                  {shubhalar.map(s => {
                    const quti = savolQutisi(sahifa, s.n);
                    const yq = sahifa?.yopiq.find(x => x.n === s.n);
                    const harflar = yq ? yq.doiralar.map(d => d.v) : null;
                    return (
                      <li key={s.n} className="rounded-xl border border-chiziq px-3 py-2 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
                          <b className="text-matn">{yq?.y || s.n}-savol</b>
                          <span className="text-matn-xira">{s.sabab}</span>
                          <span className="ml-auto text-matn-sokin">o'qildi: <b className="font-mono">{el.oqish?.javoblar[s.n] || '—'}</b></span>
                        </div>
                        {el.rasm && quti && <Kesim rasm={el.rasm} quti={quti} kenglik={Math.min(360, quti.w * 7)} />}
                        {harflar ? (
                          <div className="flex flex-wrap gap-1" role="group" aria-label={`${s.n}-savol javobi`}>
                            {[...harflar, ''].map((h, j) => (
                              <button key={h || 'bosh'} type="button" aria-pressed={tanlov[s.n] === h}
                                onClick={() => setTanlov(t => ({ ...t, [s.n]: h }))}
                                className={`min-w-9 h-8 px-2 rounded-lg border text-[12.5px] font-semibold cursor-pointer ${tanlov[s.n] === h ? 'bg-brand text-brand-ust border-brand' : 'bg-ichki border-chiziq hover:border-brand'}`}>
                                {h || "bo'sh"}
                                {h && s.f?.[j] != null && <span className="ml-1 text-[10px] font-normal opacity-70">{Math.round(s.f[j] * 100)}%</span>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input className={`${INPUT} py-1.5 w-48 font-mono`} placeholder="Javob" value={tanlov[s.n] ?? ''} onChange={e => setTanlov(t => ({ ...t, [s.n]: e.target.value.trim() }))} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-chiziq bg-ichki/50">
          <Tugma kichik ikonka={<Pause size={14} />} disabled={band} onClick={onToxtat}>O'qishni to'xtatish</Tugma>
          <div className="flex flex-wrap gap-2">
            {!muammosiz && (
              <Tugma kichik ikonka={<SkipForward size={14} />} disabled={band || ishlanmoqda} onClick={onDavom} title="Esc">Keyin hal qilaman</Tugma>
            )}
            {shubhalar.length > 0 ? (
              <Tugma kichik turi="asosiy" ikonka={<Check size={14} />} yuklanmoqda={band} onClick={javoblarniSaqla}>Saqlash va davom</Tugma>
            ) : muammosiz ? (
              <Tugma kichik turi="asosiy" ikonka={<Check size={14} />} autoFocus onClick={onDavom}>Tasdiqlash va davom</Tugma>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
