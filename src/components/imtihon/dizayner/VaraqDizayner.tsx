import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Save, Plus, Minus, Trash2, Copy, Wand2, ListChecks, Hash, Grid3x3, PenLine, Type, ImagePlus, AlertTriangle, CheckCircle2, MousePointer2 } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT, SELECT, Tanlov } from '../ui';
import {
  W, H, ANDOZA_MAYDONI, SAVOL_BLOKLARI, andozaSahifalari, andozaXatolari, blokOlchami, blokNomi, tuzilmadanAndoza,
  type AndozaBlok, type AndozaTuri, type VaraqParametrlari,
} from '../../../lib/omr/layout';
import { varaqSvg } from '../../../lib/omr/render';
import type { VaraqAndozaYozuvi } from '../../../types';

// Erkin javob varaqasi dizayneri (Addmen "OMR Designer"): varaq sarlavhasi (markerlar,
// QR, ID, variant) standart, uning ostiga bloklar sichqoncha bilan joylanadi —
// variantli savollar, raqamli kataklar, moslash to'rlari, yozma maydon, yozuv va rasm.
// Savol bloklarining o'lchami savollar soni va ustunlardan kelib chiqadi (doirachalar
// oralig'i o'qigichga mos qolsin). Tekshiruv: har savol bir marta, o'z turida, ustma-ust
// va maydondan chiqqan blok yo'q.

export interface DizaynerBoshi { id?: number; name: string; sahifalar: number; bloklar: AndozaBlok[] }

const TUR_NOMI: Record<AndozaTuri, string> = { yopiq: 'Variantli (MCQ)', raqamli: 'Raqamli javob', moslash: 'Moslashtirish', yozma: 'Yozma javob', matn: 'Yozuv', rasm: 'Rasm' };
const TUR_IKONKA: Record<AndozaTuri, React.ReactNode> = {
  yopiq: <ListChecks size={15} />, raqamli: <Hash size={15} />, moslash: <Grid3x3 size={15} />, yozma: <PenLine size={15} />, matn: <Type size={15} />, rasm: <ImagePlus size={15} />,
};
const yangiId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const RASM_MAX = 380000;

/** Rasmni kichraytirib data URL qiladi (andozada 400 KB gacha). */
async function rasmniTayyorla(fayl: File): Promise<{ src: string; nisbat: number }> {
  const url = await new Promise<string>((ok, xato) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = xato; r.readAsDataURL(fayl); });
  const img = new Image();
  img.src = url;
  await img.decode();
  const nisbat = img.naturalHeight / Math.max(1, img.naturalWidth);
  let eng = 900;
  for (let i = 0; i < 6; i++) {
    const k = Math.min(1, eng / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d')!;
    const png = fayl.type === 'image/png' || fayl.type === 'image/gif';
    if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0, c.width, c.height);
    const src = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
    if (src.length <= RASM_MAX) return { src, nisbat };
    eng = Math.round(eng * 0.7);
  }
  throw new Error('Rasm juda katta — kichikroq rasm tanlang');
}

