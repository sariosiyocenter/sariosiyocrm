import { docxYasa, matnRun, Rasmlar } from '../../../lib/docx';
import { faylTuriNomi, type FaylTuri } from './faylTuri';

// Word shablon (Addmen'da "QR file" deyiladi — QR kodga aloqasi yo'q): ustoz to'ldiradigan
// bo'sh Word jadvali. To'ldirilgan fayl «Savol qo'shish → Fayldan» orqali AI siz o'qiladi
// (wordShablon.ts). Har fayl turining o'z jadvali bor (egasi, 2026-10-10: "guruhli savollarga
// ham Word shablon tayyor bo'lsin"):
//   4 variantli — № | Savol | A | B | C | D | (E) | Javob; qo'shimcha til(lar) tanlansa har savol
//                 ostida "N (ru)", "N (en)" qatorlari — o'sha savolning tarjimasi;
//   MS-33-35    — № | Umumiy shart / savol | A–F | Javob: «1» qatorida shart va javoblar ro'yxati,
//                 «1.1», «1.2», «1.3» qatorlarida savollar va to'g'ri javob harfi;
//   MS-36-45    — № | Shart / qism | Javob: «1» qatorida shart, «1a», «1b» qatorlarida qismlar;
//   Yozma       — № | Savol | Javob | Yechim (yechim bo'sh qolsa — AI yechadi).

const TIL_NOMI: Record<string, string> = { ru: 'ruscha', uz: "o'zbekcha", en: 'inglizcha' };

export type ShablonTili = 'ru' | 'en';

/** Oldindan to'ldirilgan qatorlar (namuna jadvali va sinovlar uchun); bo'lmasa — bo'sh jadval. */
export interface ToldirGuruh { shart: string; variantlar?: string[]; savollar: { matn: string; javob: string }[] }
export interface ToldirYozma { savol: string; javob?: string; yechim?: string }
export interface ShablonSozlamasi {
  tur?: FaylTuri;
  soni: number;
  nom: string;
  /** Faqat 4 variantli. */
  variantlar?: 4 | 5;
  tillar?: ShablonTili[];
  /** MS-33-35 va MS-36-45: bo'sh o'rniga shu guruhlar yoziladi. */
  guruhlar?: ToldirGuruh[];
  /** Yozma: bo'sh o'rniga shu masalalar yoziladi. */
  yozmalar?: ToldirYozma[];
}

// A4, twip: yotiq va tik sahifa.
const UZUN = 16838, QISQA = 11906, CHET = 720;
const SARLAVHA_FONI = 'D9E2F3', SHART_FONI = 'EEF3FB', BOSH_FON = 'EDEDED', NAMUNA_RANGI = '777777';
const CHEGARA = '<w:tcBorders><w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/></w:tcBorders>';

interface KatakUslubi { b?: boolean; i?: boolean; rang?: string; fon?: string; /** Nechta ustunni egallaydi. */ span?: number }

