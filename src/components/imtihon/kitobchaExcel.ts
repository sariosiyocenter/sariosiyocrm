import * as XLSX from 'xlsx';
import { oddiyMatn } from '../../lib/matn';
import { HARFLAR, raqamYorligi } from '../../../lib/imtihon.js';
import type { Exam } from '../../types';
import type { KalitMalumoti } from './chop';

// Addmen QPG «Excel output» va «Shuffle index»: savol qog'ozi Excel'da.
//  • «Aralash indeksi» — har savol (bankdagi ID) qaysi variantda nechanchi raqamda va javobi qaysi harf:
//    variantlar tahlili, qayta ishlatish va «B dagi 7-savol — A dagi nechanchi?» savoli uchun.
//  • Har variant — alohida varaq: raqam, fan, mavzu, savol, javoblar (variantdagi tartibda), to'g'ri javob.
// Formulalar $…$ ko'rinishida qoladi (Excel formulani chiza olmaydi).

type Element = KalitMalumoti['variants'][number]['items'][number];

const javobi = (d: KalitMalumoti, it: Element): string => {
  const bekor = it.bekor || (it.q != null ? d.cancelled[it.q] : null);
  if (bekor) return bekor === 'hammaga' ? 'bekor (hammaga)' : 'chiqarilgan';
  const tuz = it.q != null ? d.keyFix[it.q] : null;
  if (tuz && it.t === 'yopiq' && it.m) return tuz.map(h => HARFLAR[it.m!.indexOf(HARFLAR.indexOf(String(h).toUpperCase()))]).filter(Boolean).join('');
  if (tuz) return tuz.join('; ');
  return Array.isArray(it.javob) ? it.javob.join('; ') : it.javob || '';
};

const qisqa = (html: string | undefined, n = 32000): string => oddiyMatn(html || '').replace(/\s+/g, ' ').trim().slice(0, n);

export function kitobchaExcel(exam: Exam, d: KalitMalumoti, session: number): Blob {
  const variantlar = d.variants.filter(v => v.session === session);
  const savolMap = new Map((d.savollar || []).map(q => [q.id, q]));
  const fan = (b: number) => exam.blocks[b]?.subject || '';
  const wb = XLSX.utils.book_new();

  // 1) Aralash indeksi — birinchi variant tartibida, keyin boshqa variantlarda uchraganlari.
  const tartib: number[] = [];
  const korilgan = new Set<number>();
  for (const v of variantlar) for (const it of v.items) if (it.q != null && !korilgan.has(it.q)) { korilgan.add(it.q); tartib.push(it.q); }
  const orni = new Map(variantlar.map(v => [v.code, new Map(v.items.filter(it => it.q != null).map(it => [it.q!, it]))]));
  const indeks: (string | number)[][] = [[
    'Savol ID', 'Fan', 'Mavzu', 'Savol',
    ...variantlar.flatMap(v => [`${v.code}: raqam`, `${v.code}: javob`]),
  ]];
  for (const qid of tartib) {
    const q = savolMap.get(qid);
    const birinchi = variantlar.map(v => orni.get(v.code)!.get(qid)).find(Boolean);
    indeks.push([
      qid, birinchi ? fan(birinchi.b) : q?.subject || '', q?.topic || '', qisqa(q?.text, 300),
      ...variantlar.flatMap(v => { const it = orni.get(v.code)!.get(qid); return it ? [raqamYorligi(it), javobi(d, it)] : ['—', '']; }),
    ]);
  }
  const wsI = XLSX.utils.aoa_to_sheet(indeks);
  wsI['!cols'] = [{ wch: 9 }, { wch: 16 }, { wch: 22 }, { wch: 60 }, ...variantlar.flatMap(() => [{ wch: 9 }, { wch: 9 }])];
  wsI['!freeze'] = { xSplit: 1, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsI, 'Aralash indeksi');

  // 2) Har variant alohida varaqda.
  const harflar = Math.max(4, ...(d.savollar || []).map(q => q.options.length));
  for (const v of variantlar) {
    const qatorlar: (string | number)[][] = [['№', 'Fan', 'Mavzu', 'Turi', 'Savol', ...HARFLAR.slice(0, harflar), "To'g'ri javob", 'Savol ID']];
    for (const it of v.items) {
      const q = it.q != null ? savolMap.get(it.q) : undefined;
      const tartibM = it.m && it.m.length ? it.m : (q?.options || []).map((_, i) => i);
      const javoblar = it.t === 'yopiq' ? Array.from({ length: harflar }, (_, i) => (tartibM[i] != null ? qisqa(q?.options[tartibM[i]], 2000) : '')) : Array.from({ length: harflar }, () => '');
      qatorlar.push([raqamYorligi(it), fan(it.b), q?.topic || '', it.t, qisqa(q?.text), ...javoblar, it.t === 'yozma' ? 'yozma' : javobi(d, it), it.q ?? '']);
    }
    const ws = XLSX.utils.aoa_to_sheet(qatorlar);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 20 }, { wch: 9 }, { wch: 70 }, ...HARFLAR.slice(0, harflar).map(() => ({ wch: 22 })), { wch: 12 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws, `Variant ${v.code}`);
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const kitobchaExcelNomi = (exam: Exam): string => `${exam.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'imtihon'} — savollar va aralash indeksi.xlsx`;
