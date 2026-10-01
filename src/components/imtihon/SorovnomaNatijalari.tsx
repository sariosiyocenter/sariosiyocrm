import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Printer, MessageSquareText } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, SELECT, Yuklanmoqda, BoshHolat } from './ui';
import StatTile from '../ui/StatTile';
import { chopEt, esc } from '../../lib/chopEtish';
import { HARFLAR, sorovnomaYorliqlari } from '../../../lib/imtihon.js';
import type { HisobotMalumoti } from './hisobotlar';
import type { ImtihonTafsil } from './turlar';

// So'rovnoma natijalari (Addmen "Survey Data & Analysis"): har savol bo'yicha
// javoblar taqsimoti, o'rtacha va qoniqish indeksi; kurs, filial, smena bo'yicha
// kesim (anonim bo'lmasa). Excel va chop etish.

interface SavolNatija { matn: string; yorliqlar: string[]; soni: number[]; bosh: number; kop: number; javob: number; ortacha: number | null; indeks: number | null }

/** "Ha / Yo'q" kabi shkalada ijobiy javob boshida, qolganlarida oxirida. */
const ijobiyBoshida = (y: string[]) => /^ha$/i.test(y[0]?.trim() || '');
const RANGLAR = ['#c62828', '#ef6c00', '#9e9e9e', '#7cb342', '#2e7d32', '#1b5e20'];
const rang = (i: number, k: number, teskari: boolean) => {
  const t = teskari ? k - 1 - i : i;
  if (k === 2) return t === 0 ? RANGLAR[0] : RANGLAR[4];
  if (k === 3) return [RANGLAR[0], RANGLAR[2], RANGLAR[4]][t];
  return RANGLAR[Math.round((t / (k - 1)) * 4)];
};

