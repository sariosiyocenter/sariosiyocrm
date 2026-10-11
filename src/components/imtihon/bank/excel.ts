import * as XLSX from 'xlsx';
import { HARFLAR, savolXatosi, qiyinlikDarajasi } from '../../../../lib/imtihon.js';

// Excel orqali savollar: shablon va o'qish. Ustunlar (shablon ham shu tartibda):
// Fan, Mavzu, Bo'lim, Tur, Savol, A–F, Javob, Qo'shimcha javoblar, Ball,
// Qiyinlik, Manba, Sinf, Til, Yechim, Holat. Moslashtirish: A–D — chap ustun,
// "Qo'shimcha javoblar" — o'ng ustun (; bilan), Javob — "PQ|R|S|T".

export const USTUNLAR = ['Fan', 'Mavzu', "Bo'lim", 'Tur', 'Savol', 'A', 'B', 'C', 'D', 'E', 'F', 'Javob', "Qo'shimcha javoblar", 'Ball', 'Qiyinlik', 'Manba', 'Sinf', 'Til', 'Yechim', 'Holat'];

export function qatordanSavol(r: Record<string, any>, qator: number) {
  const s = (k: string) => String(r[k] ?? '').trim();
  const turMatni = s('Tur').toLowerCase();
  const type = turMatni.startsWith('raq') ? 'raqamli' : turMatni.startsWith('yoz') ? 'yozma' : turMatni.startsWith('mos') || turMatni.startsWith('mat') ? 'moslash' : 'yopiq';
  const options = HARFLAR.map(h => s(h)).filter(Boolean);
  return {
    qator,
    subject: s('Fan'), topic: s('Mavzu'), section: s("Bo'lim") || null, type: type as 'yopiq' | 'raqamli' | 'moslash' | 'yozma',
    text: s('Savol'),
    options: type === 'yopiq' || type === 'moslash' ? options : null,
    correctAnswer: type === 'yopiq' || type === 'moslash' ? s('Javob').toUpperCase().replace(/\s+/g, '') : s('Javob'),
    answers: s("Qo'shimcha javoblar") ? s("Qo'shimcha javoblar").split(/[;|]/).map(x => x.trim()).filter(Boolean) : null,
    points: s('Ball') ? Number(s('Ball').replace(',', '.')) : null,
    difficulty: qiyinlikDarajasi(s('Qiyinlik') || 2),
    source: s('Manba') || null, grade: s('Sinf') || null,
    language: (['uz', 'ru', 'en'].includes(s('Til').toLowerCase()) ? s('Til').toLowerCase() : 'uz'),
    solution: s('Yechim') || null,
    solutionStatus: s('Yechim') ? 'tasdiqlangan' : 'yoq',
    status: s('Holat').toLowerCase().startsWith('qor') ? 'qoralama' : s('Holat').toLowerCase().startsWith('arx') ? 'arxiv' : 'faol',
  };
}
export type ExcelSavol = ReturnType<typeof qatordanSavol> & {
  /** Mavzu ustuni bo'sh edi — oynadagi standart mavzu qo'yildi. */
  mavzusiz?: boolean;
  /** Fan ustuni bo'sh edi — oynadagi fan qo'yildi. */
  fansiz?: boolean;
  /** Fayl turi «Yozma»: «Javob» ustunidagi yakuniy javob (yechim emas — yechim «Yechim» ustunida). */
  ustozJavobi?: string;
};

/**
 * Excel faylidagi savollar. Fan yoki mavzu ustuni bo'sh bo'lsa — `standart`
 * (oynada tanlangan fan/mavzu) qo'yiladi. Kamchiligi bor qatorlar `xatolar` da.
 * `standart.yozma` — fayl turi «Yozma»: hamma qator yozma masala (Tur ustuniga qaralmaydi);
 * «Javob» ustuni — yakuniy javob, «Yechim» — ustozning yechimi (bo'sh bo'lsa keyin AI yechadi).
 */
export async function exceldanSavollar(fayl: File, standart: { fan?: string; mavzu?: string; yozma?: boolean } = {}) {
  const wb = XLSX.read(await fayl.arrayBuffer(), { type: 'array' });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const yaroqli: ExcelSavol[] = [];
  const xatolar: { qator: number; xato: string }[] = [];
  rows.forEach((r, i) => {
    const q: ExcelSavol = qatordanSavol(r, i + 2);
    if (!q.text && !q.options?.length) return;   // bo'sh qator
    if (standart.yozma) {
      const javob = q.type === 'yozma' || !q.options?.length ? String(r.Javob ?? '').trim().slice(0, 300) : '';
      Object.assign(q, { type: 'yozma', options: null, answers: null, correctAnswer: '', ustozJavobi: javob });
    }
    if (!q.subject && standart.fan) { q.subject = standart.fan; q.fansiz = true; }
    if (!q.topic && standart.mavzu) { q.topic = standart.mavzu; q.mavzusiz = true; }
    const x = !q.subject ? "Fan yo'q" : !q.topic ? "Mavzu yo'q" : q.status === 'faol' ? savolXatosi(q as any) : null;
    if (x) xatolar.push({ qator: i + 2, xato: x }); else yaroqli.push(q);
  });
  return { yaroqli, xatolar, jami: rows.length };
}

export function shablonniYukla() {
  const namuna = [
    { Fan: 'Matematika', Mavzu: 'Kvadrat tenglamalar', "Bo'lim": 'Algebra', Tur: 'yopiq', Savol: '$x^2-5x+6=0$ tenglamaning ildizlari yig\'indisini toping', A: '5', B: '6', C: '-5', D: '1', Javob: 'A', Qiyinlik: "o'rta", Manba: 'DTM 2025', Til: 'uz', Yechim: "Viyet teoremasi: $x_1+x_2=5$" },
    { Fan: 'Matematika', Mavzu: 'Oddiy kasrlar', "Bo'lim": 'Arifmetika', Tur: 'raqamli', Savol: '$\\frac{3}{4}-\\frac{1}{4}$ ni hisoblang', Javob: '1/2', "Qo'shimcha javoblar": '0,5', Qiyinlik: 'oson', Til: 'uz' },
    { Fan: 'Matematika', Mavzu: 'Geometriya', Tur: 'moslash', Savol: "Shakllarni xossalari bilan moslang", A: 'Kvadrat', B: 'Romb', C: "To'g'ri to'rtburchak", D: 'Parallelogramm', "Qo'shimcha javoblar": "Diagonallari teng; Diagonallari perpendikulyar; Qarama-qarshi tomonlari parallel; Hamma burchaklari to'g'ri", Javob: 'PQRS|QR|PRS|R', Qiyinlik: "o'rta", Til: 'uz' },
    { Fan: 'Matematika', Mavzu: 'Matnli masalalar', Tur: 'yozma', Savol: 'Masalani yeching va yechimini yozing: ...', Ball: 5, Qiyinlik: 'qiyin', Til: 'uz' },
  ];
  const ws = XLSX.utils.json_to_sheet(namuna, { header: USTUNLAR });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
  XLSX.writeFile(wb, 'savollar-shablon.xlsx');
}
