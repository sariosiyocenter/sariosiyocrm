import { docxYasa, matnRun, Rasmlar } from '../../../lib/docx';

// Word shablon (Addmen'da "QR file" deyiladi — QR kodga aloqasi yo'q): ustoz to'ldiradigan
// bo'sh Word jadvali — № | Savol | A | B | C | D | (E) | Javob. To'ldirilgan fayl «Savol
// qo'shish» orqali AI siz o'qiladi (word.ts → wordJadvalSavollari). Asosiy til — o'zbekcha;
// qo'shimcha til(lar) tanlansa har savol ostida "N (ru)", "N (en)" qatorlari — o'sha
// savolning tarjimasi (javob ustuni bo'sh).

const TIL_NOMI: Record<string, string> = { ru: 'ruscha', uz: "o'zbekcha", en: 'inglizcha' };

export type ShablonTili = 'ru' | 'en';

export async function qrShablonYasa({ soni, variantlar, tillar, nom }: { soni: number; variantlar: 4 | 5; tillar: ShablonTili[]; nom: string }): Promise<Blob> {
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
    for (const til of tillar) qatorlar.push(qator(ustunlar.map((w, i) => katak(i === 0 ? `${n} (${til})` : '', w, { i: true, rang: '555555', fon: 'F5F5F5' }))));
  }
  const p = (runlar: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runlar}</w:p>`;
  const tana = [
    p(matnRun(`Savollar to'plami: ${nom}`, { b: true, sz: 28 })),
    ...[
      "1. Har qatorga bitta savol yozing: «Savol» ustuniga matni, A–" + harflar[harflar.length - 1] + " ustunlariga variantlari.",
      "2. «Javob» ustuniga to'g'ri variantning harfini yozing (masalan: B).",
      "3. Formulani Word formulasi bilan yozing (Qo'shish → Tenglama); rasmni o'sha katakning ichiga qo'ying.",
      "4. Savollar bankka shu jadvaldagi tartibda tushadi. Bo'sh qolgan qatorlar o'qilmaydi — o'chirish shart emas.",
      ...(tillar.length ? [`5. ${tillar.map(t => `«N (${t})»`).join(' va ')} qatoriga shu savolning ${tillar.map(t => TIL_NOMI[t] || t).join(' va ')} tarjimasini yozing (savol va variantlar). U qatorda «Javob» bo'sh qoladi.`] : []),
      "Namuna:  1 | 2 + 3 nechaga teng? | 4 | 5 | 6 | 7 | Javob: B",
    ].map(m => p(matnRun(m, { sz: 18, rang: '444444' }), '<w:spacing w:after="20"/>')),
    p('', '<w:spacing w:after="120"/>'),
    `<w:tbl><w:tblPr><w:tblW w:w="${kenglik}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ustunlar.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${qatorlar.join('')}</w:tbl>`,
    p(''),
  ].join('');
  const sectPr = `<w:sectPr><w:pgSz w:w="${BET_W}" w:h="${BET_H}" w:orient="landscape"/><w:pgMar w:top="${CHET}" w:right="${CHET}" w:bottom="${CHET}" w:left="${CHET}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>`;
  return docxYasa(tana, sectPr, new Rasmlar(new Map()));
}