const katak = (matn: string, w: number, u: KatakUslubi = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${u.span && u.span > 1 ? `<w:gridSpan w:val="${u.span}"/>` : ''}${CHEGARA}${u.fon ? `<w:shd w:val="clear" w:color="auto" w:fill="${u.fon}"/>` : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${matnRun(matn, { b: u.b, i: u.i, rang: u.rang, sz: 20 })}</w:p></w:tc>`;
const qator = (kataklar: string[], sarlavha = false) => `<w:tr>${sarlavha ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${kataklar.join('')}</w:tr>`;
const jadval = (ustunlar: number[], qatorlar: string[]) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${ustunlar.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ustunlar.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${qatorlar.join('')}</w:tbl>`;
const p = (runlar: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runlar}</w:p>`;
const izoh = (m: string) => p(matnRun(m, { sz: 18, rang: '444444' }), '<w:spacing w:after="20"/>');
const sarlavhaQatori = (nomlar: string[], ustunlar: number[]) => qator(nomlar.map((x, i) => katak(x, ustunlar[i], { b: true, fon: SARLAVHA_FONI })), true);
const sectPr = (yotiq: boolean) => {
  const [w, h] = yotiq ? [UZUN, QISQA] : [QISQA, UZUN];
  return `<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"${yotiq ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${CHET}" w:right="${CHET}" w:bottom="${CHET}" w:left="${CHET}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>`;
};

/** Hujjat: sarlavha, yo'riqnoma, (bo'lsa) namuna jadvali va to'ldiriladigan jadval. */
function hujjat(nom: string, tur: FaylTuri, yoriqnoma: string[], jadvallar: { sarlavha?: string; xml: string }[], yotiq: boolean): Promise<Blob> {
  const tana = [
    p(matnRun(`Savollar to'plami: ${nom}`, { b: true, sz: 28 })),
    p(matnRun(`Fayl turi: ${faylTuriNomi(tur)}`, { sz: 20, rang: '444444' }), '<w:spacing w:after="60"/>'),
    ...yoriqnoma.map(izoh),
    ...jadvallar.flatMap(j => [p(j.sarlavha ? matnRun(j.sarlavha, { b: true, sz: 18, rang: '444444' }) : '', '<w:spacing w:before="120" w:after="40"/>'), j.xml]),
    p(''),
  ].join('');
  return docxYasa(tana, sectPr(yotiq), new Rasmlar(new Map()));
}

// --- 4 variantli ------------------------------------------------------------------

function yopiqShablon({ soni, variantlar = 4, tillar = [], nom }: ShablonSozlamasi): Promise<Blob> {
  const kenglik = UZUN - 2 * CHET;
  const raqamW = 760, javobW = 900, variantW = variantlar === 5 ? 1500 : 1800;
  const savolW = kenglik - raqamW - javobW - variantW * variantlar;
  const harflar = 'ABCDE'.slice(0, variantlar).split('');
  const ustunlar = [raqamW, savolW, ...harflar.map(() => variantW), javobW];
  const qatorlar: string[] = [sarlavhaQatori(['№', 'Savol', ...harflar, 'Javob'], ustunlar)];
  for (let n = 1; n <= soni; n++) {
    qatorlar.push(qator(ustunlar.map((w, i) => katak(i === 0 ? String(n) : '', w))));
    for (const til of tillar) qatorlar.push(qator(ustunlar.map((w, i) => katak(i === 0 ? `${n} (${til})` : '', w, { i: true, rang: '555555', fon: 'F5F5F5' }))));
  }
  return hujjat(nom, 'yopiq', [
    "1. Har qatorga bitta savol yozing: «Savol» ustuniga matni, A–" + harflar[harflar.length - 1] + " ustunlariga variantlari.",
    "2. «Javob» ustuniga to'g'ri variantning harfini yozing (masalan: B).",
    "3. Formulani Word formulasi bilan yozing (Qo'shish → Tenglama); rasmni o'sha katakning ichiga qo'ying.",
    "4. Savollar bankka shu jadvaldagi tartibda tushadi. Bo'sh qolgan qatorlar o'qilmaydi — o'chirish shart emas.",
    ...(tillar.length ? [`5. ${tillar.map(t => `«N (${t})»`).join(' va ')} qatoriga shu savolning ${tillar.map(t => TIL_NOMI[t] || t).join(' va ')} tarjimasini yozing (savol va variantlar). U qatorda «Javob» bo'sh qoladi.`] : []),
    "Namuna:  1 | 2 + 3 nechaga teng? | 4 | 5 | 6 | 7 | Javob: B",
  ], [{ xml: jadval(ustunlar, qatorlar) }], true);
}

// --- MS-33-35: moslashtirish guruhi ------------------------------------------------

const MOSLASH_HARFLARI = ['A', 'B', 'C', 'D', 'E', 'F'];
const MOSLASH_NAMUNA: ToldirGuruh = {
  shart: 'To\'g\'ri to\'rtburchakning tomonlari 6 sm va 8 sm.',
  variantlar: ['10', '14', '24', '28', '48', '100'],
  savollar: [{ matn: 'Perimetrini toping (sm).', javob: 'D' }, { matn: 'Yuzini toping (sm²).', javob: 'E' }, { matn: 'Diagonalini toping (sm).', javob: 'A' }],
};

function moslashShablon({ soni, nom, guruhlar }: ShablonSozlamasi): Promise<Blob> {
  const kenglik = UZUN - 2 * CHET;
  const raqamW = 820, javobW = 900, variantW = 1350;
  const matnW = kenglik - raqamW - javobW - variantW * MOSLASH_HARFLARI.length;
  const ustunlar = [raqamW, matnW, ...MOSLASH_HARFLARI.map(() => variantW), javobW];
  const sarlavha = () => sarlavhaQatori(['№', 'Umumiy shart / savol', ...MOSLASH_HARFLARI, 'Javob'], ustunlar);
  /** Bitta guruh: shart qatori (javoblar ro'yxati bilan) va uning ostida savollar. `raqam` — «1» yoki «namuna». */
  const guruh = (raqam: string, g: ToldirGuruh | null, namuna = false): string[] => {
    const u: KatakUslubi = namuna ? { i: true, rang: NAMUNA_RANGI } : {};
    const savollar = g ? g.savollar : [{ matn: '', javob: '' }, { matn: '', javob: '' }, { matn: '', javob: '' }];
    return [
      qator([
        katak(raqam, raqamW, { ...u, b: !namuna, fon: SHART_FONI }), katak(g?.shart || '', matnW, { ...u, fon: SHART_FONI }),
        ...MOSLASH_HARFLARI.map((_, i) => katak(g?.variantlar?.[i] || '', variantW, { ...u, fon: SHART_FONI })),
        katak('', javobW, { fon: BOSH_FON }),
      ]),
      ...savollar.map((s, i) => qator([
        katak(namuna ? raqam : `${raqam}.${i + 1}`, raqamW, u), katak(s.matn, matnW, u),
        katak('', variantW * MOSLASH_HARFLARI.length, { fon: BOSH_FON, span: MOSLASH_HARFLARI.length }),
        katak(s.javob, javobW, { ...u, b: !namuna }),
      ])),
    ];
  };
  const asosiy = [sarlavha(), ...(guruhlar?.length ? guruhlar.map((g, i) => guruh(String(i + 1), g)) : Array.from({ length: soni }, (_, i) => guruh(String(i + 1), null))).flat()];
  return hujjat(nom, 'moslash', [
    "1. Har guruh — to'rt qator. «1» qatoriga: umumiy shart va A–F ustunlariga hamma savol uchun BITTA javoblar ro'yxati (savollardan ko'proq — ortiqchalari chalg'ituvchi).",
    "2. «1.1», «1.2», «1.3» qatorlariga: shu shart bo'yicha savollar; «Javob» ustuniga to'g'ri javobning harfi (A–F).",
    "3. Savol ko'p yoki kam bo'lsa — qator qo'shing yoki o'chiring: raqami «1.4» ko'rinishida bo'lsin (bitta guruhda 2 tadan 6 tagacha savol).",
    "4. Formulani Word formulasi bilan yozing (Qo'shish → Tenglama); rasmni o'sha katakning ichiga qo'ying.",
    "5. Bo'sh qolgan guruhlar o'qilmaydi — o'chirish shart emas. «Namuna» jadvali ham o'qilmaydi.",
  ], [
    { sarlavha: "Namuna (qanday to'ldirilishi):", xml: jadval(ustunlar, [sarlavha(), ...guruh('namuna', MOSLASH_NAMUNA, true)]) },
    { sarlavha: "To'ldiriladigan jadval:", xml: jadval(ustunlar, asosiy) },
  ], true);
}

// --- MS-36-45: qismli savol ---------------------------------------------------------

const QISM_HARFLARI = 'abcd';
const QISMLI_NAMUNA: ToldirGuruh = {
  shart: 'x² − 5x + 6 = 0 tenglama berilgan.',
  savollar: [{ matn: 'Ildizlari yig\'indisini toping.', javob: '5' }, { matn: 'Ildizlari ko\'paytmasini toping.', javob: '6' }],
};

function qismliShablon({ soni, nom, guruhlar }: ShablonSozlamasi): Promise<Blob> {
  const kenglik = QISQA - 2 * CHET;
  const raqamW = 900, javobW = 2400, matnW = kenglik - raqamW - javobW;
  const ustunlar = [raqamW, matnW, javobW];
  const sarlavha = () => sarlavhaQatori(['№', 'Shart / qism', 'Javob'], ustunlar);
  const savol = (raqam: string, g: ToldirGuruh | null, namuna = false): string[] => {
    const u: KatakUslubi = namuna ? { i: true, rang: NAMUNA_RANGI } : {};
    const qismlar = g ? g.savollar.slice(0, QISM_HARFLARI.length) : [{ matn: '', javob: '' }, { matn: '', javob: '' }];
    return [
      qator([katak(raqam, raqamW, { ...u, b: !namuna, fon: SHART_FONI }), katak(g?.shart || '', matnW, { ...u, fon: SHART_FONI }), katak('', javobW, { fon: BOSH_FON })]),
      ...qismlar.map((s, i) => qator([katak(namuna ? `${raqam} ${QISM_HARFLARI[i]}` : `${raqam}${QISM_HARFLARI[i]}`, raqamW, u), katak(s.matn, matnW, u), katak(s.javob, javobW, { ...u, b: !namuna })])),
    ];
  };
  const asosiy = [sarlavha(), ...(guruhlar?.length ? guruhlar.map((g, i) => savol(String(i + 1), g)) : Array.from({ length: soni }, (_, i) => savol(String(i + 1), null))).flat()];
  return hujjat(nom, 'qismli', [
    "1. Har savol — uch qator. «1» qatoriga: umumiy shart (masala sharti).",
    "2. «1a», «1b» qatorlariga: qismlar — nimani topish kerakligi; «Javob» ustuniga shu qismning to'g'ri javobi.",
    "3. Javob son bo'lsa (masalan 6 yoki 2,5 yoki 3/4) — varaqda skaner tekshiradi; ifoda yoki so'z bo'lsa — ustoz tekshiradi.",
    "4. Qism ko'p bo'lsa — qator qo'shing: «1c», «1d» (bitta savolda 4 tagacha qism). Qismi bitta bo'lgan savolda «1b» qatorini o'chiring.",
    "5. Formulani Word formulasi bilan yozing (Qo'shish → Tenglama); rasmni o'sha katakning ichiga qo'ying.",
    "6. Bo'sh qolgan savollar o'qilmaydi — o'chirish shart emas. «Namuna» jadvali ham o'qilmaydi.",
  ], [
    { sarlavha: "Namuna (qanday to'ldirilishi):", xml: jadval(ustunlar, [sarlavha(), ...savol('namuna', QISMLI_NAMUNA, true)]) },
    { sarlavha: "To'ldiriladigan jadval:", xml: jadval(ustunlar, asosiy) },
  ], false);
}

// --- Yozma (MS-41-43) ----------------------------------------------------------------

function yozmaShablon({ soni, nom, yozmalar }: ShablonSozlamasi): Promise<Blob> {
  const kenglik = UZUN - 2 * CHET;
  const raqamW = 760, javobW = 2000, savolW = 5600, yechimW = kenglik - raqamW - javobW - savolW;
  const ustunlar = [raqamW, savolW, javobW, yechimW];
  const qatorlar = [
    sarlavhaQatori(['№', 'Savol', 'Javob', 'Yechim'], ustunlar),
    ...(yozmalar?.length ? yozmalar : Array.from({ length: soni }, (): ToldirYozma => ({ savol: '' })))
      .map((y, i) => qator([katak(String(i + 1), raqamW), katak(y.savol, savolW), katak(y.javob || '', javobW), katak(y.yechim || '', yechimW)])),
  ];
  return hujjat(nom, 'yozma', [
    "1. Har qatorga bitta masala yozing: «Savol» ustuniga to'liq matni.",
    "2. «Javob» ustuniga yakuniy javobni yozing (bo'lsa) — yechim shu javobga olib kelishi tekshiriladi.",
    "3. «Yechim» ustuni ixtiyoriy: o'zingizning yechimingiz bo'lsa — yozing. Bo'sh qolsa — yuklaganda AI masalani yechib, batafsil (qadamma-qadam, izohli) yechim yozadi.",
    "4. Formulani Word formulasi bilan yozing (Qo'shish → Tenglama); rasmni o'sha katakning ichiga qo'ying.",
    "5. Bo'sh qolgan qatorlar o'qilmaydi — o'chirish shart emas.",
  ], [{ xml: jadval(ustunlar, qatorlar) }], true);
}

/** Fayl turiga mos Word shablon (.docx). */
export function shablonYasa(s: ShablonSozlamasi): Promise<Blob> {
  const tur = s.tur || 'yopiq';
  return tur === 'moslash' ? moslashShablon(s) : tur === 'qismli' ? qismliShablon(s) : tur === 'yozma' ? yozmaShablon(s) : yopiqShablon(s);
}
