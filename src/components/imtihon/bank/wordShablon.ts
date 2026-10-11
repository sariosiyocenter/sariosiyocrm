import { hujjatniOqi, matnniYig, rasmTuri, type Hujjat, type Jadval, type Paragraf } from './word';
import type { FaylTuri } from './faylTuri';
import type { GuruhTuri } from '../../../types';

// Word shablon jadvallari — AI siz o'qiladi (shablonni qrShablon.ts yasaydi). Har fayl turining
// o'z jadvali bor; tur jadvalning tuzilishidan (№ ustunidagi raqamlar va ustunlar sonidan) taniladi:
//   4 variantli — № | savol | A | B | C | D | (E) | javob   (Addmen "Question Resource" jadvali ham shu:
//                 har qator — bitta savol; 18 ming savol ham tez ko'chadi);
//   MS-33-35    — «1» qatorida umumiy shart va A–F javoblar ro'yxati, «1.1», «1.2»… qatorlarida savollar;
//   MS-36-45    — «1» qatorida umumiy shart, «1a», «1b»… qatorlarida qismlar va javoblari;
//   Yozma       — № | savol | javob | yechim.
// Bunday jadval bo'lmasa — null (fayl odatdagidek AI ga beriladi).

export interface JadvalSavol {
  raqam: string | null;
  /** HTML (formulalar $...$, qo'shimcha rasmlar <img>). */
  text: string;
  options: string[];
  correctAnswer: string;
  /** Bo'lsa — savol qoralama bo'lib tushadi. */
  xato: string | null;
  /** "N (ru)" qatoridagi tarjima; ikkinchi tarjima qatori ("N (en)") — `boshqa` da. */
  tarjima?: JadvalTarjima & { boshqa?: JadvalTarjima[] } | null;
}
export interface JadvalTarjima { til: 'uz' | 'ru' | 'en'; text: string; options: string[] }

/** Guruhli savol (MS-33-35 yoki MS-36-45) — jadvaldan. */
export interface JadvalGuruh {
  tur: GuruhTuri;
  raqam: string | null;
  /** Umumiy shart (HTML). */
  text: string;
  /** MS-33-35: umumiy javoblar ro'yxati (HTML). */
  variantlar: string[];
  savollar: { text: string; javob: string; son: boolean }[];
  /** Tuzilishi yaroqsiz (bankka qo'shilmaydi): shart yo'q, savollar kam… */
  xato: string | null;
  /** To'liq emas (qoralama bo'lib tushadi): javob yo'q yoki formulasi o'qilmagan. */
  chala: string | null;
}

/** Yozma masala — jadvaldan. */
export interface JadvalYozma {
  raqam: string | null;
  text: string;
  /** Yakuniy javob (oddiy matn; bo'lmasa bo'sh). */
  javob: string;
  /** Ustozning o'z yechimi (HTML; bo'lmasa null — AI yechadi). */
  yechim: string | null;
  xato: string | null;
}

export interface ShablonNatija {
  tur: FaylTuri;
  savollar: JadvalSavol[];
  guruhlar: JadvalGuruh[];
  yozmalar: JadvalYozma[];
  formulaSoni: number;
  /** O'qib bo'lmagan formula va rasmlar (MathType, WMF/EMF). */
  oqilmagan: number;
  rasmSoni: number;
}

