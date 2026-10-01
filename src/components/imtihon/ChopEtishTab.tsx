import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, KeyRound, FileText, Files, DoorOpen, ClipboardList, Printer, Info, LayoutList, Eye, Loader2, ListChecks, FileDown, PenTool, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Almashtirgich, Yuklanmoqda, Tanlov } from './ui';
import { useOrinlar } from './QatnashchilarTab';
import { chopEt, type ChopParam } from '../../lib/chopEtish';
import { varaqSahifalari, andozaXatolari } from '../../lib/omr/layout';
import { varaqSvg, varaqlarniJoyla, type Qogoz } from '../../lib/omr/render';
import { kitobchaHtml, KITOBCHA_CSS, katexCss, eshikRoyxatiHtml, vedomostHtml, ROYXAT_CSS, kalitVaragiHtml, KALIT_CSS, KORINISH_CSS, KITOBCHA_STANDART } from './chop';
import type { KitobchaMalumoti, KalitMalumoti, KitobchaSozlama } from './chop';
import { yuklabOl } from '../../lib/zip';
import { varaqTuzilmasi } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';
import QulfKerak from './QulfKerak';
import AndozadanQogoz from './AndozadanQogoz';
import { varaqParametrlari } from './varaqParam';
import TanlanganSavollar from './TanlanganSavollar';
import VaraqDizayni from './dizayner/VaraqDizayni';

// 3-bo'lim. Chapda — chop etiladigan hujjatlar (Addmen QPG kabi ikki guruh:
// savol qog'ozi va imtihon kuni), o'ngda — tanlangan hujjat qanday
// chiqishining jonli ko'rinishi (birinchi betlari). Javob varaqalari xona →
// qator → o'rin tartibida (dasta xonaga shu tartibda kiradi). "Andozadan
// savol qog'ozi" — andoza(lar)dan variantli imtihonni bir qadamda yasaydi.

type Hujjat = 'savollar' | 'kitobcha' | 'kalit' | 'varaq' | 'universal' | 'eshik' | 'vedomost' | 'dizayn';

