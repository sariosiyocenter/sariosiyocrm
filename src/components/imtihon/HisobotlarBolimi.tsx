import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FileSpreadsheet, Printer, Download, Loader2 } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, INPUT, SELECT, Yuklanmoqda } from './ui';
import { chopEt } from '../../lib/chopEtish';
import {
  HISOBOT_TURLARI, HISOBOT_CSS, ballRoyxatiHtml, javoblarHtml, shaxsiyHisobotHtml, kelmaganlarHtml, savollarTahliliHtml, excelYukla, kr20,
  type HisobotMalumoti, type HisobotSozlama, type HisobotTuri, type SavolTahlilQatori,
} from './hisobotlar';
import type { ImtihonTafsil } from './turlar';

// Natijalar → Hisobotlar: Addmen "Test Results" ekrani tartibida — chapda kurslar
// (GROUP), o'rtada hisobot turi (raqamlari ham Addmen'dagidek: 1xxx — chop etish,
// 2xxx — Excel), o'ngda tartib va sozlamalar, "Yaratish".

export default function HisobotlarBolimi({ exam, tahlil }: { exam: ImtihonTafsil; tahlil: SavolTahlilQatori[] }) {
  const { settings, schools, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [m, setM] = useState<HisobotMalumoti | null>(null);
  const [kurslar, setKurslar] = useState<string[]>([]);
  const [smena, setSmena] = useState<number | 0>(0);
  const [idlar, setIdlar] = useState('');
  const [turi, setTuri] = useState<HisobotTuri>('1111');
  const [s, setS] = useState<HisobotSozlama>({ tartib: 'orin', kursOrni: false, kursSahifa: false, foiz: false, persentil: true });
  const [band, setBand] = useState(false);

  useEffect(() => {
    soro<HisobotMalumoti>('GET', `exams/${exam.id}/hisobot`).then(setM).catch(e => showNotification(e.message, 'error'));
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
  const tanlov = HISOBOT_TURLARI.find(x => x.v === turi)!;
  const ishonchlilik = useMemo(() => (m ? kr20(m.natijalar, tahlil) : null), [m, tahlil]);

  const yarat = async () => {
    if (!m) return;
    if (tanlov.kalit && !m.kalit) return showNotification("Kalitni ko'rish ruxsati yo'q", 'error');
    const kerak = turi === '1231' || turi === '2321' ? kelmaganlar.length : turi === '1241' ? tahlil.length : royxat.length;
    if (!kerak && turi !== '2331') return showNotification("Tanlovga mos yozuv yo'q", 'error');
    const k = {
      exam, markaz: settings?.orgName || '', royxat, kelmaganlar, malumot: m, tahlil, s,
      filialNomi: (id: number) => schools.find(x => x.id === id)?.name || '',
    };
    setBand(true);
    try {
      if (tanlov.tur === 'excel') { excelYukla(k, turi); return; }
      const body = turi === '1211' ? javoblarHtml(k) : turi === '1221' ? shaxsiyHisobotHtml(k) : turi === '1231' ? kelmaganlarHtml(k)
        : turi === '1241' ? savollarTahliliHtml(k) : ballRoyxatiHtml(k, turi as '1111' | '1112' | '1113');
      await chopEt({ sarlavha: `${exam.name} — ${tanlov.nom}`, css: HISOBOT_CSS, body });
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  if (!m) return <Yuklanmoqda />;
  const ozgar = (p: Partial<HisobotSozlama>) => setS(x => ({ ...x, ...p }));
  const katak = 'w-3.5 h-3.5 accent-[var(--color-brand)] cursor-pointer';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_260px] gap-3 items-start">
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
                    <span className="raqam text-matn-xira w-9">{x.v}</span>
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
            ['foiz', "Ball o'rniga foiz"],
            ['persentil', 'Persentil ustuni'],
          ] as const).map(([k, nom]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className={katak} checked={s[k]} onChange={e => ozgar({ [k]: e.target.checked })} />{nom}
            </label>
          ))}
        </div>
        <Tugma turi="asosiy" className="w-full" yuklanmoqda={band} ikonka={tanlov.tur === 'excel' ? <Download size={14} /> : <Printer size={14} />} onClick={yarat}>
          {tanlov.tur === 'excel' ? 'Excel yuklab olish' : 'Yaratish va chop etish'}
        </Tugma>
        {band && <p className="flex items-center gap-1.5 text-[11.5px] text-matn-xira"><Loader2 size={12} className="animate-spin" /> Tayyorlanmoqda…</p>}
        <p className="text-[11px] text-matn-xira">Chop etish oynasida «PDF sifatida saqlash» ham bor. SMS va Telegram — «E'lon» bo'limida.</p>
      </aside>
    </div>
  );
}
