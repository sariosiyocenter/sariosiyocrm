import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FileSpreadsheet, Printer, Download, Loader2, Images, Columns3 } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, INPUT, SELECT, Yuklanmoqda } from './ui';
import { chopEt } from '../../lib/chopEtish';
import { pdflarYasa } from '../../lib/htmlPdf';
import { zipYasa, yuklabOl, faylNomi } from '../../lib/zip';
import {
  HISOBOT_TURLARI, HISOBOT_CSS, USTUN_NOMI, ballRoyxatiHtml, ikkiQismliHtml, javoblarBolaklari, shaxsiyBolaklar, osishBolaklari, kelmaganlarHtml,
  savollarTahliliHtml, birlashHtml, excelYukla, kr20, orinlarniToldir, mavjudUstunlar,
  type HisobotMalumoti, type HisobotSozlama, type HisobotTuri, type SavolTahlilQatori, type UstunKodi, type HisobotNatija,
} from './hisobotlar';
import type { ImtihonTafsil } from './turlar';

// Natijalar → Hisobotlar: Addmen "Test Results" ekrani tartibida — chapda kurslar
// (GROUP), o'rtada hisobot turi (raqamlari Addmen'dagidek: 1xxx — chop etish,
// 2xxx — Excel), o'ngda tanlangan ID lar, tartib, ustunlar va "Yaratish".
// Sozlamalar brauzerda eslab qolinadi.

const SAQLASH_KALITI = 'imt_hisobot_sozlama';