const KIRILL_HARF: Record<string, string> = { А: 'A', Б: 'B', В: 'C', Г: 'D', Д: 'E', Е: 'F' };
/** Javob katagi: A–F (lotin yoki kirill), 1–6 yoki "A)" kabi. */
function javobHarfi(s: string): string | null {
  const t = s.replace(/\s+/g, '').replace(/[.)]+$/, '').toUpperCase();
  if (/^[A-F]$/.test(t)) return t;
  if (KIRILL_HARF[t]) return KIRILL_HARF[t];
  if (/^[1-6]$/.test(t)) return 'ABCDEF'[Number(t) - 1];
  return null;
}
const RAQAM_KATAK = /^\s*\d{1,6}\s*[.)]?\s*$/;
/** Ikki tilli shablondagi tarjima qatori: "12 (ru)". */
const TARJIMA_KATAK = /^\s*\d{1,6}\s*\((uz|ru|en)\)\s*$/i;
/** MS-33-35: guruh ichidagi savol — "1.2" (yoki "1-2"). */
const ICHKI_KATAK = /^\s*(\d{1,4})\s*[.\-–]\s*(\d{1,2})\s*[.)]?\s*$/;
/** MS-36-45: qism — "1a", "1 b)", "36-a" (kirill а, б, в, г ham). */
const QISM_KATAK = /^\s*(\d{1,4})\s*[.\-–]?\s*([a-dа-г])\s*[.)]?\s*$/i;
const KIRILL_QISM: Record<string, string> = { а: 'a', б: 'b', в: 'c', г: 'd' };
/** Skaner tekshira oladigan javob: butun, o'nli yoki oddiy kasr son. */
const SON_JAVOB = /^-?\d+([.,]\d+)?(\/\d+)?$/;
const MAKS_QISM = 4;
const MAKS_SAVOL = 10;
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const OQILMADI = "MathType formula yoki rasm o'qilmadi";

type Qator = Paragraf[][];
const katakMatni = (k: Paragraf[] | undefined) => (k || []).map(p => matnniYig(p.bolaklar, false)).join('\n').replace(/ /g, ' ').trim();
const raqami = (q: Qator) => katakMatni(q[0]);
const oxirgi = (q: Qator) => katakMatni(q[q.length - 1]);

/** Jadval qaysi shablon: № ustunidagi raqamlar, ustunlar soni va sarlavhasi bo'yicha. */
function jadvalTuri(j: Jadval): FaylTuri | null {
  const qatorlar = j.filter(q => q.length >= 2);
  if (qatorlar.some(q => ICHKI_KATAK.test(raqami(q)))) return 'moslash';
  if (qatorlar.some(q => QISM_KATAK.test(raqami(q)))) return 'qismli';
  // Yozma: tor jadval (4 ustungacha), sarlavhasida «Yechim» ustuni bor. Sarlavhasiz jadval yozma deb
  // olinmaydi: masala ichidagi oddiy ma'lumot jadvali (x | y …) bilan adashib ketardi.
  const tor = qatorlar.filter(q => q.length <= 4);
  const sarlavhali = tor.some(q => !RAQAM_KATAK.test(raqami(q)) && q.some(k => /yechim|решени|solution/i.test(katakMatni(k))));
  if (tor.length && tor.length === qatorlar.length && sarlavhali && tor.some(q => RAQAM_KATAK.test(raqami(q)))) return 'yozma';
  // 4 variantli: ≥6 ustunli qatorlarning yarmidan ko'pida oxirgi katak — javob harfi (ikki tilli
  // shablonning "N (ru)" tarjima qatorlari sanalmaydi — ularda javob yo'q). To'ldirilmagan shablon
  // qatorlari (faqat raqam) ham sanalmaydi.
  const toliq = j.filter(q => q.length >= 6);
  const javobli = toliq.filter(q => javobHarfi(oxirgi(q)));
  const savolQatorlari = toliq.filter(q => !TARJIMA_KATAK.test(raqami(q)) && q.slice(1).some(k => katakMatni(k)));
  return javobli.length && javobli.length * 2 >= savolQatorlari.length ? 'yopiq' : null;
}

/**
 * Hujjatdagi shablon jadvallaridan savollar. Hujjat — bitta turdagi: xodim tanlagan turdagi jadval
 * bo'lsa o'sha, bo'lmasa birinchi tanilgan tur. `rasmYukla` — rasmni saqlab, havolasini qaytaradi.
 */
