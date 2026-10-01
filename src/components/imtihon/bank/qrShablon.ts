import { docxYasa, matnRun, Rasmlar } from '../../../lib/docx';

// Addmen "CREATE QR FILE → BLANK QPG QR": ustoz to'ldiradigan bo'sh Word jadvali —
// № | Savol | A | B | C | D | (E) | Javob. To'ldirilgan fayl «Savol qo'shish»
// orqali AI siz o'qiladi (word.ts → wordJadvalSavollari). Ikki tilli bo'lsa har
// savol ostida "N (ru)" qatori — o'sha savolning tarjimasi (javob ustuni bo'sh).

const TIL_NOMI: Record<string, string> = { ru: 'ruscha', uz: "o'zbekcha", en: 'inglizcha' };

export async function qrShablonYasa({ soni, variantlar, ikkinchiTil, nom }: { soni: number; variantlar: 4 | 5; ikkinchiTil: '' | 'ru' | 'uz' | 'en'; nom: string }): Promise<Blob> {
  const BET_W = 16838, BET_H = 11906, CHET = 720;
  const kenglik = BET_W - 2 * CHET;
  const raqamW = 760, javobW = 900, variantW = variantlar === 5 ? 1500 : 1800;
  const savolW = kenglik - raqamW - javobW - variantW * variantlar;
  const harflar = 'ABCDE'.slice(0, variantlar).split('');
  const ustunlar = [raqamW, savolW, ...harflar.map(() => variantW), javobW];
  const chegara = '<w:tcBorders><w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/></w:tcBorders>';
  const katak = (matn: string, w: number, uslub: { b?: boolean; rang?: string; fon?: string; i?: boolean } = {}) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${chegara}${uslub.fon ? `<w:shd w:val="clear" w:color="auto" w:fill="${uslub.fon}"/>` : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${matnRun(matn, { b: uslub.b, i: uslub.i, rang: uslub.rang, sz: 20 })}</w:p></w:tc>`;
  const qator = (kataklar: string[], sarlavha = false) => `<w:tr>${sarlavha ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${kataklar.join('')}</w:tr>`;

  const qatorlar: string[] = [qator(['№', 'Savol', ...harflar, 'Javob'].map((x, i) => katak(x, ustunlar[i], { b: true, fon: 'D9E2F3' })), true)];
  for (let n = 1; n <= soni; n++) {
    qatorlar.push(qator(ustunlar.map((w, i) => katak(i === 0 ? String(n) : '', w))));
    if (ikkinchiTil) qatorlar.push(qator(ustunlar.map((w, i) => katak(i === 0 ? `${n} (${ikkinchiTil})` : '', w, { i: true, rang: '555555', fon: 'F5F5F5' }))));
  }
  const p = (runlar: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runlar}</w:p>`;
  const tana = [
    p(matnRun(`Savollar to'plami: ${nom}`, { b: true, sz: 28 })),
    p(matnRun("Har qatorga bitta savol. «Javob» ustuniga to'g'ri variant harfi (A–E). Formulani Word formulasi bilan yozing (Qo'shish → Tenglama), rasmni katakka qo'ying. Bo'sh qatorlar o'qilmaydi.", { sz: 18, rang: '444444' })),
    ...(ikkinchiTil ? [p(matnRun(`«N (${ikkinchiTil})» qatoriga shu savolning ${TIL_NOMI[ikkinchiTil] || ikkinchiTil} tarjimasini yozing — kitobcha ikki tilli chiqadi. Javob ustuni bo'sh qoladi.`, { sz: 18, rang: '444444' }))] : []),
    p('', '<w:spacing w:after="120"/>'),
    `<w:tbl><w:tblPr><w:tblW w:w="${kenglik}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ustunlar.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${qatorlar.join('')}</w:tbl>`,
    p(''),
  ].join('');
  const sectPr = `<w:sectPr><w:pgSz w:w="${BET_W}" w:h="${BET_H}" w:orient="landscape"/><w:pgMar w:top="${CHET}" w:right="${CHET}" w:bottom="${CHET}" w:left="${CHET}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>`;
  return docxYasa(tana, sectPr, new Rasmlar(new Map()));
}
