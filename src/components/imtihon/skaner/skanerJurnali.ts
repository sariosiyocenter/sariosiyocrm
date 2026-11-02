import * as XLSX from 'xlsx';
import { SARALASH, saralashKodi } from '../../../lib/omr/saralash';
import type { Element } from './turlar';

// Addmen «Scan log»: shu kompyuterda shu ochilishda o'qilgan varaqlar — vaqti, fayli, natijasi va
// saralash kodi. Smena oxirida qaysi fayl o'qilmay qolganini topish va topshirish uchun.

const HOLAT: Record<Element['holat'], string> = {
  kutmoqda: 'kutmoqda', oqilmoqda: "o'qilmoqda", saqlanmoqda: 'saqlanmoqda', tayyor: 'saqlandi', aniqlanmadi: 'kimniki aniqlanmadi', xato: 'xato',
};

const vaqtMatni = (ms: number): string => {
  const d = new Date(ms);
  const i = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${i(d.getMonth() + 1)}-${i(d.getDate())} ${i(d.getHours())}:${i(d.getMinutes())}:${i(d.getSeconds())}`;
};

export function jurnalQatorlari(navbat: Element[]): (string | number)[][] {
  const sarlavha = ['Vaqt', 'Fayl', 'Sahifa', 'Holat', 'Kod', 'Kod izohi', 'Qatnashchi', 'Varaq kodi', 'Ball', 'Shubhali javoblar', 'Variant', 'Xato'];
  // Navbatda yangisi tepada — jurnalda vaqt tartibida.
  const qatorlar = [...navbat].sort((a, b) => a.vaqt - b.vaqt || a.id - b.id).map(e => {
    const k = saralashKodi(e) || '';
    return [
      vaqtMatni(e.vaqt), e.nom, e.oqish?.page || '', HOLAT[e.holat], k, k ? SARALASH[k] : '',
      e.natija?.name || e.takrorId?.name || '', e.natija?.sheetCode || (e.oqish?.qr?.turi === 'S' ? e.oqish.qr.sheetCode || '' : ''),
      e.natija ? e.natija.score : '', e.natija ? e.natija.shubhalar : '', e.oqish?.variant || '', e.xato || '',
    ];
  });
  return [sarlavha, ...qatorlar];
}

export function jurnalExcel(navbat: Element[]): Blob {
  const ws = XLSX.utils.aoa_to_sheet(jurnalQatorlari(navbat));
  ws['!cols'] = [{ wch: 19 }, { wch: 34 }, { wch: 7 }, { wch: 18 }, { wch: 6 }, { wch: 40 }, { wch: 28 }, { wch: 12 }, { wch: 7 }, { wch: 9 }, { wch: 8 }, { wch: 50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Skaner jurnali');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const jurnalNomi = (examName: string): string => `${examName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'imtihon'} — skaner jurnali ${vaqtMatni(Date.now()).slice(0, 16).replace(':', '-')}.xlsx`;