export default function SorovnomaNatijalari({ exam }: { exam: ImtihonTafsil }) {
  const { settings, schools, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const sv = exam.settings.sorovnoma;
  const [m, setM] = useState<HisobotMalumoti | null>(null);
  const [kurs, setKurs] = useState('');
  const [filial, setFilial] = useState(0);
  const [smena, setSmena] = useState(0);

  useEffect(() => { soro<HisobotMalumoti>('GET', `exams/${exam.id}/hisobot`).then(setM).catch(e => showNotification(e.message, 'error')); }, [exam.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const royxat = useMemo(() => (m?.natijalar || []).filter(r => (!kurs || (r.groupName || 'Kurssiz') === kurs) && (!filial || r.schoolId === filial) && (!smena || r.session === smena)), [m, kurs, filial, smena]);
  const savollar: SavolNatija[] = useMemo(() => sv.savollar.map((q, i) => {
    const yorliqlar = sorovnomaYorliqlari(sv, q) as string[];
    const soni = yorliqlar.map(() => 0);
    let bosh = 0, kop = 0;
    for (const r of royxat) {
      const d = r.detail.find(x => x.n === i + 1);
      const j = HARFLAR.indexOf(d?.javob || '');
      if (!d?.javob) bosh++;
      else if (d.javob === '*') kop++;
      else if (j >= 0 && j < soni.length) soni[j]++;
    }
    const javob = soni.reduce((a, x) => a + x, 0);
    const k = yorliqlar.length;
    const ortacha = javob ? soni.reduce((a, x, j) => a + x * (j + 1), 0) / javob : null;
    const teskari = ijobiyBoshida(yorliqlar);
    const indeks = ortacha == null ? null : Math.round(((teskari ? k - ortacha : ortacha - 1) / (k - 1)) * 100);
    return { matn: q.matn, yorliqlar, soni, bosh, kop, javob, ortacha, indeks };
  }), [sv, royxat]);
  const umumiyIndeks = useMemo(() => {
    const l = savollar.map(s => s.indeks).filter((x): x is number => x != null);
    return l.length ? Math.round(l.reduce((a, x) => a + x, 0) / l.length) : null;
  }, [savollar]);
  const kurslar = useMemo(() => [...new Set((m?.natijalar || []).map(r => r.groupName || 'Kurssiz'))].sort((a, b) => a.localeCompare(b, 'uz')), [m]);
  const filiallar = useMemo(() => [...new Set((m?.natijalar || []).map(r => r.schoolId))], [m]);
  const filialNomi = (id: number) => schools.find(x => x.id === id)?.name || '';
  const kesim = [kurs && `Kurs: ${kurs}`, filial && `Filial: ${filialNomi(filial)}`, smena && exam.settings.sessions.find(x => x.id === smena)?.name].filter(Boolean).join(' · ');
  const foiz = (x: number, j: number) => (j ? Math.round((x / j) * 100) : 0);

  const excel = () => {
    const wb = XLSX.utils.book_new();
    const maxK = Math.max(...savollar.map(s => s.yorliqlar.length));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savollar.map((s, i) => {
      const o: Record<string, unknown> = { '№': i + 1, Savol: s.matn, Javoblar: s.javob };
      for (let j = 0; j < maxK; j++) { o[`${j + 1}`] = s.yorliqlar[j] ? `${s.soni[j]} (${foiz(s.soni[j], s.javob)}%) ${s.yorliqlar[j]}` : ''; }
      o["Bo'sh"] = s.bosh; o["Ko'p belgi"] = s.kop; o["O'rtacha"] = s.ortacha != null ? Math.round(s.ortacha * 100) / 100 : ''; o['Indeks (%)'] = s.indeks ?? '';
      return o;
    })), 'Savollar');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(royxat.map((r, i) => {
      const o: Record<string, unknown> = { '№': i + 1, ...(sv.anonim ? {} : { Ism: r.name, Kurs: r.groupName }) };
      sv.savollar.forEach((q, n) => { const d = r.detail.find(x => x.n === n + 1); const j = HARFLAR.indexOf(d?.javob || ''); o[`${n + 1}`] = j >= 0 ? j + 1 : d?.javob === '*' ? '*' : ''; });
      return o;
    })), 'Javoblar');
    XLSX.writeFile(wb, `${exam.name} — so'rovnoma.xlsx`.replace(/[\\/:*?"<>|]/g, ' '));
  };

  const chop = () => chopEt({
    sarlavha: `${exam.name} — so'rovnoma natijalari`,
    css: `@page { size: A4; margin: 12mm; } body { font: 10pt/1.35 Arial, sans-serif; color: #000; } h1 { font-size: 16pt; margin: 0 0 1mm; } .izoh { color: #444; font-size: 9pt; margin-bottom: 4mm; }
      .sv { break-inside: avoid; margin-bottom: 4mm; } .sv b { font-size: 10.5pt; } .bar { display: flex; height: 5mm; border: .5pt solid #888; margin: 1.5mm 0; } .bar div { height: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .leg { display: flex; flex-wrap: wrap; gap: 1mm 4mm; font-size: 8.5pt; color: #333; } .leg i { display: inline-block; width: 3mm; height: 3mm; margin-right: 1mm; vertical-align: -.5mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,
    body: `<div class="izoh">${esc(settings?.orgName || '')}</div><h1>${esc(exam.name)}</h1>
      <div class="izoh">${esc(exam.date)} · ${royxat.length} ta javob varag'i${kesim ? ` · ${esc(kesim)}` : ''}${umumiyIndeks != null ? ` · qoniqish indeksi ${umumiyIndeks}%` : ''}</div>
      ${savollar.map((s, i) => { const t = ijobiyBoshida(s.yorliqlar); return `<div class="sv"><b>${i + 1}. ${esc(s.matn)}</b>
        <div class="bar">${s.soni.map((x, j) => (x ? `<div style="width:${foiz(x, s.javob)}%;background:${rang(j, s.yorliqlar.length, t)}"></div>` : '')).join('')}</div>
        <div class="leg">${s.yorliqlar.map((y, j) => `<span><i style="background:${rang(j, s.yorliqlar.length, t)}"></i>${j + 1} — ${esc(y)}: <b>${s.soni[j]}</b> (${foiz(s.soni[j], s.javob)}%)</span>`).join('')}
          <span>· javob ${s.javob}${s.bosh ? `, bo'sh ${s.bosh}` : ''}${s.ortacha != null ? `, o'rtacha ${s.ortacha.toFixed(2).replace('.', ',')}` : ''}${s.indeks != null ? `, indeks ${s.indeks}%` : ''}</span></div></div>`; }).join('')}`,
  });

  if (!m) return <Yuklanmoqda />;
  if (!m.natijalar.length) return <Karta><BoshHolat ikonka={<MessageSquareText size={20} />} sarlavha="Hali javob yo'q" izoh="Varaqlarni «Chop etish»dan chiqarib, to'ldirilganini «Skaner»da o'qing." /></Karta>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Javob varaqlari" value={royxat.length} />
        <StatTile label="Savollar" value={sv.savollar.length} />
        <StatTile label="Qoniqish indeksi" value={umumiyIndeks != null ? `${umumiyIndeks}%` : '—'} />
        <StatTile label="Bo'sh javoblar" value={savollar.reduce((a, s) => a + s.bosh, 0)} />
      </div>
      <Karta sarlavha="Savollar bo'yicha" izoh={kesim || (sv.anonim ? 'Anonim — hamma javoblar' : 'Hamma qatnashchilar')}
        amallar={
          <div className="flex flex-wrap items-center gap-2">
            {!sv.anonim && kurslar.length > 1 && (
              <select className={`${SELECT} py-1.5 w-auto text-[12.5px]`} value={kurs} onChange={e => setKurs(e.target.value)} aria-label="Kurs">
                <option value="">Hamma kurs</option>{kurslar.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            )}
            {filiallar.length > 1 && (
              <select className={`${SELECT} py-1.5 w-auto text-[12.5px]`} value={filial} onChange={e => setFilial(Number(e.target.value))} aria-label="Filial">
                <option value={0}>Hamma filial</option>{filiallar.map(f => <option key={f} value={f}>{filialNomi(f)}</option>)}
              </select>
            )}
            {exam.settings.sessions.length > 1 && (
              <select className={`${SELECT} py-1.5 w-auto text-[12.5px]`} value={smena} onChange={e => setSmena(Number(e.target.value))} aria-label="Smena">
                <option value={0}>Hamma smena</option>{exam.settings.sessions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            <Tugma kichik ikonka={<Download size={13} />} onClick={excel}>Excel</Tugma>
            <Tugma kichik ikonka={<Printer size={13} />} onClick={chop}>Chop etish</Tugma>
          </div>
        }>
        <ol className="space-y-4">
          {savollar.map((s, i) => {
            const t = ijobiyBoshida(s.yorliqlar);
            return (
              <li key={i}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-matn"><span className="raqam text-matn-xira mr-1.5">{i + 1}.</span>{s.matn}</p>
                  <span className="shrink-0 text-[12px] text-matn-sokin raqam">{s.ortacha != null ? <>o'rtacha <b className="text-matn">{s.ortacha.toFixed(2).replace('.', ',')}</b></> : '—'}{s.indeks != null && <> · <b className={s.indeks >= 70 ? 'text-yaxshi' : s.indeks >= 40 ? 'text-ogoh' : 'text-xato'}>{s.indeks}%</b></>}</span>
                </div>
                <div className="flex h-3 mt-1.5 rounded-full overflow-hidden bg-ichki" role="img" aria-label={s.yorliqlar.map((y, j) => `${y}: ${s.soni[j]}`).join(', ')}>
                  {s.soni.map((x, j) => x > 0 && <div key={j} style={{ width: `${foiz(x, s.javob)}%`, background: rang(j, s.yorliqlar.length, t) }} title={`${s.yorliqlar[j]}: ${x}`} />)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11.5px] text-matn-sokin">
                  {s.yorliqlar.map((y, j) => (
                    <span key={j} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: rang(j, s.yorliqlar.length, t) }} />{y}: <b className="text-matn raqam">{s.soni[j]}</b> <span className="raqam">({foiz(s.soni[j], s.javob)}%)</span></span>
                  ))}
                  {(s.bosh > 0 || s.kop > 0) && <span className="text-matn-xira">{s.bosh ? `bo'sh ${s.bosh}` : ''}{s.kop ? ` · ko'p belgi ${s.kop}` : ''}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </Karta>
    </div>
  );
}