export async function wordShablonSavollari(fayl: File, rasmYukla: (dataUrl: string, nom: string) => Promise<string>, afzal?: FaylTuri): Promise<ShablonNatija | null> {
  const h = await hujjatniOqi(fayl, 5000);
  const turli = h.jadvallar.map(j => ({ j, tur: jadvalTuri(j) })).filter((x): x is { j: Jadval; tur: FaylTuri } => !!x.tur);
  if (!turli.length) return null;
  const tur = afzal && turli.some(x => x.tur === afzal) ? afzal : turli[0].tur;
  const jadvallar = turli.filter(x => x.tur === tur).map(x => x.j);
  const k = kataklar(h, rasmYukla);
  const natija: ShablonNatija = { tur, savollar: [], guruhlar: [], yozmalar: [], formulaSoni: h.formulaSoni, oqilmagan: h.oqilmagan, rasmSoni: 0 };
  if (tur === 'yopiq') natija.savollar = await yopiqSavollar(jadvallar, k.html);
  else if (tur === 'yozma') natija.yozmalar = await yozmaSavollar(jadvallar, k.html);
  else natija.guruhlar = await guruhliSavollar(jadvallar, tur, k.html);
  // Tasodifan o'xshab qolgan jadval (xodim bu turni tanlamagan, yaroqli guruh ham yo'q) — shablon emas.
  if (tur !== afzal && natija.guruhlar.length && natija.guruhlar.every(g => g.xato)) return null;
  natija.rasmSoni = k.rasmSoni();
  return natija.savollar.length || natija.guruhlar.length || natija.yozmalar.length ? natija : null;
}

type KatakHtml = (k: Paragraf[] | undefined) => Promise<string>;

/** Katak → HTML; rasmlar bir marta yuklanadi (bir xil rasm bir necha joyda bo'lishi mumkin). */
function kataklar(h: Hujjat, rasmYukla: (dataUrl: string, nom: string) => Promise<string>) {
  const havolalar = new Map<number, Promise<string>>();
  const rasmHavolasi = (i: number) => {
    if (!havolalar.has(i)) {
      const yol = h.rasmYollari[i];
      const bayt = h.fayllar.get(yol);
      havolalar.set(i, !bayt ? Promise.resolve('') : new Promise<string>((ok) => {
        const o = new FileReader();
        o.onload = () => rasmYukla(String(o.result), yol.split('/').pop() || 'rasm.png').then(ok, () => ok(''));
        o.onerror = () => ok('');
        o.readAsDataURL(new Blob([bayt as BlobPart], { type: rasmTuri(yol) }));
      }));
    }
    return havolalar.get(i)!;
  };
  // Rasmlar matn ichida qoladi (ko'rib chiqishda ham, kitobchada ham o'z joyida chiqadi).
  const katakHtml: KatakHtml = async (k) => {
    let s = html(katakMatni(k)).replace(/\n/g, '<br>');
    const rasmlar = [...s.matchAll(/\u0000R(\d+)\u0000/g)].map(m => Number(m[1]));
    for (const i of rasmlar) {
      const url = await rasmHavolasi(i);
      s = s.replace(`\u0000R${i}\u0000`, url ? `<img src="${url}" alt="">` : '');
    }
    return s.trim();
  };
  return { html: katakHtml, rasmSoni: () => havolalar.size };
}

// --- 4 variantli --------------------------------------------------------------------

