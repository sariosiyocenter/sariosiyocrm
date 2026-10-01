import { HARFLAR } from '../../../lib/imtihon.js';
import { oddiyMatn } from '../../lib/matn';
import { Rasmlar, rasmlarniYukla, htmlParagraflar, htmlRunlar, matnRun, docxYasa, TWIP_SM } from '../../lib/docx';
import { MOSLASH_KORSATMA, type KitobchaMalumoti, type KitobchaSozlama } from './chop';
import type { Exam } from '../../types';

// Kitobcha Word (.docx) da (Addmen QPG "Format: DOC"): har variant — muqova
// (1 ustun) va savollar (1 yoki 2 ustun) bo'limi. Formulalar Word formulasi,
// rasmlar ichida. Ustoz Word'da tahrirlab, o'zi chop etishi mumkin.

const BET_W = 11906, BET_H = 16838, CHET = 850, ORA = 454; // twip (A4, 1,5 sm chet, 0,8 sm ustun orasi)
const MATN_W = BET_W - 2 * CHET;
const CHEKINISH = 397; // savol raqami uchun ~0,7 sm

const sectPr = (ustun: number, tur: 'nextPage' | 'continuous') =>
  `<w:sectPr><w:type w:val="${tur}"/><w:pgSz w:w="${BET_W}" w:h="${BET_H}"/><w:pgMar w:top="${CHET}" w:right="${CHET}" w:bottom="${CHET}" w:left="${CHET}" w:header="425" w:footer="425" w:gutter="0"/><w:cols w:num="${ustun}" w:space="${ORA}"${ustun > 1 ? ' w:sep="1"' : ''}/></w:sectPr>`;
