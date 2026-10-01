import * as XLSX from 'xlsx';

// Addmen "Import candidate names from Excel": tashqi qatnashchilar ro'yxati.
// Sarlavha qatori bo'lsa ustunlar nomidan topiladi (F.I.Sh, Telefon, Maktab,
// Sinf), bo'lmasa — 1-ustun ism, 2-ustun telefon.

export interface MehmonQatori { name: string; phone: string; maktab: string; sinf: string }

const USTUN: Record<keyof MehmonQatori, RegExp> = {
  name: /f\.?\s*i\.?\s*sh|familiya|^ism|ismi|candidate|name|o'?quvchi|abituriyent|ф\.?и\.?о|фамилия|имя/i,
  phone: /tel|phone|телефон/i,
  maktab: /maktab|school|школа/i,
  sinf: /sinf|class|grade|класс/i,
};

export async function mehmonlarniOqi(fayl: File): Promise<MehmonQatori[]> {
  const wb = XLSX.read(await fayl.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const qatorlar = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' }).map(q => q.map(x => String(x ?? '').trim()));
  const sarlavhaI = qatorlar.slice(0, 10).findIndex(q => q.some(k => USTUN.name.test(k)));
  const xarita: Partial<Record<keyof MehmonQatori, number>> = {};
  if (sarlavhaI >= 0) {
    qatorlar[sarlavhaI].forEach((k, i) => {
      for (const kalit of Object.keys(USTUN) as (keyof MehmonQatori)[]) if (xarita[kalit] === undefined && USTUN[kalit].test(k)) xarita[kalit] = i;
    });
  } else {
    xarita.name = 0;
    xarita.phone = 1;
  }
  const ol = (q: string[], k: keyof MehmonQatori) => (xarita[k] !== undefined ? q[xarita[k]!] || '' : '');
  return qatorlar.slice(sarlavhaI + 1)
    .map(q => ({ name: ol(q, 'name').replace(/\s+/g, ' '), phone: ol(q, 'phone'), maktab: ol(q, 'maktab'), sinf: ol(q, 'sinf') }))
    .filter(x => x.name && !/^\d+$/.test(x.name));
}

export function mehmonShabloni() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['F.I.Sh', 'Telefon', 'Maktab', 'Sinf'],
    ['Aliyev Vali', '+998901234567', '12-maktab', '11'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Qatnashchilar');
  XLSX.writeFile(wb, 'tashqi-qatnashchilar-shablon.xlsx');
}