async function yopiqSavollar(jadvallar: Jadval[], katakHtml: KatakHtml): Promise<JadvalSavol[]> {
  const qatorlar: { kataklar: Qator; seriya: boolean; til?: 'uz' | 'ru' | 'en' }[] = [];
  for (const j of jadvallar) {
    for (const q of j.filter(x => x.length >= 6)) {
      const tarjima = TARJIMA_KATAK.exec(raqami(q));
      if (tarjima) { qatorlar.push({ kataklar: q, seriya: true, til: tarjima[1].toLowerCase() as 'uz' | 'ru' | 'en' }); continue; }
      // Sarlavha qatori ("№ | Savol | A | … | Javob") — javob harfi ham, raqami ham yo'q.
      const seriya = RAQAM_KATAK.test(raqami(q));
      if (!seriya && !javobHarfi(oxirgi(q))) continue;
      qatorlar.push({ kataklar: q, seriya });
    }
  }
  const savollar: JadvalSavol[] = [];
  for (const { kataklar: kq, seriya, til } of qatorlar) {
    const n = kq.length;
    if (til) {
      // Tarjima qatori — oldingi savolga (javob ustuni hisobga olinmaydi).
      const oldingi = savollar[savollar.length - 1];
      const matn = await katakHtml(kq[1]);
      const variantlar = await Promise.all(kq.slice(2, n - 1).map(katakHtml));
      while (variantlar.length && !variantlar[variantlar.length - 1]) variantlar.pop();
      if (oldingi && (matn || variantlar.some(Boolean))) {
        const t: JadvalTarjima = { til, text: matn, options: variantlar };
        oldingi.tarjima = oldingi.tarjima ? { ...oldingi.tarjima, boshqa: [...(oldingi.tarjima.boshqa || []), t] } : t;
      }
      continue;
    }
    const savolKatak = kq[seriya ? 1 : 0];
    const variantlar = kq.slice(seriya ? 2 : 1, n - 1);
    // Addmen 4 yoki 5 variantli: bo'sh oxirgi ustunlar tashlanadi.
    while (variantlar.length && !katakMatni(variantlar[variantlar.length - 1])) variantlar.pop();
    const text = await katakHtml(savolKatak);
    const options = await Promise.all(variantlar.map(katakHtml));
    const javob = javobHarfi(oxirgi(kq)) || '';
    const kamchilik = [
      /o'qilmadi/.test(text + options.join(' ')) && OQILMADI,
      !javob && "javob yo'q",
      javob && 'ABCDEF'.indexOf(javob) >= options.length && `javob ${javob}, variant ${options.length} ta`,
      options.length < 2 && "variantlar yo'q",
      options.some(o => !o) && "bo'sh variant bor",
    ].filter(Boolean) as string[];
    if (!text) continue;
    savollar.push({
      raqam: seriya ? raqami(kq).replace(/[^\d]/g, '') : null,
      text, options, correctAnswer: javob, xato: kamchilik.length ? kamchilik.join(', ') : null,
    });
  }
  return savollar;
}

// --- MS-33-35 va MS-36-45 --------------------------------------------------------------