export default function ChopEtishTab({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => void }) {
  const { settings, schools, showNotification, kora, ozgartira } = useCRM();
  const navigate = useNavigate();
  const { soro } = useImtihonApi();
  const { data } = useOrinlar(exam.id);
  const s = exam.settings;
  const [smena, setSmena] = useState(s.sessions[0]?.id || 1);
  const [xona, setXona] = useState<number | 0>(0);
  const [rasmli, setRasmli] = useState(true);
  const [universalSoni, setUniversalSoni] = useState(10);
  // Qog'oz: A4, A5 yoki A4 ga ikkitadan (30 talik test uchun qog'oz tejaladi). Brauzerda eslab qolinadi.
  const [qogoz, setQogozHolat] = useState<Qogoz>(() => { try { return (localStorage.getItem('imt_qogoz') as Qogoz) || 'A4'; } catch { return 'A4'; } });
  const setQogoz = (q: Qogoz) => { setQogozHolat(q); try { localStorage.setItem('imt_qogoz', q); } catch { /* bo'lmasa — eslab qolinmaydi */ } };
  // Bitta qatnashchi varag'i: o'rni o'zgargan yoki varag'i buzilganlar uchun.
  const [yakka, setYakka] = useState<number>(0);
  const [kitobchaKodi, setKitobchaKodi] = useState('');
  const [band, setBand] = useState<false | 'chop' | 'word'>(false);
  const [andozaOyna, setAndozaOyna] = useState(false);
  // Kitobcha ko'rinishi (Addmen QPG "Output") — brauzerda eslab qolinadi.
  const [ko, setKoHolat] = useState<KitobchaSozlama>(() => { try { return { ...KITOBCHA_STANDART, ...JSON.parse(localStorage.getItem('imt_kitobcha') || '{}') }; } catch { return KITOBCHA_STANDART; } });
  const setKo = (patch: Partial<KitobchaSozlama>) => setKoHolat(x => { const y = { ...x, ...patch }; try { localStorage.setItem('imt_kitobcha', JSON.stringify(y)); } catch { /* eslab qolinmaydi */ } return y; });
  const kalitKorinadi = kora('imtihonlar.kalit');
  const yaratadi = ozgartira('imtihonlar.imtihon');
  const kitobchaBor = s.source === 'bank';
  const sorovnoma = s.source === 'sorovnoma';
  const anonim = sorovnoma && !!s.sorovnoma?.anonim;
  const [hujjat, setHujjat] = useState<Hujjat>(kitobchaBor ? 'kitobcha' : anonim ? 'universal' : 'varaq');
  const markaz = settings?.orgName || '';

  const orinlar = useMemo(() => (data?.seats || []).filter(o => o.session === smena && o.roomId && (!xona || o.roomId === xona))
    .sort((a, b) => (a.roomName || '').localeCompare(b.roomName || '') || (a.roomId! - b.roomId!) || (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0)), [data, smena, xona]);
  const xonalar = useMemo(() => [...new Map((data?.seats || []).filter(o => o.session === smena && o.roomId).map(o => [o.roomId!, o.roomName])).entries()], [data, smena]);
  const sahifalar = useMemo(() => varaqSahifalari(varaqParametrlari(exam)), [exam]);
  // Dizayner andozasi xato bo'lsa (savol varaqda yo'q, ustma-ust) — varaq chop etilmaydi.
  const andozaXato = useMemo(() => {
    const p = varaqParametrlari(exam);
    return p.andoza ? andozaXatolari(p.andoza, { tuzilma: p.tuzilma, optionCount: p.optionCount }).xatolar : [];
  }, [exam]);
  const smenaNomi = (id: number) => { const x = s.sessions.find(y => y.id === id); return x ? `${x.name}${x.time ? ` (${x.time})` : ''}` : `${id}-smena`; };
  // Fan bandi: har blok — nomi va savollar soni (markaz varag'idagi "MATEMATIKA — 30 ta savol").
  const fanlar = useMemo(() => {
    const t = varaqTuzilmasi(exam.blocks, exam.scoring) as any;
    return (t.bloklar || []).map((b: any) => `${String(b.nomi || '').toUpperCase()} — ${b.yopiq + b.raqamli + (b.moslash || 0) + b.yozma} ta savol${b.tanlab ? ` (istalgan ${b.tanlab} tasini yeching)` : ''}`).join('   ·   ');
  }, [exam]);
  const telefon = [settings?.adminPhone, settings?.adminPhone2].filter(Boolean).join(', ');
  const umumiy = {
    markaz, imtihon: exam.name, sana: exam.date, examId: exam.id, session: smena, smena: smenaNomi(smena),
    logo: settings?.logo || null, manzil: settings?.address || null, telefon: telefon ? `Tel: ${telefon}` : null, fanlar,
    ...(sorovnoma ? { sarlavha: "SO'ROVNOMA VARAQASI", anonim } : {}),
  };
  const filialNomi = (id: number) => schools.find(x => x.id === id)?.name || null;
  const variantlar = useMemo(() => exam.variantlar.filter(v => v.session === smena).map(v => v.code), [exam, smena]);

  // Kitobcha nusxalari: har variantga nechta (5% zaxira bilan).
  const nusxalar = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of data?.seats || []) if (o.session === smena && o.variant) m.set(o.variant, (m.get(o.variant) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, smena]);

  // Kitobcha va kalit ma'lumoti serverdan bir marta olinadi (ko'rinish ham, chop etish ham shundan).
  const kesh = useRef(new Map<string, Promise<unknown>>());
  const olish = <T,>(yol: string) => {
    if (!kesh.current.has(yol)) kesh.current.set(yol, soro<T>('GET', yol).catch(e => { kesh.current.delete(yol); throw e; }));
    return kesh.current.get(yol) as Promise<T>;
  };
  useEffect(() => { kesh.current.clear(); }, [exam]);

  const varaqMalumoti = (o: (typeof orinlar)[number]) => ({
    ism: o.name, kurs: o.groupName, xona: o.roomName, qator: o.row != null ? o.row + 1 : null, orin: o.col != null ? o.col + 1 : null,
    variant: o.variant, sheetCode: o.sheetCode, rasm: rasmli ? o.photo : null, mehmon: o.mehmon,
    filial: filialNomi(o.schoolId), maktab: o.maktab, sinf: o.sinf, kod: o.kod,
  });
  const xonalarBoyicha = () => {
    const guruh = new Map<number, typeof orinlar>();
    for (const o of orinlar) { if (!guruh.has(o.roomId!)) guruh.set(o.roomId!, []); guruh.get(o.roomId!)!.push(o); }
    return [...guruh.values()];
  };

  /** Tanlangan hujjat HTML'i. `korinish` — faqat birinchi betlari (tez chiqishi uchun). */
  const tayyorla = async (turi: Hujjat, korinish: boolean): Promise<ChopParam | null> => {
    if (turi === 'kitobcha') {
      const kodlar = kitobchaKodi ? [kitobchaKodi] : korinish ? variantlar.slice(0, 1) : variantlar;
      if (!kodlar.length) return null;
      const d = await olish<KitobchaMalumoti>(`exams/${exam.id}/booklets?session=${smena}`);
      return { sarlavha: `${exam.name} — kitobcha ${kodlar.join(', ')}`, css: katexCss() + KITOBCHA_CSS, body: kitobchaHtml(exam, markaz, d, kodlar.map(code => ({ session: smena, code })), ko) };
    }
    if (turi === 'kalit') {
      const d = await olish<KalitMalumoti>(`exams/${exam.id}/key`);
      return { sarlavha: `${exam.name} — javoblar kaliti`, css: ROYXAT_CSS + KALIT_CSS, body: kalitVaragiHtml(exam, markaz, d, smena) };
    }
    if (turi === 'varaq') {
      const tanlanganlar = yakka ? orinlar.filter(o => o.id === yakka) : korinish ? orinlar.slice(0, 1) : orinlar;
      if (!tanlanganlar.length) {
        if (!korinish) throw new Error("Bu smenada o'rinlashtirilgan qatnashchi yo'q — «O'rinlashtirish» bosqichini bajaring");
        return null;
      }
      const svglar = tanlanganlar.flatMap(o => sahifalar.map(sh => varaqSvg(sh, umumiy, varaqMalumoti(o))));
      if (korinish && qogoz === 'A4x2' && svglar.length === 1 && orinlar[1]) svglar.push(...sahifalar.map(sh => varaqSvg(sh, umumiy, varaqMalumoti(orinlar[1]))));
      return { sarlavha: yakka ? `${exam.name} — ${tanlanganlar[0].name}` : `${exam.name} — javob varaqalari`, ...varaqlarniJoyla(svglar, qogoz), kutish: 45000 };
    }
    if (turi === 'universal') {
      const n = korinish ? (qogoz === 'A4x2' ? 2 : 1) : Math.max(1, Math.min(500, universalSoni));
      // Anonim so'rovnoma: har nusxaga o'z kodi (betlari birga o'qiladi, qayta skanerlash ikki marta sanalmaydi).
      if (anonim) {
        const kod = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
        const svglar = Array.from({ length: n }, () => { const k = kod(); return sahifalar.map(sh => varaqSvg(sh, { ...umumiy, anonimKod: k }, null)); }).flat();
        return { sarlavha: `${exam.name} — so'rovnoma varaqlari`, ...varaqlarniJoyla(svglar, qogoz) };
      }
      const bitta = sahifalar.map(sh => varaqSvg(sh, umumiy, null));
      return { sarlavha: `${exam.name} — universal varaqlar`, ...varaqlarniJoyla(Array.from({ length: n }, () => bitta).flat(), qogoz) };
    }
    const xonaRoyxati = xonalarBoyicha();
    if (!xonaRoyxati.length) {
      if (!korinish) throw new Error("Bu smenada o'rinlashtirilgan qatnashchi yo'q — «O'rinlashtirish» bosqichini bajaring");
      return null;
    }
    const f = turi === 'eshik' ? eshikRoyxatiHtml : vedomostHtml;
    const body = (korinish ? xonaRoyxati.slice(0, 1) : xonaRoyxati).map(l => f({ exam, smena: smenaNomi(smena), xona: l[0].roomName, orinlar: l })).join('');
    return { sarlavha: `${exam.name} — ${turi === 'eshik' ? "eshik ro'yxati" : 'vedomost'}`, css: ROYXAT_CSS, body };
  };

  const chopEtish = async () => {
    setBand('chop');
    try {
      const p = await tayyorla(hujjat, false);
      if (!p) throw new Error("Chop etiladigan narsa yo'q");
      await chopEt(p);
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  // Addmen QPG "Format: DOC" — kitobcha Word'da (formulalar Word formulasi, rasmlar ichida).
  const wordYukla = async () => {
    setBand('word');
    try {
      const kodlar = kitobchaKodi ? [kitobchaKodi] : variantlar;
      const d = await olish<KitobchaMalumoti>(`exams/${exam.id}/booklets?session=${smena}`);
      const { kitobchaWord, kitobchaFaylNomi } = await import('./kitobchaWord');
      const blob = await kitobchaWord(exam, markaz, d, kodlar.map(code => ({ session: smena, code })), ko);
      yuklabOl(blob, kitobchaFaylNomi(exam, kodlar));
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  // Savol almashtirilsa — kitobcha va kalit qaytadan olinadi.
  const [keshAvlod, setKeshAvlod] = useState(0);
  const savolOzgardi = () => { kesh.current.clear(); setKeshAvlod(n => n + 1); };

  // Jonli ko'rinish: hujjat yoki sozlama o'zgarsa qayta chiziladi.
  const [korinish, setKorinish] = useState<{ html: string } | { xato: string } | null>(null);
  useEffect(() => {
    if (!exam.lockedAt || !data || hujjat === 'savollar' || hujjat === 'dizayn') return;
    let bekor = false;
    setKorinish(null);
    const t = setTimeout(() => {
      tayyorla(hujjat, true).then(p => {
        if (bekor) return;
        setKorinish(p ? { html: `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>${p.css}${KORINISH_CSS}</style></head><body>${p.body}</body></html>` }
          : { xato: hujjat === 'kitobcha' ? "Bu smenada variant yo'q" : "Bu smenada o'rinlashtirilgan qatnashchi yo'q — «O'rinlashtirish» bosqichidan keyin ko'rinadi" });
      }).catch(e => { if (!bekor) setKorinish({ xato: e.message }); });
    }, 150);
    return () => { bekor = true; clearTimeout(t); };
  }, [hujjat, smena, xona, yakka, rasmli, qogoz, kitobchaKodi, ko, data, exam, keshAvlod]); // eslint-disable-line react-hooks/exhaustive-deps

  const andozadanTayyor = (id: number, qulflandi: boolean) => {
    setAndozaOyna(false);
    navigate(qulflandi ? `/exams?tab=chop&imtihon=${id}` : `/exams?imtihon=${id}`);
  };
  const andozaTugmasi = yaratadi && (
    <Tugma ikonka={<LayoutList size={14} />} onClick={() => setAndozaOyna(true)}>Andozadan savol qog'ozi</Tugma>
  );
  const andozaOynasi = andozaOyna && <AndozadanQogoz onYop={() => setAndozaOyna(false)} onTayyor={andozadanTayyor} />;

  if (!exam.lockedAt) {
    return (
      <>
        <QulfKerak examId={exam.id} ikonka={<Printer size={20} />} qoshimcha={andozaTugmasi}
          izoh="Kitobcha, kalit va javob varaqalari variantlar tayyor bo'lgach chiqadi: «Imtihonlar» tabida savollarni (yoki «faqat kalit» rejimida kitobcha kalitini) tayyorlab, qulflang. Yoki andozadan yangi savol qog'ozi yarating." />
        {andozaOynasi}
      </>
    );
  }
  if (!data) return <Yuklanmoqda />;

  const smenadagilar = (data.seats || []).filter(o => o.session === smena && o.roomId).length;
  const HUJJATLAR: { guruh: string; royxat: { id: Hujjat; nom: string; izoh: string; ikonka: React.ReactNode; ochiq: boolean }[] }[] = [
    {
      guruh: "Savol qog'ozi", royxat: [
        { id: 'savollar', nom: 'Tanlangan savollar', izoh: "ko'rish va almashtirish", ikonka: <ListChecks size={16} />, ochiq: kitobchaBor },
        { id: 'kitobcha', nom: 'Kitobchalar', izoh: `${variantlar.length} variant · ksero uchun`, ikonka: <BookOpen size={16} />, ochiq: kitobchaBor },
        { id: 'kalit', nom: 'Javoblar kaliti', izoh: 'hamma variantlar, tekshiruvchi uchun', ikonka: <KeyRound size={16} />, ochiq: kalitKorinadi && !sorovnoma },
      ],
    },
    {
      guruh: sorovnoma ? "So'rovnoma kuni" : 'Imtihon kuni', royxat: [
        { id: 'varaq', nom: sorovnoma ? "So'rovnoma varaqlari (ismli)" : 'Javob varaqalari', izoh: `${orinlar.length} kishi · shaxsiy, QR bilan`, ikonka: <FileText size={16} />, ochiq: !anonim },
        { id: 'universal', nom: anonim ? "So'rovnoma varaqlari (anonim)" : 'Universal varaqlar', izoh: anonim ? 'ism va ID siz · nechta kerak bo\'lsa' : "ro'yxatda yo'qlar uchun", ikonka: <Files size={16} />, ochiq: true },
        { id: 'eshik', nom: "Eshik ro'yxati", izoh: `${xonalar.length} xona · alifbo tartibida`, ikonka: <DoorOpen size={16} />, ochiq: !anonim },
        { id: 'vedomost', nom: 'Nazoratchi vedomosti', izoh: `${xonalar.length} xona · imzo bilan`, ikonka: <ClipboardList size={16} />, ochiq: !anonim },
        { id: 'dizayn', nom: 'Varaq dizayni', izoh: s.varaqAndoza?.bloklar?.length ? `andoza: ${s.varaqAndoza.nomi || 'nomsiz'}` : "standart · bloklarni o'zingiz joylang", ikonka: <PenTool size={16} />, ochiq: !sorovnoma },
      ],
    },
  ];
  const tanlanganNomi = HUJJATLAR.flatMap(g => g.royxat).find(h => h.id === hujjat)?.nom;
  const varaqTuri = hujjat === 'varaq' || hujjat === 'universal';
  const xonaKerak = hujjat === 'varaq' || hujjat === 'eshik' || hujjat === 'vedomost';
  const sanoq = hujjat === 'kitobcha' ? `${kitobchaKodi ? 1 : variantlar.length} ta kitobcha`
    : hujjat === 'kalit' ? `${variantlar.length} variant`
      : hujjat === 'varaq' ? `${yakka ? 1 : orinlar.length} ta varaq${sahifalar.length > 1 ? ` × ${sahifalar.length} bet` : ''}`
        : hujjat === 'universal' ? `${universalSoni} ta varaq` : `${xonalar.filter(([id]) => !xona || id === xona).length} xona`;
  const boshMi = (hujjat === 'varaq' || hujjat === 'eshik' || hujjat === 'vedomost') && !orinlar.length;
  const varaqXato = varaqTuri && andozaXato.length > 0;

  return (
    <div className="space-y-4">
      {andozaOynasi}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
        <div className="space-y-4">
          <Karta ichki="p-2">
            {HUJJATLAR.filter(g => g.royxat.some(h => h.ochiq)).map(g => (
              <div key={g.guruh} className="mb-1 last:mb-0">
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-matn-xira">{g.guruh}</p>
                {g.royxat.filter(h => h.ochiq).map(h => {
                  const faol = h.id === hujjat;
                  return (
                    <button key={h.id} onClick={() => setHujjat(h.id)} aria-pressed={faol}
                      className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-left cursor-pointer transition-colors ${faol ? 'bg-brand-fon dark:bg-brand/15' : 'hover:bg-ichki'}`}>
                      <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${faol ? 'bg-brand text-brand-ust' : 'bg-ichki text-matn-sokin'}`}>{h.ikonka}</span>
                      <span className="min-w-0">
                        <span className={`block text-[13px] font-semibold ${faol ? 'text-brand' : 'text-matn'}`}>{h.nom}</span>
                        <span className="block text-[11.5px] text-matn-xira truncate">{h.izoh}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {andozaTugmasi && !sorovnoma && (
              <div className="border-t border-chiziq mt-1.5 pt-2 px-1 pb-1">
                <button onClick={() => setAndozaOyna(true)} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-left cursor-pointer hover:bg-ichki">
                  <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border border-dashed border-brand/50 text-brand"><LayoutList size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-matn">Andozadan savol qog'ozi</span>
                    <span className="block text-[11.5px] text-matn-xira">Blueprint → variantli imtihon</span>
                  </span>
                </button>
              </div>
            )}
          </Karta>

          <Karta sarlavha={tanlanganNomi}>
            <div className="space-y-3">
              {s.sessions.length > 1 && (
                <Maydon nom="Smena">
                  <select className={SELECT} value={smena} onChange={e => { setSmena(Number(e.target.value)); setXona(0); setYakka(0); setKitobchaKodi(''); }}>
                    {s.sessions.map(x => <option key={x.id} value={x.id}>{smenaNomi(x.id)}</option>)}
                  </select>
                </Maydon>
              )}
              {hujjat === 'savollar' && (
                <p className="text-[12px] text-matn-sokin">Andoza yoki qoidalar bo'yicha tushgan savollar. Yoqmaganini ↻ bilan o'sha mavzu va qiyinlikdagi boshqasiga yoki # bilan QID bo'yicha aniq savolga almashtiring — kitobcha va kalit o'zi yangilanadi. Natija kelgach almashtirib bo'lmaydi.</p>
              )}
              {hujjat === 'kitobcha' && (
                <>
                  <Maydon nom="Variant">
                    <select className={SELECT} value={kitobchaKodi} onChange={e => setKitobchaKodi(e.target.value)}>
                      <option value="">Hammasi ({variantlar.join(', ')})</option>
                      {variantlar.map(c => <option key={c} value={c}>Variant {c}</option>)}
                    </select>
                  </Maydon>
                  <Maydon div nom="Ustunlar">
                    <Tanlov qiymat={ko.ustun} onChange={v => setKo({ ustun: v })} variantlar={[{ v: 1, nom: '1 ustun' }, { v: 2, nom: '2 ustun' }]} />
                  </Maydon>
                  <div className="space-y-2">
                    <Almashtirgich yoqilgan={ko.bolimSarlavha} onChange={v => setKo({ bolimSarlavha: v })} nom="Fan sarlavhalari" izoh="Masalan: Matematika — 1–30-savollar, har biri 3,1 ball" />
                    <Almashtirgich yoqilgan={ko.izoh} onChange={v => setKo({ izoh: v })} nom="Savol izohlari" izoh="Bankdagi izoh maydoni savol ostida" />
                    <Almashtirgich yoqilgan={ko.ikkiTil} onChange={v => setKo({ ikkiTil: v })} nom="Ikki tilli" izoh="Tarjimasi bor savollar ikkinchi tilda ham" />
                  </div>
                  {nusxalar.length > 0 && (
                    <div className="rounded-xl bg-ichki border border-chiziq p-2.5">
                      <p className="text-[11.5px] font-semibold text-matn-sokin mb-1.5">Ksero: kerakli nusxalar (5% zaxira)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {nusxalar.map(([v, n]) => <span key={v} className="px-2 py-0.5 rounded-lg bg-sirt border border-chiziq text-[12px]"><b className="text-brand">{v}</b> — {Math.ceil(n * 1.05)} ta</span>)}
                      </div>
                    </div>
                  )}
                </>
              )}
              {hujjat === 'dizayn' && <p className="text-[12px] text-matn-sokin">Javob varag'ining savollar qismi: standart (o'zi joylanadi) yoki o'zingiz chizgan andoza — variantli savollar ustunlari, raqamli kataklar, moslash to'rlari, yozma maydon, yozuv va logo. Varaq skanerlangach o'zgarmaydi.</p>}
              {varaqXato && (
                <div className="rounded-xl border border-xato-chiziq bg-xato-fon p-2.5 space-y-1">
                  <p className="flex gap-1.5 text-[12px] font-semibold text-xato"><AlertTriangle size={13} className="shrink-0 mt-0.5" />Varaq dizaynida xato — chop etilmaydi</p>
                  {andozaXato.slice(0, 3).map((x, i) => <p key={i} className="text-[11.5px] text-xato">{x}</p>)}
                  <button onClick={() => setHujjat('dizayn')} className="text-[12px] font-semibold text-brand hover:underline cursor-pointer">Varaq dizaynini ochish</button>
                </div>
              )}
              {hujjat === 'kalit' && <p className="text-[12px] text-matn-sokin">Har variantning to'g'ri javoblari — kalit tuzatishlari va bekor qilingan savollar bilan. Skaner kalitni o'zi biladi: bu bet tekshiruvchilar uchun.</p>}
              {xonaKerak && (
                <Maydon nom="Xona">
                  <select className={SELECT} value={xona} onChange={e => { setXona(Number(e.target.value)); setYakka(0); }}>
                    <option value={0}>Hamma xona ({smenadagilar} kishi)</option>
                    {xonalar.map(([id, nom]) => <option key={id} value={id}>{nom} ({data.seats.filter(o => o.session === smena && o.roomId === id).length})</option>)}
                  </select>
                </Maydon>
              )}
              {hujjat === 'varaq' && (
                <>
                  <Maydon nom="Kimga" izoh="O'rni o'zgargan yoki varag'i buzilgan bitta qatnashchi uchun">
                    <select className={SELECT} value={yakka} onChange={e => setYakka(Number(e.target.value))}>
                      <option value={0}>Hammasi ({orinlar.length} kishi)</option>
                      {[...orinlar].sort((a, b) => a.name.localeCompare(b.name)).map(o => (
                        <option key={o.id} value={o.id}>{o.name} — {o.roomName}, {(o.row ?? 0) + 1}-qator, {(o.col ?? 0) + 1}-o'rin ({o.variant})</option>
                      ))}
                    </select>
                  </Maydon>
                  <Almashtirgich yoqilgan={rasmli} onChange={setRasmli} nom="O'quvchi rasmi bilan" izoh="Kirishda shaxsni tekshirish uchun; rasmsiz tezroq" />
                </>
              )}
              {hujjat === 'universal' && (
                <Maydon nom="Nechta" izoh={anonim ? "Har nusxaning o'z kodi bor — betlari birga o'qiladi, qayta skanerlansa ikki marta sanalmaydi" : "O'quvchi ID raqamini o'zi bo'yaydi (vedomostda bor)"}>
                  <input type="number" min={1} max={500} className={INPUT} value={universalSoni} onChange={e => setUniversalSoni(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
                </Maydon>
              )}
              {varaqTuri && (
                <Maydon div nom="Qog'oz">
                  <Tanlov qiymat={qogoz} onChange={setQogoz} variantlar={[{ v: 'A4', nom: 'A4' }, { v: 'A5', nom: 'A5' }, { v: 'A4x2', nom: 'A4 da 2 ta' }]} />
                </Maydon>
              )}
              {hujjat !== 'dizayn' && <p className="text-[11.5px] text-matn-xira flex gap-1.5"><Info size={13} className="shrink-0 mt-px" />
                <span>{varaqTuri ? `${qogoz === 'A4x2' ? "Har A4 da ikkita varaq (yotiq) — o'rtadan kesiladi. " : ''}Chop etish oynasida «Masshtab: 100%» va «Chetlar: yo'q» tanlang.${hujjat === 'varaq' ? " Tartib: xona → qator → o'rin." : ''}` : "Chop etish oynasida «PDF sifatida saqlash» ham bor."}</span>
              </p>}
            </div>
          </Karta>
        </div>

        {hujjat === 'dizayn' ? <VaraqDizayni exam={exam} yangila={yangila} umumiy={umumiy} /> : hujjat === 'savollar' ? <TanlanganSavollar exam={exam} onOzgardi={savolOzgardi} /> : (
          <Korinish holat={korinish} kenglik={varaqTuri && qogoz === 'A4x2' ? 1123 : varaqTuri && qogoz === 'A5' ? 560 : 794}
            izoh={hujjat === 'kalit' ? 'hamma variant' : hujjat === 'universal' ? 'namuna' : 'birinchi beti — chop etishda hammasi'}
            tugma={
              <span className="flex flex-wrap gap-2">
                {hujjat === 'kitobcha' && (
                  <Tugma ikonka={<FileDown size={15} />} yuklanmoqda={band === 'word'} disabled={!!band || !variantlar.length} onClick={wordYukla} title="Word'da tahrirlab chop etish uchun (formulalar — Word formulasi)">Word (.docx)</Tugma>
                )}
                <Tugma turi="asosiy" ikonka={<Printer size={15} />} yuklanmoqda={band === 'chop'} disabled={!!band || boshMi || varaqXato || (hujjat === 'kitobcha' && !variantlar.length)} onClick={chopEtish}>
                  Chop etish · {sanoq}
                </Tugma>
              </span>
            } />
        )}
      </div>
    </div>
  );
}

/** Jonli ko'rinish: hujjat iframe'da, panel eniga sig'adigan masshtabda. */
function Korinish({ holat, kenglik, izoh, tugma }: { holat: { html: string } | { xato: string } | null; kenglik: number; izoh: string; tugma: React.ReactNode }) {
  const quti = useRef<HTMLDivElement>(null);
  const ramka = useRef<HTMLIFrameElement>(null);
  const [masshtab, setMasshtab] = useState(1);
  useLayoutEffect(() => {
    const el = quti.current;
    if (!el) return;
    const hisobla = () => setMasshtab(Math.min(1, (el.clientWidth - 8) / (kenglik + 48)));
    hisobla();
    const ro = new ResizeObserver(hisobla);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kenglik]);
  const qoy = () => { const d = ramka.current?.contentDocument; if (d?.documentElement) d.documentElement.style.zoom = String(masshtab); };
  useEffect(qoy, [masshtab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Karta ichki="p-0" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-chiziq">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-matn"><Eye size={14} className="text-brand" /> Ko'rinish</span>
          <span className="block text-[11.5px] text-matn-xira">{izoh}</span>
        </span>
        {tugma}
      </div>
      <div ref={quti} className="relative bg-[#dfe3e8] dark:bg-[#2a2f36] h-[70vh] lg:h-[calc(100vh-190px)] min-h-[420px]">
        {!holat ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-[12.5px] text-slate-600"><Loader2 size={15} className="animate-spin" /> Tayyorlanmoqda…</div>
        ) : 'xato' in holat ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[12.5px] text-slate-600">{holat.xato}</div>
        ) : (
          <iframe ref={ramka} title="Chop etish ko'rinishi" srcDoc={holat.html} onLoad={qoy} className="absolute inset-0 w-full h-full border-0" />
        )}
      </div>
    </Karta>
  );
}