export default function HisobotlarBolimi({ exam, tahlil }: { exam: ImtihonTafsil; tahlil: SavolTahlilQatori[] }) {
  const { settings, schools, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [m, setM] = useState<HisobotMalumoti | null>(null);
  const [kurslar, setKurslar] = useState<string[]>([]);
  const [smena, setSmena] = useState<number | 0>(0);
  const [idlar, setIdlar] = useState('');
  const [turi, setTuri] = useState<HisobotTuri>('1111');
  const mavjud = useMemo(() => mavjudUstunlar(exam), [exam]);
  const [s, setS] = useState<HisobotSozlama>(() => {
    const bosh: HisobotSozlama = { tartib: 'orin', kursOrni: false, kursSahifa: false, xulosa: true, ustunlar: mavjud, topN: 10 };
    try {
      const x = JSON.parse(localStorage.getItem(SAQLASH_KALITI) || 'null');
      // Yangi paydo bo'lgan ustunlar (masalan o'tish bali qo'yilgach "holat") o'zi qo'shiladi.
      if (x && Array.isArray(x.ustunlar)) return { ...bosh, ...x, ustunlar: mavjud.filter(u => x.ustunlar.includes(u) || !(x.korilgan || []).includes(u)) };
    } catch { /* buzilgan bo'lsa — standart */ }
    return bosh;
  });
  useEffect(() => { try { localStorage.setItem(SAQLASH_KALITI, JSON.stringify({ ...s, korilgan: mavjud })); } catch { /* eslab qolinmaydi */ } }, [s, mavjud]);
  const [alohidaPdf, setAlohidaPdf] = useState(false);
  const [band, setBand] = useState<string | null>(null);
  const [jarayon, setJarayon] = useState('');
  // Birlashtirish uchun ikkinchi imtihon (Addmen "Merge test").
  const [imtihonlar, setImtihonlar] = useState<{ id: number; name: string; date: string; maxScore: number; natija: number }[] | null>(null);
  const [ikkinchiId, setIkkinchiId] = useState<number | 0>(0);

  useEffect(() => {
    soro<HisobotMalumoti>('GET', `exams/${exam.id}/hisobot`)
      .then(d => setM({ ...d, natijalar: orinlarniToldir(d.natijalar, exam.settings.orinUsuli) }))
      .catch(e => showNotification(e.message, 'error'));
  }, [exam.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const barchaKurslar = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of m?.natijalar || []) c.set(r.groupName || 'Kurssiz', (c.get(r.groupName || 'Kurssiz') || 0) + 1);
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0], 'uz'));
  }, [m]);

  const tanlanganIdlar = useMemo(() => new Set(idlar.split(/[\s,;]+/).map(x => parseInt(x)).filter(Boolean)), [idlar]);
  const mos = <T extends { groupName: string; session: number | null; kod: number | null }>(r: T) =>
    (!kurslar.length || kurslar.includes(r.groupName || 'Kurssiz')) && (!smena || r.session === smena) && (!tanlanganIdlar.size || (r.kod != null && tanlanganIdlar.has(r.kod)));
  const royxat = useMemo(() => (m?.natijalar || []).filter(mos), [m, kurslar, smena, tanlanganIdlar]); // eslint-disable-line react-hooks/exhaustive-deps
  const kelmaganlar = useMemo(() => (m?.kelmaganlar || []).filter(x => mos({ ...x, session: x.session })), [m, kurslar, smena, tanlanganIdlar]); // eslint-disable-line react-hooks/exhaustive-deps
  const rasmliSoni = useMemo(() => royxat.filter(r => r.rasmlar?.length).length, [royxat]);
  const tanlov = HISOBOT_TURLARI.find(x => x.v === turi)!;
  useEffect(() => {
    if (!tanlov.birlash || imtihonlar) return;
    soro<{ id: number; name: string; date: string; maxScore: number; natija: number }[]>('GET', 'exams/history').then(l => setImtihonlar((l || [])
      .filter(x => x.id !== exam.id && x.natija > 0)
      .map(x => ({ id: x.id, name: x.name, date: x.date, maxScore: x.maxScore, natija: x.natija }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))))).catch(e => showNotification(e.message, 'error'));
  }, [tanlov.birlash]); // eslint-disable-line react-hooks/exhaustive-deps
  const ishonchlilik = useMemo(() => (m ? kr20(m.natijalar, tahlil) : null), [m, tahlil]);
  const faylIsmi = (r: HisobotNatija) => faylNomi(`${r.kod ?? 'mehmon'} ${r.name}`);

  const yarat = async () => {
    if (!m) return;
    if (tanlov.kalit && !m.kalit) return showNotification("Kalitni ko'rish ruxsati yo'q", 'error');
    const kerak = tanlov.kelmagan ? kelmaganlar.length : turi === '1241' ? tahlil.length : royxat.length;
    if (!kerak && turi !== '2331') return showNotification("Tanlovga mos yozuv yo'q", 'error');
    if (tanlov.birlash && !ikkinchiId) return showNotification("Qo'shiladigan imtihonni tanlang", 'error');
    setBand('yarat');
    setJarayon('');
    try {
      let ikkinchi = null;
      if (tanlov.birlash) {
        const ik = imtihonlar!.find(x => x.id === ikkinchiId)!;
        const d = await soro<HisobotMalumoti>('GET', `exams/${ikkinchiId}/hisobot`);
        ikkinchi = { nomi: ik.name, maxScore: ik.maxScore, natijalar: d.natijalar };
      }
      const k = {
        exam, markaz: settings?.orgName || '', royxat, kelmaganlar, malumot: m, tahlil, s, ikkinchi,
        filialNomi: (id: number) => schools.find(x => x.id === id)?.name || '',
      };
      if (tanlov.tur === 'excel') { excelYukla(k, turi); return; }
      const sarlavha = `${exam.name} — ${turi} ${tanlov.nom}`;
      if (tanlov.shaxsiy) {
        const bolaklar = turi === '1211' ? javoblarBolaklari(k) : turi === '1221' ? shaxsiyBolaklar(k) : osishBolaklari(k);
        if (alohidaPdf) {
          // Addmen "Multiple PDFs": har o'quvchiga alohida fayl, kurs papkalarida, bitta ZIP.
          setJarayon(`PDF: 0 / ${bolaklar.length}`);
          const pdflar = await pdflarYasa(HISOBOT_CSS, bolaklar.map(b => b.html), n => setJarayon(`PDF: ${n} / ${bolaklar.length}`));
          const zip = await zipYasa(bolaklar.map((b, i) => ({ nom: `${faylNomi(b.r.groupName || 'Kurssiz')}/${faylIsmi(b.r)}.pdf`, data: pdflar[i] })));
          yuklabOl(zip, `${faylNomi(sarlavha)}.zip`);
          showNotification(`${pdflar.length} ta PDF yuklab olindi (ZIP)`, 'success');
          return;
        }
        await chopEt({ sarlavha, css: HISOBOT_CSS, body: bolaklar.map(b => b.html).join('') });
        return;
      }
      const body = turi === '1311' ? birlashHtml(k) : turi === '1251' ? kelmaganlarHtml(k) : turi === '1241' ? savollarTahliliHtml(k)
        : turi === '1115' || turi === '1116' ? ikkiQismliHtml(k, turi === '1116')
          : ballRoyxatiHtml(k, turi as '1111' | '1112' | '1113' | '1114' | '1121');
      await chopEt({ sarlavha, css: HISOBOT_CSS, body });
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
      setJarayon('');
    }
  };

  // Addmen "Export sheets": skanerlangan varaq rasmlari — kurs papkalarida, "ID Ism" nomi bilan.
  const varaqRasmlari = async () => {
    const l = royxat.filter(r => r.rasmlar?.length);
    if (!l.length) return showNotification("Tanlovda skanerlangan varaq rasmi yo'q", 'error');
    setBand('rasm');
    try {
      const fayllar: { nom: string; data: Blob }[] = [];
      let n = 0, xato = 0;
      const jami = l.reduce((a, r) => a + r.rasmlar!.length, 0);
      const navbat = l.flatMap(r => r.rasmlar!.map(x => ({ r, x })));
      const ishchi = async () => {
        for (let el = navbat.shift(); el; el = navbat.shift()) {
          try {
            const javob = await fetch(el.x.url);
            if (!javob.ok) throw new Error(String(javob.status));
            const blob = await javob.blob();
            const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
            fayllar.push({ nom: `${faylNomi(el.r.groupName || 'Kurssiz')}/${faylIsmi(el.r)}${el.r.rasmlar!.length > 1 ? ` — ${el.x.sahifa}-bet` : ''}.${ext}`, data: blob });
          } catch { xato++; }
          setJarayon(`Rasm: ${++n} / ${jami}`);
        }
      };
      await Promise.all([ishchi(), ishchi(), ishchi(), ishchi()]);
      if (!fayllar.length) throw new Error('Rasmlarni yuklab bo\'lmadi');
      fayllar.sort((a, b) => a.nom.localeCompare(b.nom, 'uz'));
      yuklabOl(await zipYasa(fayllar), `${faylNomi(`${exam.name} — varaqlar`)}.zip`);
      showNotification(`${fayllar.length} ta varaq rasmi yuklab olindi${xato ? `, ${xato} tasi ochilmadi` : ''}`, xato ? 'info' : 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
      setJarayon('');
    }
  };

  if (!m) return <Yuklanmoqda />;
  const ozgar = (p: Partial<HisobotSozlama>) => setS(x => ({ ...x, ...p }));
  const katak = 'w-3.5 h-3.5 accent-[var(--color-brand)] cursor-pointer';
  const ustunAlmashtir = (u: UstunKodi) => ozgar({ ustunlar: s.ustunlar.includes(u) ? s.ustunlar.filter(x => x !== u) : mavjud.filter(x => x === u || s.ustunlar.includes(x)) });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_270px] gap-3 items-start">
      {/* Chap — kurslar (Addmen GROUP) */}
      <section className="bg-sirt border border-chiziq rounded-xl overflow-hidden" aria-label="Kurslar">
        <header className="flex items-center gap-2 px-3 py-2 border-b border-chiziq bg-ichki/60">
          <input type="checkbox" aria-label="Hamma kurs" className={katak} checked={!kurslar.length} onChange={() => setKurslar([])} />
          <h4 className="flex-1 text-[12px] font-bold text-matn">Kurslar</h4>
          <span className="text-[11px] text-matn-xira raqam">{m.natijalar.length}</span>
        </header>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {barchaKurslar.map(([nom, soni]) => (
            <li key={nom}>
              <label className="flex items-center gap-2 px-3 py-1 text-[12.5px] cursor-pointer hover:bg-ichki">
                <input type="checkbox" className={katak} checked={kurslar.includes(nom)} onChange={() => setKurslar(l => (l.includes(nom) ? l.filter(x => x !== nom) : [...l, nom]))} />
                <span className="flex-1 min-w-0 truncate text-matn">{nom}</span>
                <span className="text-[11px] text-matn-xira raqam">{soni}</span>
              </label>
            </li>
          ))}
        </ul>
        {exam.settings.sessions.length > 1 && (
          <div className="px-3 py-2 border-t border-chiziq">
            <select className={`${SELECT} py-1.5 text-[12.5px]`} value={smena} onChange={e => setSmena(Number(e.target.value))} aria-label="Smena">
              <option value={0}>Hamma smena</option>
              {exam.settings.sessions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        )}
      </section>

      {/* O'rta — hisobot turi */}
      <Karta ichki="p-0" sarlavha="Hisobot turi" izoh={`${royxat.length} ta natija tanlangan${kelmaganlar.length ? ` · ${kelmaganlar.length} ta kelmagan` : ''}${ishonchlilik != null ? ` · test ishonchliligi (KR-20): ${String(ishonchlilik).replace('.', ',')}` : ''}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 p-3" role="radiogroup" aria-label="Hisobot turi">
          {(['pdf', 'excel'] as const).map(tur => (
            <div key={tur}>
              <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-matn-sokin">
                {tur === 'pdf' ? <><FileText size={13} /> Chop etish (PDF)</> : <><FileSpreadsheet size={13} /> Excel</>}
              </p>
              {HISOBOT_TURLARI.filter(x => x.tur === tur).map(x => {
                const ochiq = !(x.kalit && !m.kalit);
                return (
                  <label key={x.v} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] ${ochiq ? 'cursor-pointer hover:bg-ichki' : 'opacity-50'} ${turi === x.v ? 'bg-brand-fon dark:bg-brand/15' : ''}`}>
                    <input type="radio" name="hisobot-turi" className="accent-[var(--color-brand)]" disabled={!ochiq} checked={turi === x.v} onChange={() => setTuri(x.v)} />
                    <span className="raqam text-matn-xira w-9 shrink-0">{x.v}</span>
                    <span className={turi === x.v ? 'font-semibold text-matn' : 'text-matn'}>{x.nom}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </Karta>

      {/* O'ng — sozlamalar va yaratish */}
      <aside className="bg-sirt border border-chiziq rounded-xl p-3 space-y-3" aria-label="Hisobot sozlamalari">
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Tanlangan ID lar (vergul bilan)</span>
          <input className={`${INPUT} py-1.5 text-[12.5px]`} value={idlar} placeholder="Hammasi" onChange={e => setIdlar(e.target.value)} />
        </label>
        {tanlov.birlash && (
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Qo'shiladigan imtihon (2-qism)</span>
            <select className={`${SELECT} py-1.5 text-[12.5px]`} value={ikkinchiId} onChange={e => setIkkinchiId(Number(e.target.value))} aria-label="Qo'shiladigan imtihon">
              <option value={0}>{imtihonlar ? 'Tanlang' : 'Yuklanmoqda…'}</option>
              {(imtihonlar || []).map(x => <option key={x.id} value={x.id}>{x.name} · {x.date} · {x.natija} natija</option>)}
            </select>
          </label>
        )}
        {turi === '2116' && (
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Har fandan nechta eng yaxshisi (TOP-N)</span>
            <input type="number" min={1} max={500} className={`${INPUT} py-1.5 text-[12.5px] w-28`} value={s.topN} onChange={e => ozgar({ topN: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} />
          </label>
        )}
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-matn-sokin mb-1">Tartib</span>
          <select className={`${SELECT} py-1.5 text-[12.5px]`} value={s.tartib} onChange={e => ozgar({ tartib: e.target.value as HisobotSozlama['tartib'] })}>
            <option value="orin">O'rin bo'yicha</option>
            <option value="alifbo">Alifbo bo'yicha</option>
            <option value="id">ID bo'yicha</option>
          </select>
        </label>
        <div className="space-y-1.5 text-[12.5px] text-matn">
          {([
            ['kursSahifa', 'Har kurs alohida sahifada'],
            ['kursOrni', "Kurs ichidagi o'rin"],
            ...(tanlov.ustunli && tanlov.tur === 'pdf' ? [['xulosa', "Xulosa: o'rtacha, eng yuqori, eng past"] as const] : []),
          ] as const).map(([k, nom]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className={katak} checked={s[k]} onChange={e => ozgar({ [k]: e.target.checked })} />{nom}
            </label>
          ))}
          {tanlov.shaxsiy && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className={`${katak} mt-0.5`} checked={alohidaPdf} onChange={e => setAlohidaPdf(e.target.checked)} />
              <span>Har o'quvchiga alohida PDF <span className="block text-[11px] text-matn-xira">ZIP, kurs papkalarida — ota-onaga yuborish uchun</span></span>
            </label>
          )}
        </div>
        {tanlov.ustunli && (
          <div>
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-matn-sokin mb-1.5"><Columns3 size={13} /> Ustunlar</p>
            <div className="flex flex-wrap gap-1">
              {mavjud.map(u => {
                const bor = s.ustunlar.includes(u);
                return (
                  <button key={u} type="button" aria-pressed={bor} onClick={() => ustunAlmashtir(u)}
                    className={`px-2 py-0.5 rounded-md border text-[11.5px] font-semibold cursor-pointer ${bor ? 'bg-brand-fon text-brand-dark border-brand/30 dark:bg-brand/20 dark:text-brand-accent' : 'bg-sirt border-chiziq text-matn-xira line-through'}`}>
                    {USTUN_NOMI[u]}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Tugma turi="asosiy" className="w-full" yuklanmoqda={band === 'yarat'} disabled={!!band && band !== 'yarat'} ikonka={tanlov.tur === 'excel' ? <Download size={14} /> : <Printer size={14} />} onClick={yarat}>
          {tanlov.tur === 'excel' ? 'Excel yuklab olish' : tanlov.shaxsiy && alohidaPdf ? 'PDF larni yuklab olish (ZIP)' : 'Yaratish va chop etish'}
        </Tugma>
        {jarayon && <p className="flex items-center gap-1.5 text-[11.5px] text-matn-xira"><Loader2 size={12} className="animate-spin" /> {jarayon}</p>}
        <div className="pt-2 border-t border-chiziq">
          <Tugma className="w-full" ikonka={<Images size={14} />} yuklanmoqda={band === 'rasm'} disabled={!rasmliSoni || (!!band && band !== 'rasm')} onClick={varaqRasmlari}>
            Varaq rasmlari (ZIP){rasmliSoni ? ` · ${rasmliSoni}` : ''}
          </Tugma>
          <p className="mt-1.5 text-[11px] text-matn-xira">Skanerlangan javob varaqalari, kurs papkalarida. Chop etish oynasida «PDF sifatida saqlash» ham bor; SMS va Telegram — «E'lon» bo'limida.</p>
        </div>
      </aside>
    </div>
  );
}