export default function VaraqDizayner({ boshi, params, umumiy, onYop, onSaqlandi }: {
  boshi: DizaynerBoshi;
  /** Imtihon bo'lsa — tuzilma bilan tekshiriladi va "Tuzilmadan yasash" ishlaydi. */
  params: VaraqParametrlari | null;
  umumiy: { markaz: string; imtihon: string; sana: string; examId: number; fanlar?: string; logo?: string | null };
  onYop: () => void;
  onSaqlandi: (a: VaraqAndozaYozuvi) => void;
}) {
  const { showNotification } = useCRM();
  const confirm = useConfirm();
  const { soro } = useImtihonApi();
  const [nom, setNom] = useState(boshi.name);
  const [sahifalar, setSahifalar] = useState(Math.max(1, boshi.sahifalar || 1));
  const [bloklar, setBloklar] = useState<AndozaBlok[]>(boshi.bloklar);
  const [sahifa, setSahifa] = useState(1);
  const [tanlangan, setTanlangan] = useState<string | null>(null);
  const [ozgargan, setOzgargan] = useState(false);
  const [band, setBand] = useState(false);
  const rasmRef = useRef<HTMLInputElement>(null);
  const rasmUchun = useRef<string | null>(null);

  const k = params?.optionCount || 4;
  const p: VaraqParametrlari = useMemo(() => params || { tuzilma: { bloklar: [], savollar: [], jami: 0 }, optionCount: 4, variantCount: 2, variantBubble: true }, [params]);
  const andoza = useMemo(() => ({ sahifalar, bloklar }), [sahifalar, bloklar]);
  const tekshiruv = useMemo(() => andozaXatolari(andoza, { tuzilma: params?.tuzilma || null, optionCount: k }), [andoza, params, k]);
  const sahifaObyektlari = useMemo(() => andozaSahifalari({ ...p, andoza }), [p, andoza]);
  const svg = useMemo(() => {
    const sh = sahifaObyektlari[sahifa - 1];
    if (!sh) return '';
    return varaqSvg(sh, { ...umumiy, session: 1, smena: '1-smena' }, { ism: 'ALIYEV VALI', sheetCode: 'NAMUNA01', variant: 'A', kurs: 'Kurs nomi', xona: '1-xona', qator: 1, orin: 3 })
      .replace(/width="210mm" height="297mm"/, 'width="100%" height="100%"');
  }, [sahifaObyektlari, sahifa, umumiy]);

  const ozgartir = useCallback((f: (l: AndozaBlok[]) => AndozaBlok[]) => { setBloklar(f); setOzgargan(true); }, []);
  const blokQoy = (id: string, patch: Partial<AndozaBlok>) => ozgartir(l => l.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const tanlanganBlok = bloklar.find(b => b.id === tanlangan) || null;

  // Kanvas masshtabi: px / mm.
  const quti = useRef<HTMLDivElement>(null);
  const [m, setM] = useState(3);
  useLayoutEffect(() => {
    const el = quti.current;
    if (!el) return;
    const hisobla = () => setM(Math.max(1.5, Math.min(4.2, (el.clientWidth - 32) / W, (el.clientHeight - 32) / H * 1.6)));
    hisobla();
    const ro = new ResizeObserver(hisobla);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sudrash: 1 mm qadam, maydondan chiqmaydi.
  const sudrash = useRef<{ id: string; px: number; py: number; bx: number; by: number; w: number; h: number } | null>(null);
  const boshla = (e: React.PointerEvent, b: AndozaBlok) => {
    e.preventDefault();
    setTanlangan(b.id);
    const o = blokOlchami(b, k);
    sudrash.current = { id: b.id, px: e.clientX, py: e.clientY, bx: b.x, by: b.y, w: o.w, h: o.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const sur = (e: React.PointerEvent) => {
    const d = sudrash.current;
    if (!d) return;
    const x = Math.round(Math.min(ANDOZA_MAYDONI.x1 - d.w, Math.max(ANDOZA_MAYDONI.x0, d.bx + (e.clientX - d.px) / m)) * 2) / 2;
    const y = Math.round(Math.min(ANDOZA_MAYDONI.y1 - d.h, Math.max(ANDOZA_MAYDONI.y0(sahifa), d.by + (e.clientY - d.py) / m)) * 2) / 2;
    setBloklar(l => l.map(b => (b.id === d.id && (b.x !== x || b.y !== y) ? { ...b, x, y } : b)));
  };
  const tugat = () => { if (sudrash.current) setOzgargan(true); sudrash.current = null; };

  // Klaviatura: strelkalar — 1 mm (Shift — 5 mm), Delete — o'chirish.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!tanlangan || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      const qadam = e.shiftKey ? 5 : 1;
      const d = { ArrowLeft: [-qadam, 0], ArrowRight: [qadam, 0], ArrowUp: [0, -qadam], ArrowDown: [0, qadam] }[e.key];
      if (d) {
        e.preventDefault();
        ozgartir(l => l.map(b => (b.id === tanlangan ? { ...b, x: Math.round((b.x + d[0]) * 2) / 2, y: Math.round((b.y + d[1]) * 2) / 2 } : b)));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        ozgartir(l => l.filter(b => b.id !== tanlangan));
        setTanlangan(null);
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [tanlangan, ozgartir]);

  /** Yangi blok uchun bo'sh joy: shu sahifadagi eng pastki blok ostida. */
  const boshJoy = (h: number) => {
    const past = bloklar.filter(b => b.sahifa === sahifa).reduce((a, b) => Math.max(a, b.y + blokOlchami(b, k).h + 3), ANDOZA_MAYDONI.y0(sahifa));
    return past + h <= ANDOZA_MAYDONI.y1 ? past : ANDOZA_MAYDONI.y0(sahifa);
  };
  /** Tuzilmada hali varaqqa joylanmagan shu turdagi birinchi ketma-ket savollar. */
  const joylanmagan = (tur: AndozaTuri): { boshi: number; soni: number } => {
    const band = new Set<number>();
    for (const b of bloklar) if (SAVOL_BLOKLARI.includes(b.tur)) for (let n = b.boshi || 1; n < (b.boshi || 1) + (b.soni || 1); n++) band.add(n);
    const ns = (params?.tuzilma.savollar || []).filter(x => x.tur === tur && !band.has(x.n)).map(x => x.n);
    if (!ns.length) return { boshi: band.size ? Math.max(...band) + 1 : 1, soni: tur === 'yopiq' ? 10 : 1 };
    let j = 0;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    return { boshi: ns[0], soni: Math.min(j + 1, tur === 'yopiq' ? 90 : 12) };
  };
  const maxUstun = (b: AndozaBlok) => {
    let c = 1;
    while (c < 8 && blokOlchami({ ...b, ustunlar: c + 1 }, k).w <= ANDOZA_MAYDONI.x1 - ANDOZA_MAYDONI.x0 && c + 1 <= (b.soni || 1)) c++;
    return c;
  };
  const qosh = (tur: AndozaTuri, qoshimcha: Partial<AndozaBlok> = {}) => {
    let b: AndozaBlok = { id: yangiId(), tur, sahifa, x: ANDOZA_MAYDONI.x0, y: 0, ...qoshimcha };
    if (tur === 'yopiq' || tur === 'raqamli' || tur === 'moslash') {
      const j = joylanmagan(tur);
      b = { ...b, ...j, ustunlar: 1 };
      b.ustunlar = tur === 'yopiq' ? Math.min(maxUstun(b), Math.max(1, Math.ceil((b.soni || 1) / 15))) : maxUstun(b);
    } else if (tur === 'yozma') b = { ...b, boshi: joylanmagan('yozma').boshi, soni: 1, w: ANDOZA_MAYDONI.x1 - ANDOZA_MAYDONI.x0, h: 40 };
    else if (tur === 'matn') b = { ...b, matn: 'Yangi yozuv', olcham: 3.2, qalin: true, w: 90, tekis: 'start' };
    b.y = boshJoy(blokOlchami(b, k).h);
    ozgartir(l => [...l, b]);
    setTanlangan(b.id);
  };
  const rasmTanla = (id: string | null) => { rasmUchun.current = id; rasmRef.current?.click(); };
  const rasmKeldi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const { src, nisbat } = await rasmniTayyorla(f);
      const id = rasmUchun.current;
      if (id) blokQoy(id, { src });
      else qosh('rasm', { src, w: 40, h: Math.round(Math.min(60, 40 * nisbat) * 2) / 2 });
    } catch (x: any) { showNotification(x.message, 'error'); }
  };

  const tuzilmadan = async () => {
    if (!params) return;
    if (bloklar.length && !(await confirm("Hozirgi bloklar o'rniga imtihon tuzilmasidan yangi joylashuv yasalsinmi?"))) return;
    const a = tuzilmadanAndoza(params);
    setSahifalar(a.sahifalar);
    ozgartir(() => a.bloklar);
    setSahifa(1);
    setTanlangan(null);
  };
  const sahifaQosh = () => { if (sahifalar < 4) { setSahifalar(sahifalar + 1); setSahifa(sahifalar + 1); setOzgargan(true); } };
  const sahifaOchir = async () => {
    const bor = bloklar.filter(b => b.sahifa === sahifalar).length;
    if (bor && !(await confirm(`${sahifalar}-sahifadagi ${bor} ta blok ham o'chirilsinmi?`))) return;
    ozgartir(l => l.filter(b => b.sahifa !== sahifalar));
    setSahifalar(sahifalar - 1);
    setSahifa(s => Math.min(s, sahifalar - 1));
  };

  const yop = async () => { if (!ozgargan || (await confirm("Saqlanmagan o'zgarishlar yo'qoladi. Yopilsinmi?"))) onYop(); };
  const saqla = async () => {
    if (!nom.trim()) return showNotification('Andoza nomini kiriting', 'error');
    setBand(true);
    try {
      const yuk = { name: nom.trim(), sahifalar, bloklar };
      const a = await soro<VaraqAndozaYozuvi>(boshi.id ? 'PUT' : 'POST', boshi.id ? `varaq-andozalar/${boshi.id}` : 'varaq-andozalar', yuk);
      setOzgargan(false);
      onSaqlandi(a);
    } catch (x: any) { showNotification(x.message, 'error'); } finally { setBand(false); }
  };

  const sahifadagi = bloklar.filter(b => b.sahifa === sahifa);
  const xatoliBloklar = useMemo(() => new Set(tekshiruv.xatolar.flatMap(x => bloklar.filter(b => x.includes(blokNomi(b))).map(b => b.id))), [tekshiruv, bloklar]);
  const maydon = ANDOZA_MAYDONI;

  return (
    <div className="fixed inset-0 z-50 bg-fon flex flex-col" role="dialog" aria-modal="true" aria-label="Varaq dizayneri">
      {/* Yuqori panel */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-chiziq bg-sirt">
        <button onClick={yop} aria-label="Yopish" className="p-2 rounded-lg text-matn-sokin hover:bg-ichki cursor-pointer"><X size={18} /></button>
        <input className={`${INPUT} py-2 max-w-72`} value={nom} onChange={e => { setNom(e.target.value); setOzgargan(true); }} placeholder="Andoza nomi" aria-label="Andoza nomi" />
        <div className="flex items-center gap-1 ml-1" role="tablist" aria-label="Sahifalar">
          {Array.from({ length: sahifalar }, (_, i) => (
            <button key={i} role="tab" aria-selected={sahifa === i + 1} onClick={() => setSahifa(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer ${sahifa === i + 1 ? 'bg-brand text-brand-ust' : 'bg-ichki text-matn-sokin hover:text-matn'}`}>{i + 1}-sahifa</button>
          ))}
          {sahifalar < 4 && <button onClick={sahifaQosh} title="Sahifa qo'shish" aria-label="Sahifa qo'shish" className="p-1.5 rounded-lg text-matn-sokin hover:bg-ichki cursor-pointer"><Plus size={15} /></button>}
          {sahifalar > 1 && <button onClick={sahifaOchir} title="Oxirgi sahifani o'chirish" aria-label="Oxirgi sahifani o'chirish" className="p-1.5 rounded-lg text-matn-sokin hover:bg-ichki cursor-pointer"><Minus size={15} /></button>}
        </div>
        <span className="ml-auto flex items-center gap-2">
          {params && <Tugma kichik ikonka={<Wand2 size={14} />} onClick={tuzilmadan} title="Imtihon tuzilmasidan avtomatik joylashuv">Tuzilmadan yasash</Tugma>}
          <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={band} onClick={saqla}>Saqlash</Tugma>
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
        {/* Bloklar palitrasi */}
        <aside className="border-r border-chiziq bg-sirt p-3 space-y-1.5 overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-wide text-matn-xira px-1 pb-1">Blok qo'shish</p>
          {(['yopiq', 'raqamli', 'moslash', 'yozma', 'matn'] as AndozaTuri[]).map(t => (
            <button key={t} onClick={() => qosh(t)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-chiziq bg-sirt hover:border-brand hover:text-brand text-[12.5px] font-semibold text-matn cursor-pointer">
              <span className="text-brand">{TUR_IKONKA[t]}</span>{TUR_NOMI[t]}
            </button>
          ))}
          <button onClick={() => rasmTanla(null)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-chiziq bg-sirt hover:border-brand hover:text-brand text-[12.5px] font-semibold text-matn cursor-pointer">
            <span className="text-brand">{TUR_IKONKA.rasm}</span>Rasm (logo)
          </button>
          <input ref={rasmRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" aria-label="Rasm fayli" onChange={rasmKeldi} />
          <div className="pt-3 text-[11.5px] text-matn-xira space-y-1.5 px-1">
            <p className="flex gap-1.5"><MousePointer2 size={13} className="shrink-0 mt-px" />Blokni sichqoncha bilan suring; strelkalar — 1 mm, Shift bilan — 5 mm; Delete — o'chirish.</p>
            <p>Sarlavha (QR, ID, variant) — standart, o'qigich uchun o'zgarmaydi.</p>
          </div>
        </aside>

        {/* Kanvas */}
        <div ref={quti} className="min-h-0 overflow-auto bg-[#dfe3e8] dark:bg-[#2a2f36] p-4" onPointerDown={e => { if (e.target === e.currentTarget) setTanlangan(null); }}>
          <div className="relative mx-auto bg-white shadow-md select-none" style={{ width: W * m, height: H * m }} onPointerMove={sur} onPointerUp={tugat} onPointerCancel={tugat}>
            <div className="absolute inset-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: svg }} />
            {/* Bloklar maydoni */}
            <div className="absolute border border-dashed border-brand/40 pointer-events-none"
              style={{ left: maydon.x0 * m, top: maydon.y0(sahifa) * m, width: (maydon.x1 - maydon.x0) * m, height: (maydon.y1 - maydon.y0(sahifa)) * m }}
              onPointerDown={() => setTanlangan(null)} />
            <div className="absolute inset-0" onPointerDown={e => { if (e.target === e.currentTarget) setTanlangan(null); }}>
              {sahifadagi.map(b => {
                const o = blokOlchami(b, k);
                const faol = b.id === tanlangan;
                const xato = xatoliBloklar.has(b.id);
                return (
                  <div key={b.id} role="button" tabIndex={0} aria-label={`Blok: ${blokNomi(b)}`} aria-pressed={faol}
                    onPointerDown={e => boshla(e, b)} onFocus={() => setTanlangan(b.id)}
                    className={`absolute cursor-move rounded-[2px] outline-none ${faol ? 'ring-2 ring-brand bg-brand/10' : xato ? 'ring-2 ring-xato/70 bg-xato/5' : 'ring-1 ring-brand/25 hover:ring-brand/70 hover:bg-brand/5'}`}
                    style={{ left: b.x * m, top: b.y * m, width: o.w * m, height: o.h * m }}>
                    <span className={`absolute -top-[18px] left-0 px-1.5 rounded text-[10.5px] font-semibold whitespace-nowrap ${faol ? 'bg-brand text-brand-ust' : 'bg-sirt/90 text-matn-sokin border border-chiziq'} ${faol ? '' : 'opacity-0 hover:opacity-100'}`}>{blokNomi(b)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Xususiyatlar va tekshiruv */}
        <aside className="border-l border-chiziq bg-sirt p-4 space-y-4 overflow-y-auto">
          {tanlanganBlok ? (
            <BlokXususiyatlari b={tanlanganBlok} sahifalar={sahifalar} k={k} maxUstun={maxUstun(tanlanganBlok)}
              onChange={patch => { blokQoy(tanlanganBlok.id, patch); if (patch.sahifa) setSahifa(patch.sahifa); }}
              onRasm={() => rasmTanla(tanlanganBlok.id)}
              onNusxa={() => { const n = { ...tanlanganBlok, id: yangiId(), y: tanlanganBlok.y }; n.y = boshJoy(blokOlchami(n, k).h); ozgartir(l => [...l, n]); setTanlangan(n.id); }}
              onOchir={() => { ozgartir(l => l.filter(b => b.id !== tanlanganBlok.id)); setTanlangan(null); }} />
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-matn">Varaq</p>
              <p className="text-[12px] text-matn-sokin">{bloklar.length} ta blok · {sahifalar} sahifa{params ? ` · imtihonda ${params.tuzilma.jami} savol` : ''}. Blokni tanlang — o'ng tomonda sozlamalari chiqadi.</p>
            </div>
          )}
          <div className="border-t border-chiziq pt-3 space-y-2" aria-label="Tekshiruv">
            <p className="text-[12px] font-bold uppercase tracking-wide text-matn-xira">Tekshiruv</p>
            {!tekshiruv.xatolar.length && !tekshiruv.ogohlar.length && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-yaxshi font-semibold"><CheckCircle2 size={15} />{params ? "Hamma savol joyida — chop etsa bo'ladi" : "Xato yo'q"}</p>
            )}
            {tekshiruv.xatolar.map((x, i) => <p key={i} className="flex gap-1.5 text-[12px] text-xato"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{x}</p>)}
            {tekshiruv.ogohlar.map((x, i) => <p key={i} className="flex gap-1.5 text-[12px] text-ogoh"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{x}</p>)}
            {!params && <p className="text-[11.5px] text-matn-xira">Savollar raqami imtihon tuzilmasi bilan imtihonga qo'llaganda tekshiriladi.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Son({ nom, qiymat, onChange, min, max, qadam = 1 }: { nom: string; qiymat: number; onChange: (v: number) => void; min: number; max: number; qadam?: number }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">{nom}</span>
      <input type="number" className={`${INPUT} py-1.5`} value={qiymat} min={min} max={max} step={qadam} aria-label={nom}
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }} />
    </label>
  );
}

function BlokXususiyatlari({ b, sahifalar, k, maxUstun, onChange, onRasm, onNusxa, onOchir }: {
  b: AndozaBlok; sahifalar: number; k: number; maxUstun: number;
  onChange: (p: Partial<AndozaBlok>) => void; onRasm: () => void; onNusxa: () => void; onOchir: () => void;
}) {
  const o = blokOlchami(b, k);
  const savol = SAVOL_BLOKLARI.includes(b.tur);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-brand-fon text-brand flex items-center justify-center">{TUR_IKONKA[b.tur]}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-matn">{TUR_NOMI[b.tur]}</span>
          <span className="block text-[11.5px] text-matn-xira raqam">{Math.round(o.w)} × {Math.round(o.h)} mm</span>
        </span>
      </div>
      {savol && b.tur !== 'yozma' && (
        <div className="grid grid-cols-2 gap-2">
          <Son nom="Birinchi savol" qiymat={b.boshi || 1} min={1} max={999} onChange={v => onChange({ boshi: v })} />
          <Son nom="Savollar soni" qiymat={b.soni || 1} min={1} max={300} onChange={v => onChange({ soni: v, ustunlar: Math.min(b.ustunlar || 1, v) })} />
          <Son nom={b.tur === 'yopiq' ? 'Ustunlar' : 'Qatorda'} qiymat={b.ustunlar || 1} min={1} max={Math.max(1, maxUstun)} onChange={v => onChange({ ustunlar: v })} />
          <div className="text-[11.5px] text-matn-xira self-end pb-2">{b.boshi}–{(b.boshi || 1) + (b.soni || 1) - 1}-savollar</div>
        </div>
      )}
      {b.tur === 'yozma' && (
        <div className="grid grid-cols-2 gap-2">
          <Son nom="Savol raqami" qiymat={b.boshi || 1} min={1} max={999} onChange={v => onChange({ boshi: v })} />
          <span />
          <Son nom="Kenglik, mm" qiymat={b.w || 170} min={40} max={170} onChange={v => onChange({ w: v })} />
          <Son nom="Balandlik, mm" qiymat={b.h || 40} min={15} max={180} onChange={v => onChange({ h: v })} />
        </div>
      )}
      {savol && (
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Sarlavha (ixtiyoriy)</span>
          <input className={`${INPUT} py-1.5`} value={b.sarlavha || ''} placeholder="Masalan: Matematika" aria-label="Sarlavha" onChange={e => onChange({ sarlavha: e.target.value || undefined })} />
        </label>
      )}
      {b.tur === 'matn' && (
        <>
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Matn</span>
            <textarea className={`${INPUT} py-1.5 min-h-20`} value={b.matn || ''} aria-label="Matn" onChange={e => onChange({ matn: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Son nom="Shrift, mm" qiymat={b.olcham || 3} min={2} max={10} qadam={0.1} onChange={v => onChange({ olcham: v })} />
            <Son nom="Kenglik, mm" qiymat={b.w || 60} min={10} max={170} onChange={v => onChange({ w: v })} />
          </div>
          <Tanlov kichik qiymat={b.tekis || 'start'} onChange={v => onChange({ tekis: v })} variantlar={[{ v: 'start', nom: 'Chap' }, { v: 'middle', nom: "O'rta" }, { v: 'end', nom: "O'ng" }]} />
          <label className="flex items-center gap-2 text-[12.5px] text-matn cursor-pointer">
            <input type="checkbox" checked={!!b.qalin} onChange={e => onChange({ qalin: e.target.checked })} className="w-4 h-4 accent-[var(--color-brand)]" /> Qalin
          </label>
        </>
      )}
      {b.tur === 'rasm' && (
        <>
          {b.src && <img src={b.src} alt="" className="max-h-24 rounded-lg border border-chiziq bg-white" />}
          <Tugma kichik ikonka={<ImagePlus size={13} />} onClick={onRasm}>Rasmni almashtirish</Tugma>
          <div className="grid grid-cols-2 gap-2">
            <Son nom="Kenglik, mm" qiymat={b.w || 30} min={5} max={170} onChange={v => onChange({ w: v })} />
            <Son nom="Balandlik, mm" qiymat={b.h || 20} min={5} max={190} onChange={v => onChange({ h: v })} />
          </div>
        </>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Son nom="X, mm" qiymat={b.x} min={0} max={210} qadam={0.5} onChange={v => onChange({ x: v })} />
        <Son nom="Y, mm" qiymat={b.y} min={0} max={297} qadam={0.5} onChange={v => onChange({ y: v })} />
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Sahifa</span>
          <select className={`${SELECT} py-1.5`} value={b.sahifa} aria-label="Sahifa" onChange={e => onChange({ sahifa: Number(e.target.value), y: ANDOZA_MAYDONI.y0(Number(e.target.value)) })}>
            {Array.from({ length: sahifalar }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <Tugma kichik ikonka={<Copy size={13} />} onClick={onNusxa}>Nusxa</Tugma>
        <Tugma kichik turi="xavfli" ikonka={<Trash2 size={13} />} onClick={onOchir}>O'chirish</Tugma>
      </div>
    </div>
  );
}
