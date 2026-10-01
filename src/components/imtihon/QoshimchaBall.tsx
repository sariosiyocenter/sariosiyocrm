import React, { useRef, useState } from 'react';
import { X, Download, FileSpreadsheet, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Tugma, INPUT, Maydon } from './ui';
import type { HisobotMalumoti } from './hisobotlar';
import type { ImtihonTafsil } from './turlar';

// Qo'shimcha ball (Addmen "Manual scores"): og'zaki, yozma ish va boshqa tashqi
// ballar Excel'dan. Qator — o'quvchi ID si (5 xonali) yoki F.I.Sh va ball. Ball
// jami ballga va foizga qo'shiladi; e'lon qilingan bo'lsa — reytingni yangilang.

type Qator = { kod: number | null; ism: string; ball: string };
const ustun = (sarlavhalar: string[], re: RegExp) => sarlavhalar.find(h => re.test(h.trim()));

export default function QoshimchaBallOynasi({ exam, onYop, onOzgardi }: { exam: ImtihonTafsil; onYop: () => void; onOzgardi: () => void }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [nom, setNom] = useState('');
  const [max, setMax] = useState('');
  const [fayl, setFayl] = useState<{ nom: string; qatorlar: Qator[] } | null>(null);
  const [natija, setNatija] = useState<{ yangilandi: number; topilmadi: string[]; xato: string[] } | null>(null);
  const [band, setBand] = useState(false);
  const faylRef = useRef<HTMLInputElement>(null);
  const bor = exam.settings.qoshimcha || [];

  const oqi = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const sarlavhalar = Object.keys(rows[0] || {});
      const id = ustun(sarlavhalar, /^(id|kod|o.?quvchi id|abituriyent id|candidate id)$/i);
      const ism = ustun(sarlavhalar, /(f\.?\s*i\.?\s*sh|ism|familiya|name)/i);
      const ball = ustun(sarlavhalar, /^(ball|score|baho|natija)/i) || sarlavhalar[sarlavhalar.length - 1];
      if (!id && !ism) throw new Error("«ID» yoki «F.I.Sh» ustuni topilmadi — shablonni yuklab oling");
      const qatorlar = rows.map(r => ({ kod: id ? parseInt(String(r[id])) || null : null, ism: ism ? String(r[ism] ?? '').trim() : '', ball: String(r[ball] ?? '').trim() }))
        .filter(q => (q.kod || q.ism) && q.ball !== '');
      if (!qatorlar.length) throw new Error("Ball yozilgan qator yo'q");
      setFayl({ nom: f.name, qatorlar });
      setNatija(null);
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const shablon = async () => {
    try {
      const m = await soro<HisobotMalumoti>('GET', `exams/${exam.id}/hisobot`);
      const qatorlar = [...m.natijalar].sort((a, b) => a.groupName.localeCompare(b.groupName, 'uz') || a.name.localeCompare(b.name, 'uz'))
        .map(r => ({ ID: r.kod ?? '', 'F.I.Sh': r.name, Kurs: r.groupName, Ball: '' }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qatorlar), 'Ball');
      XLSX.writeFile(wb, `${exam.name} — ${nom || "qo'shimcha ball"} (shablon).xlsx`);
    } catch (e: any) { showNotification(e.message, 'error'); }
  };

  const yukla = async () => {
    if (!fayl) return;
    setBand(true);
    try {
      const r = await soro<{ yangilandi: number; topilmadi: string[]; xato: string[] }>('POST', `exams/${exam.id}/qoshimcha-ball`, { nom, max, qatorlar: fayl.qatorlar });
      setNatija(r);
      showNotification(`«${nom}»: ${r.yangilandi} ta natijaga ball qo'yildi${exam.publishedAt ? ' — reytingni «E\'lon» bo\'limida yangilang' : ''}`, 'success');
      onOzgardi();
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  const ochir = async (n: string) => {
    if (!(await confirm(`«${n}» qo'shimcha bali hamma natijadan olib tashlansinmi?`))) return;
    try {
      await soro('DELETE', `exams/${exam.id}/qoshimcha-ball?nom=${encodeURIComponent(n)}`);
      showNotification(`«${n}» olib tashlandi`, 'info');
      onOzgardi();
    } catch (e: any) { showNotification(e.message, 'error'); }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Qo'shimcha ball">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-lg border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn">Qo'shimcha ball (Excel)</h3>
            <p className="text-[12px] text-matn-xira">Og'zaki, yozma ish va boshqa tashqi ballar — jami ballga qo'shiladi</p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {bor.length > 0 && (
            <ul className="rounded-xl border border-chiziq divide-y divide-chiziq">
              {bor.map(q => (
                <li key={q.nom} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                  <span className="flex-1 text-matn"><b>{q.nom}</b> <span className="text-matn-xira">· eng yuqori {String(q.max).replace('.', ',')} ball</span></span>
                  <button className="text-[12px] text-brand hover:underline cursor-pointer" onClick={() => { setNom(q.nom); setMax(String(q.max)); }}>Qayta yuklash</button>
                  <button aria-label={`${q.nom} — olib tashlash`} onClick={() => ochir(q.nom)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato hover:bg-ichki cursor-pointer"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Maydon nom="Nomi"><input className={INPUT} value={nom} placeholder="Og'zaki" onChange={e => setNom(e.target.value)} /></Maydon>
            <Maydon nom="Eng yuqori ball"><input className={INPUT} inputMode="decimal" value={max} placeholder="20" onChange={e => setMax(e.target.value)} /></Maydon>
          </div>
          <div className="rounded-xl border-2 border-dashed border-chiziq-kuchli bg-ichki px-4 py-4 text-center space-y-2">
            {fayl ? (
              <p className="inline-flex items-center gap-2 text-[12.5px] text-matn"><FileSpreadsheet size={15} className="text-yaxshi" /> {fayl.nom} · <b>{fayl.qatorlar.length}</b> ta qator</p>
            ) : <p className="text-[12px] text-matn-xira">Ustunlar: <b>ID</b> (yoki <b>F.I.Sh</b>) va <b>Ball</b></p>}
            <div className="flex flex-wrap justify-center gap-2">
              <Tugma kichik ikonka={<FileSpreadsheet size={13} />} onClick={() => faylRef.current?.click()}>{fayl ? 'Boshqa fayl' : 'Excel tanlash'}</Tugma>
              <Tugma kichik turi="oddiy" ikonka={<Download size={13} />} onClick={shablon}>Shablon (qatnashchilar bilan)</Tugma>
            </div>
            <input ref={faylRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="Ball fayli" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) oqi(f); }} />
          </div>
          {natija && (
            <div className="space-y-1.5 text-[12.5px]">
              <p className="flex items-center gap-1.5 text-yaxshi"><CheckCircle2 size={14} /> {natija.yangilandi} ta natijaga qo'yildi</p>
              {natija.topilmadi.length > 0 && <p className="flex items-start gap-1.5 text-ogoh"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Topilmadi ({natija.topilmadi.length}): {natija.topilmadi.slice(0, 8).join(', ')}{natija.topilmadi.length > 8 ? '…' : ''}</p>}
              {natija.xato.length > 0 && <p className="flex items-start gap-1.5 text-xato"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Noto'g'ri ball ({natija.xato.length}): {natija.xato.slice(0, 5).join(', ')}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-chiziq">
          <Tugma onClick={onYop}>Yopish</Tugma>
          <Tugma turi="asosiy" yuklanmoqda={band} disabled={!fayl || !nom.trim() || !(Number(max.replace(',', '.')) > 0)} onClick={yukla}>Ballarni qo'yish</Tugma>
        </div>
      </div>
    </div>
  );
}