const p = (runlar: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runlar}</w:p>`;
const CHEGARA = '<w:pBdr><w:top w:val="single" w:sz="6" w:space="3" w:color="000000"/><w:left w:val="single" w:sz="6" w:space="4" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:space="3" w:color="000000"/><w:right w:val="single" w:sz="6" w:space="4" w:color="000000"/></w:pBdr>';

export async function kitobchaWord(exam: Exam, markaz: string, d: KitobchaMalumoti, tanlov: { session: number; code: string }[], o: KitobchaSozlama): Promise<Blob> {
  const savolMap = new Map(d.savollar.map(q => [q.id, q]));
  const matnMap = new Map(d.matnlar.map(x => [x.id, x]));
  // Hamma rasmlar oldindan yuklanadi (savol, variant, matn ichidagi <img> lar ham).
  const urllar: string[] = [];
  const imgTop = (html?: string | null) => { for (const m of String(html || '').matchAll(/<img[^>]+src="([^"]+)"/gi)) urllar.push(m[1].replace(/&amp;/g, '&')); };
  for (const q of d.savollar) { if (q.imageUrl) urllar.push(q.imageUrl); imgTop(q.text); q.options.forEach(imgTop); imgTop(q.tarjima?.text); }
  for (const x of d.matnlar) { if (x.imageUrl) urllar.push(x.imageUrl); imgTop(x.text); }
  const rasmlar = new Rasmlar(await rasmlarniYukla(urllar));

  const ustunW = o.ustun === 2 ? (MATN_W - ORA) / 2 : MATN_W;
  const rasmSm = (ustunW - CHEKINISH) / TWIP_SM;
  const s = exam.settings;
  const qismlar: string[] = [];

  tanlov.forEach(({ session, code }, vi) => {
    const v = d.variants.find(x => x.session === session && x.code === code);
    if (!v) return;
    const sessiya = s.sessions.find(x => x.id === session);
    const bloklar = exam.blocks.map((b, bi) => {
      const lar = v.items.filter(it => it.b === bi);
      return { nomi: b.subject, soni: lar.length, boshi: lar[0]?.n, oxiri: lar[lar.length - 1]?.n, ball: exam.scoring === 'blok' ? b.pointsPerQuestion : null };
    });
    // --- Muqova (1 ustun)
    qismlar.push(
      p(matnRun(markaz, { sz: 18, rang: '444444' })),
      p(matnRun(exam.name, { b: true, sz: 32 })),
      p(matnRun(`${exam.date}${sessiya ? ` · ${sessiya.name}${sessiya.time ? ` (${sessiya.time})` : ''}` : ''} · ${exam.duration} daqiqa · ${v.items.length} ta savol`, { sz: 18 })),
      p(matnRun('VARIANT ', { sz: 20 }) + matnRun(code, { b: true, sz: 44 }), `<w:jc w:val="right"/>${CHEGARA}<w:ind w:left="${MATN_W - 1700}"/><w:spacing w:before="60" w:after="120"/>`),
    );
    const katak = (matn: string, b = false) => `<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="555555"/><w:left w:val="single" w:sz="4" w:color="555555"/><w:bottom w:val="single" w:sz="4" w:color="555555"/><w:right w:val="single" w:sz="4" w:color="555555"/></w:tcBorders></w:tcPr>${p(matnRun(matn, { b, sz: 18 }))}</w:tc>`;
    const sarlavhalar = ['Fan', 'Savollar', 'Soni', ...(exam.scoring === 'blok' ? ['Bir savol bali'] : [])];
    qismlar.push(`<w:tbl><w:tblPr><w:tblW w:w="${MATN_W}" w:type="dxa"/></w:tblPr><w:tr>${sarlavhalar.map(x => katak(x, true)).join('')}</w:tr>${bloklar.map(b => `<w:tr>${katak(b.nomi)}${katak(`${b.boshi ?? ''}–${b.oxiri ?? ''}`)}${katak(String(b.soni))}${exam.scoring === 'blok' ? katak(String(b.ball ?? '')) : ''}</w:tr>`).join('')}</w:tbl>`);
    const qoidalar = [
      'Javoblarni faqat javob varaqasiga belgilang: doirachani qora yoki ko\'k ruchka bilan to\'liq bo\'yang.',
      `Javob varaqasida kitobcha variantini (${code}) ham bo'yang. Kitobchaga yozish mumkin — u tekshirilmaydi.`,
      ...(v.items.some(it => it.t === 'raqamli') ? ["Raqamli javobni katak tepasiga yozing va har belgini ostidagi ustunda bo'yang (minus, vergul, kasr chizig'i ham)."] : []),
      ...(v.items.some(it => it.t === 'moslash') ? [MOSLASH_KORSATMA] : []),
    ];
    qoidalar.forEach((q, i) => qismlar.push(p(matnRun(`• ${q}`, { sz: 18 }), `<w:ind w:left="227" w:hanging="227"/>${i === 0 ? '<w:spacing w:before="120"/>' : ''}`)));
    qismlar.push(p('', sectPr(1, 'nextPage')));

    // --- Savollar (1 yoki 2 ustun)
    let joriyBlok = -1;
    let joriyMatn: number | null = null;
    v.items.forEach((it, idx) => {
      if (it.b !== joriyBlok) {
        joriyBlok = it.b;
        const b = bloklar[it.b];
        if (o.bolimSarlavha) qismlar.push(p(matnRun(`${b?.nomi || ''} — ${b?.boshi}–${b?.oxiri}-savollar${b?.ball != null ? `, har biri ${b.ball} ball` : ''}`, { b: true }), '<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:before="160" w:after="80"/>'));
        joriyMatn = null;
      }
      const q = savolMap.get(it.q);
      if (!q) return;
      if (it.pa && it.pa !== joriyMatn) {
        joriyMatn = it.pa;
        const m = matnMap.get(it.pa);
        let oxiri = it.n;
        for (let j = idx + 1; j < v.items.length && v.items[j].pa === it.pa; j++) oxiri = v.items[j].n;
        if (m) {
          const ppr = `${CHEGARA}<w:spacing w:after="0"/>`;
          qismlar.push(p(matnRun(`${m.title ? `${m.title}. ` : ''}Matnni o'qing va ${it.n}–${oxiri}-savollarga javob bering.`, { b: true, sz: 20 }), `<w:keepNext/>${ppr}<w:spacing w:before="120"/>`));
          for (const x of htmlParagraflar(m.text, rasmlar, rasmSm)) qismlar.push(p(x, `<w:keepNext/>${ppr}`));
          if (m.imageUrl) qismlar.push(p(rasmlar.drawing(m.imageUrl, rasmSm), ppr));
          qismlar.push(p('', '<w:spacing w:after="80"/>'));
        }
      } else if (!it.pa) joriyMatn = null;

      const matnlar = htmlParagraflar(q.text, rasmlar, rasmSm);
      matnlar.forEach((runlar, i) => qismlar.push(p(
        (i === 0 ? `${matnRun(`${it.n}.`, { b: true })}<w:r><w:tab/></w:r>` : '') + runlar,
        `<w:keepNext/><w:ind w:left="${CHEKINISH}"${i === 0 ? ` w:hanging="${CHEKINISH}"` : ''}/>${i === 0 ? '<w:spacing w:before="100"/>' : ''}`,
      )));
      if (q.imageUrl) qismlar.push(p(rasmlar.drawing(q.imageUrl, rasmSm), `<w:keepNext/><w:ind w:left="${CHEKINISH}"/>`));
      if (o.ikkiTil && q.tarjima?.text?.trim()) {
        for (const x of htmlParagraflar(q.tarjima.text, rasmlar, rasmSm, { i: true, rang: '444444' })) qismlar.push(p(x, `<w:keepNext/><w:ind w:left="${CHEKINISH}"/>`));
      }

      if (it.t === 'yopiq') {
        const tartib = it.m && it.m.length ? it.m : q.options.map((_, i) => i);
        const tj = o.ikkiTil ? q.tarjima?.options || [] : [];
        const uzunlik = Math.max(...tartib.map(i => oddiyMatn(q.options[i] || '').length + (tj[i] ? oddiyMatn(tj[i]).length + 3 : 0)));
        const rasmli = tartib.some(i => /<img/i.test(q.options[i] || ''));
        // Savolda belgilangan joylashuv (Addmen DISPLAY CHOICES) ustun turadi.
        const qatorda = q.joylashuv === 1 || q.joylashuv === 2 || q.joylashuv === 4 ? q.joylashuv : rasmli ? 2 : uzunlik <= 11 && tartib.length <= 4 ? 4 : uzunlik <= 30 ? 2 : 1;
        const qadam = (ustunW - CHEKINISH) / qatorda;
        const tabs = qatorda > 1 ? `<w:tabs>${Array.from({ length: qatorda - 1 }, (_, k) => `<w:tab w:val="left" w:pos="${Math.round(CHEKINISH + qadam * (k + 1))}"/>`).join('')}</w:tabs>` : '';
        const variant = (asl: number, i: number) => `${matnRun(`${HARFLAR[i]})`, { b: true })}${matnRun(' ')}${htmlRunlar(q.options[asl] || '', rasmlar, Math.min(qadam / TWIP_SM - 0.8, 6))}`
          + (tj[asl]?.trim() ? `${matnRun(' / ', { rang: '555555' })}${htmlRunlar(tj[asl], rasmlar, 3, { i: true, rang: '555555' })}` : '');
        for (let i = 0; i < tartib.length; i += qatorda) {
          const bolak = tartib.slice(i, i + qatorda).map((asl, k) => variant(asl, i + k)).join('<w:r><w:tab/></w:r>');
          const oxirgi = i + qatorda >= tartib.length;
          qismlar.push(p(bolak, `${oxirgi ? '' : '<w:keepNext/>'}<w:ind w:left="${CHEKINISH}"/>${tabs}`));
        }
      } else if (it.t === 'moslash') {
        // Chap (A–D) va o'ng (P–T) ustun — bitta qatorda tab bilan, ikki ustun.
        const ong = q.ong || [];
        const yarim = Math.round(CHEKINISH + (ustunW - CHEKINISH) / 2);
        const qatorlar = Math.max(q.options.length, ong.length);
        const band = (x: string | undefined, h: string) => (x == null ? '' : `${matnRun(`${h})`, { b: true })}${matnRun(' ')}${htmlRunlar(x, rasmlar, Math.min((ustunW - CHEKINISH) / 2 / TWIP_SM - 0.8, 5))}`);
        for (let i = 0; i < qatorlar; i++) {
          qismlar.push(p(`${band(q.options[i], 'ABCD'[i])}<w:r><w:tab/></w:r>${band(ong[i], 'PQRST'[i])}`,
            `${i < qatorlar - 1 ? '<w:keepNext/>' : ''}<w:ind w:left="${CHEKINISH}"/><w:tabs><w:tab w:val="left" w:pos="${yarim}"/></w:tabs>`));
        }
      } else if (it.t === 'raqamli') {
        qismlar.push(p(matnRun(`Javobni javob varaqasidagi ${it.n}-katakka yozing va bo'yang.`, { i: true, sz: 18 }), `<w:ind w:left="${CHEKINISH}"/>`));
      } else {
        qismlar.push(p(matnRun(`Yechimni javob varaqasidagi ${it.n}-maydonga yozing (${it.p} ball).`, { i: true, sz: 18 }), `<w:ind w:left="${CHEKINISH}"/>`));
      }
      if (o.izoh && q.remark) qismlar.push(p(matnRun(`Izoh: ${q.remark}`, { i: true, sz: 17, rang: '555555' }), `<w:ind w:left="${CHEKINISH}"/>`));
    });
    // Oxirgi variantdan boshqalarida savollar bo'limi shu yerda yopiladi.
    if (vi < tanlov.length - 1) qismlar.push(p('', sectPr(o.ustun, 'continuous')));
  });
  return docxYasa(qismlar.join(''), sectPr(o.ustun, 'continuous'), rasmlar);
}

export const kitobchaFaylNomi = (exam: Exam, kodlar: string[]) => `${exam.name} — kitobcha ${kodlar.join(', ')}.docx`.replace(/[\\/:*?"<>|]/g, ' ');
