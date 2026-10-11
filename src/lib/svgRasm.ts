// Savol rasmlari — vektor (SVG): AI chizmasini so'rash (bitta yoki to'plam) va chizmani
// Word uchun PNG ga aylantirish. Server: routes/imtihonRasm.js (POST /api/ai/rasm).
//
// Xavfsizlik: SVG faqat <img src> orqali ko'rsatiladi (rasm sifatida ochilgan SVG ichida
// skript ishlamaydi va tashqi manba yuklanmaydi). Uning matni sahifaga HTML bo'lib
// (innerHTML, dangerouslySetInnerHTML) HECH QACHON qo'yilmaydi. Tozalash — serverda.

/** useImtihonApi().soro bilan bir xil imzo. */
export type Soro = <T = any>(method: string, yol: string, body?: any) => Promise<T>;

export interface RasmSorovi {
  /** Savol matni (bank HTML i yoki oddiy matn). */
  matn: string;
  /** Guruhli savol yoki o'qish matnining umumiy sharti. */
  shart?: string | null;
  variantlar?: string[] | null;
  /** To'g'ri javob — chizmada ko'rsatilmaydi, faqat nisbatlar to'g'ri chiqishi uchun. */
  javob?: string | null;
  fan?: string | null;
  /** Materialdagi tartib raqami (asl rasm butun sahifa bo'lsa — AI kerakli chizmani shu bo'yicha topadi). */
  raqam?: string | null;
  /** SHU savolning asl rasmi yoki sahifa surati: data URL yoki Storage havolasi (3 tagacha). */
  aslRasm?: string | string[] | null;
  /** O'xshash masalada ASL masalaning rasmi (vektor yoki rastr): uslub shundan, sonlar — yangi masaladan. */
  namuna?: string | string[] | null;
  /** Shu savolning avvalgi chizmasi (qayta chizishda): Storage havolasi yoki SVG matni. */
  avvalgiSvg?: string | null;
  /** Ustozning bir qatorli ko'rsatmasi. */
  korsatma?: string | null;
}

export interface ChizilganRasm {
  /** Savolning `imageUrl` iga yoziladigan havola. */
  url: string;
  /** false — Storage SVG ni qabul qilmadi, chizma PNG bo'lib saqlandi. */
  vektor: boolean;
  /** Chizmaning tabiiy o'lchami (CSS px). */
  eni: number;
  boyi: number;
  /** Avtomatik tekshiruv topgan kamchiliklar (bo'sh — hammasi joyida). */
  ogohlar: string[];
}

interface RasmJavobi { svg: string; url: string | null; eni: number; boyi: number; ogohlar: string[]; jiddiy: number; tuzat: boolean; model: string | null }

export const svgmi = (url?: string | null): boolean => !!url && (/^data:image\/svg\+xml/i.test(url) || /\.svg(?:[?#]|$)/i.test(url));

/** Savol matnida AI qoldirgan «[rasm]» (Word'dan — «[rasm 2]») belgisi bormi: asl materialda chizma bo'lgan. */
export const rasmBelgisiBor = (html?: string | null): boolean => /\[rasm(?:\s*\d+)?\]/i.test(html || '');
/** Chizma biriktirilgach matndagi «[rasm]» belgisi ortiqcha (kitobchada so'z bo'lib chiqib qoladi). */
export const rasmBelgisiz = (html: string): string => html.replace(/\s*\[rasm(?:\s*\d+)?\]/gi, '').replace(/<p>\s*<\/p>/g, '');

const kut = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms));

// Kuchli model funksiya vaqtiga sig'masa (504) — shu sahifa ochiq turguncha yengil rejimda so'raladi.
let tezRejim = false;

async function birSorov(soro: Soro, sorov: RasmSorovi, qoshimcha: Record<string, unknown>, limitniKut: boolean): Promise<RasmJavobi> {
  let qaytaSoraldi = false;
  let kutildi = 0;
  for (;;) {
    try {
      return await soro<RasmJavobi>('POST', 'ai/rasm', { ...sorov, ...qoshimcha, sifat: tezRejim ? 'tez' : 'yuqori' });
    } catch (e: any) {
      if (e?.status === 504 && !tezRejim) { tezRejim = true; continue; }
      // Model chizma o'rniga matn qaytargan yoki chizmasi yaroqsiz — yana bir marta.
      if (e?.status === 422 && e?.malumot?.sabab === 'chizilmadi' && !qaytaSoraldi) { qaytaSoraldi = true; continue; }
      // AI ning daqiqalik limiti: to'plamda biroz kutib davom etamiz.
      if (e?.status === 429 && limitniKut && kutildi < 2) { kutildi++; await kut(20000); continue; }
      throw e;
    }
  }
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, xato) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ''));
    r.onerror = () => xato(r.error || new Error("Faylni o'qib bo'lmadi"));
    r.readAsDataURL(blob);
  });
}