async function guruhliSavollar(jadvallar: Jadval[], tur: GuruhTuri, katakHtml: KatakHtml): Promise<JadvalGuruh[]> {
  const guruhlar: (JadvalGuruh & { ortiqcha: number })[] = [];
  const ichki = tur === 'moslash' ? ICHKI_KATAK : QISM_KATAK;
  for (const j of jadvallar) {
    let joriy: (JadvalGuruh & { ortiqcha: number }) | null = null;
    for (const q of j.filter(x => x.length >= 2)) {
      const r = raqami(q);
      const n = q.length;
      if (RAQAM_KATAK.test(r)) {
        // Guruh boshi: umumiy shart (MS-33-35 da — javoblar ro'yxati ham: 2-ustundan oxirgisidan oldingisigacha).
        const variantlar = tur === 'moslash' && n >= 4 ? await Promise.all(q.slice(2, n - 1).map(katakHtml)) : [];
        while (variantlar.length && !variantlar[variantlar.length - 1]) variantlar.pop();
        joriy = { tur, raqam: r.replace(/[^\d]/g, ''), text: await katakHtml(q[1]), variantlar, savollar: [], xato: null, chala: null, ortiqcha: 0 };
        guruhlar.push(joriy);
        continue;
      }
      const m = ichki.exec(r);
      // Raqami boshqa guruhniki bo'lgan qator (boshi o'chirib yuborilgan) — hech qaysi guruhga qo'shilmaydi.
      if (!m || !joriy || m[1] !== joriy.raqam) continue;
      const text = await katakHtml(q[1]);
      const xom = oxirgi(q);
      if (!text && !xom) continue;   // to'ldirilmagan qator
      if (joriy.savollar.length >= (tur === 'qismli' ? MAKS_QISM : MAKS_SAVOL)) { joriy.ortiqcha++; continue; }
      const javob = tur === 'moslash' ? javobHarfi(xom) || '' : xom.replace(/\u0000R\d+\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
      joriy.savollar.push({ text, javob, son: tur === 'qismli' && SON_JAVOB.test(javob) });
    }
  }
  // Bo'sh qolgan shablon guruhlari (shart ham, savol ham yo'q) tashlanadi.
  return guruhlar.filter(g => g.text || g.savollar.length || g.variantlar.some(Boolean)).map(({ ortiqcha, ...g }) => {
    const savollar = g.savollar.map(s => (g.tur === 'moslash' && s.javob && 'ABCDEF'.indexOf(s.javob) >= g.variantlar.length ? { ...s, javob: '' } : s));
    const hammasi = [g.text, ...g.variantlar, ...savollar.map(s => s.text)].join(' ');
    const xato = [
      !g.text && "umumiy shart yo'q",
      savollar.some(s => !s.text) && "bo'sh savol bor",
      savollar.length < (g.tur === 'moslash' ? 2 : 1) && (g.tur === 'moslash' ? 'savollar kam (kamida 2 ta)' : "qismlar yo'q"),
      g.tur === 'moslash' && g.variantlar.length < 2 && "javoblar ro'yxati yo'q",
      g.tur === 'moslash' && g.variantlar.some(v => !v) && "javoblar ro'yxatida bo'sh katak bor",
      ortiqcha > 0 && (g.tur === 'qismli' ? `qismlar ${MAKS_QISM} tadan ko'p` : `savollar ${MAKS_SAVOL} tadan ko'p`),
    ].filter(Boolean) as string[];
    const chala = [
      /o'qilmadi/.test(hammasi) && OQILMADI,
      savollar.some(s => !s.javob) && "javobi yo'q savol bor",
    ].filter(Boolean) as string[];
    return { ...g, savollar, xato: xato.join(', ') || null, chala: chala.join(', ') || null };
  });
}

// --- Yozma -----------------------------------------------------------------------------

async function yozmaSavollar(jadvallar: Jadval[], katakHtml: KatakHtml): Promise<JadvalYozma[]> {
  const savollar: JadvalYozma[] = [];
  for (const j of jadvallar) {
    // Ustunlar sarlavhadan aniqlanadi (bo'lmasa: № | savol | javob | yechim).
    let ustun = { savol: 1, javob: 2, yechim: 3 };
    for (const q of j.filter(x => x.length >= 2 && x.length <= 4)) {
      if (!RAQAM_KATAK.test(raqami(q))) {
        const nomlar = q.map(k => katakMatni(k).toLowerCase());
        const top = (re: RegExp) => nomlar.findIndex(x => re.test(x));
        const y = top(/yechim|решени|solution/), jv = top(/javob|ответ|answer/), s = top(/savol|masala|вопрос|задач|question/);
        if (y > 0 || jv > 0) ustun = { savol: s > 0 ? s : 1, javob: jv > 0 ? jv : -1, yechim: y > 0 ? y : -1 };
        continue;
      }
      const text = await katakHtml(q[ustun.savol]);
      if (!text) continue;
      const javob = ustun.javob > 0 ? katakMatni(q[ustun.javob]).replace(/\u0000R\d+\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
      const yechim = ustun.yechim > 0 ? await katakHtml(q[ustun.yechim]) : '';
      savollar.push({
        raqam: raqami(q).replace(/[^\d]/g, ''), text, javob, yechim: yechim || null,
        xato: /o'qilmadi/.test(text + yechim) ? OQILMADI : null,
      });
    }
  }
  return savollar;
}