/**
 * Bitta savol rasmini chizdiradi va saqlashga tayyor havolasini qaytaradi. Chizmada jiddiy
 * kamchilik topilsa (yozuvlar ustma-ust va h.k.) — AI ga bir marta tuzattiriladi.
 * Xato — ApiXato (matni: rasmXatoMatni; `malumot.sabab === 'kerak-emas'` — savolga rasm kerak emas).
 */
export async function rasmChiz(soro: Soro, sorov: RasmSorovi, o: { limitniKut?: boolean } = {}): Promise<ChizilganRasm> {
  let j = await birSorov(soro, sorov, {}, !!o.limitniKut);
  if (j.tuzat) {
    try {
      const tuzatilgan = await birSorov(soro, sorov, { avvalgiSvg: j.url || j.svg, tanqid: j.ogohlar }, !!o.limitniKut);
      if (tuzatilgan.jiddiy < j.jiddiy) j = tuzatilgan;
    } catch {
      // Tuzatish chiqmadi — birinchi chizma qoladi (kamchiligi `ogohlar` da ko'rinadi).
    }
  }
  if (j.url) return { url: j.url, vektor: true, eni: j.eni, boyi: j.boyi, ogohlar: j.ogohlar };
  // Storage SVG ni qabul qilmadi: chop sifatidagi PNG odatdagi yo'l bilan yuklanadi.
  const { blob } = await svgniPngga(j.svg);
  const { url } = await soro<{ url: string }>('POST', 'upload', { data: await blobDataUrl(blob), filename: 'chizma.png' });
  return { url, vektor: false, eni: j.eni, boyi: j.boyi, ogohlar: j.ogohlar };
}

/** Chizma xatosi → oddiy so'z bilan. */
export function rasmXatoMatni(e: any): string {
  if (e?.status === 504) return "Chizma ulgurmadi — qayta urinib ko'ring";
  if (e?.status === 413) return 'Asl rasm juda katta — kichikroq surat oling';
  if (!e?.status && e instanceof TypeError) return "Internet uzildi — qayta urinib ko'ring";
  return e?.message || "Chizib bo'lmadi";
}

export interface RasmIshi<K> { kalit: K; sorov: RasmSorovi }
export type RasmNatijasi = { rasm: ChizilganRasm; xato?: undefined } | { rasm?: undefined; xato: string; kerakEmas?: boolean };

/**
 * Ko'p savolning rasmini navbat bilan chizdiradi (bir vaqtda `birVaqtda` ta, standart 2).
 * Har natija tayyor bo'lishi bilan `onNatija` chaqiriladi. `toxta()` true qaytarsa (oyna yopildi) —
 * qolganlari so'ralmaydi. AI ketma-ket ishlamasa (kalit, limit) — qolganlari ham to'xtaydi.
 */
export async function rasmlarniChiz<K>(soro: Soro, ishlar: RasmIshi<K>[], o: {
  birVaqtda?: number; onNatija?: (kalit: K, natija: RasmNatijasi) => void; toxta?: () => boolean;
} = {}): Promise<Map<K, RasmNatijasi>> {
  const natijalar = new Map<K, RasmNatijasi>();
  const navbat = [...ishlar];
  let ketmaKetXato = 0;
  let toxtadi: string | null = null;
  const ishchi = async () => {
    for (let ish = navbat.shift(); ish; ish = navbat.shift()) {
      let natija: RasmNatijasi;
      if (toxtadi !== null || o.toxta?.()) {
        natija = { xato: toxtadi ?? "To'xtatildi" };
      } else {
        try {
          natija = { rasm: await rasmChiz(soro, ish.sorov, { limitniKut: true }) };
          ketmaKetXato = 0;
        } catch (e: any) {
          natija = { xato: rasmXatoMatni(e), kerakEmas: e?.malumot?.sabab === 'kerak-emas' };
          if ((e?.status === 429 || e?.status === 503) && ++ketmaKetXato >= 2) toxtadi = natija.xato;
        }
      }
      natijalar.set(ish.kalit, natija);
      o.onNatija?.(ish.kalit, natija);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, o.birVaqtda ?? 2)) }, ishchi));
  return natijalar;
}

// --- SVG → PNG (Word eksporti va zaxira saqlash) -------------------------------

/** SVG matni: o'zi, data URL yoki havola (Storage). */
async function svgMatni(manba: string): Promise<string> {
  if (manba.trimStart().startsWith('<')) return manba;
  const m = /^data:image\/svg\+xml((?:;[^,]*)?),([^]*)$/i.exec(manba);
  if (m) return /;base64/i.test(m[1]) ? new TextDecoder().decode(Uint8Array.from(atob(m[2]), c => c.charCodeAt(0))) : decodeURIComponent(m[2]);
  const javob = await fetch(manba);
  if (!javob.ok) throw new Error(`Chizma ochilmadi (${javob.status})`);
  return javob.text();
}

/** Chizmaning tabiiy o'lchami (CSS px): ildizdagi width/height, bo'lmasa viewBox. */
export function svgOlchami(svg: string): { w: number; h: number } {
  const bosh = /<svg\b[^>]*>/i.exec(svg)?.[0] || '';
  const atr = (nom: string) => new RegExp(`\\s${nom}\\s*=\\s*["']([^"']*)["']`, 'i').exec(bosh)?.[1] ?? '';
  const [w, h] = [atr('width'), atr('height')];
  if (parseFloat(w) > 0 && parseFloat(h) > 0 && !/%/.test(w + h)) return { w: parseFloat(w), h: parseFloat(h) };
  const vb = atr('viewBox').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    const k = Math.min(1, 480 / vb[2], 400 / vb[3]);
    return { w: vb[2] * k, h: vb[3] * k };
  }
  return { w: 300, h: 150 };
}

/**
 * SVG ni PNG ga chizadi — chop sifatida (standart 300 dpi; qog'ozdagi o'lcham 96 px = 1 dyuym deb).
 * `manba` — SVG matni, data URL yoki havola. Qaytadi: PNG va chizmaning tabiiy o'lchami (px).
 * SVG bu yerda ham faqat rasm sifatida (<img>) ochiladi.
 */
export async function svgniPngga(manba: string, o: { dpi?: number; maksPx?: number } = {}): Promise<{ blob: Blob; w: number; h: number }> {
  let matn = await svgMatni(manba);
  const { w, h } = svgOlchami(matn);
  // Ildizda o'lcham bo'lmasa ba'zi brauzerlar (Firefox) rasmni kanvasga chizmaydi.
  if (!/<svg\b[^>]*\swidth\s*=/i.test(matn)) matn = matn.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
  const k = Math.min((o.dpi ?? 300) / 96, (o.maksPx ?? 2600) / Math.max(w, h));
  const url = URL.createObjectURL(new Blob([matn], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const kanvas = document.createElement('canvas');
    kanvas.width = Math.max(1, Math.round(w * k));
    kanvas.height = Math.max(1, Math.round(h * k));
    const g = kanvas.getContext('2d');
    if (!g) throw new Error('Kanvas ochilmadi');
    // Chizma foni shaffof — Word va PNG da oq qog'oz bo'lsin.
    g.fillStyle = '#fff';
    g.fillRect(0, 0, kanvas.width, kanvas.height);
    g.drawImage(img, 0, 0, kanvas.width, kanvas.height);
    const blob = await new Promise<Blob>((ok, xato) => kanvas.toBlob(b => (b ? ok(b) : xato(new Error('PNG yasalmadi'))), 'image/png'));
    return { blob, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
