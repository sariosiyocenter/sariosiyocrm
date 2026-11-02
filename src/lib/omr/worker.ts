/// <reference lib="webworker" />
// Varaqni o'qish fonda: katta rasm (telefon 12 MP, skaner 300 dpi) sahifani
// qotirib qo'ymasin. Kiradi: rasm (ImageBitmap) + varaq parametrlari.
// Chiqadi: o'qilgan javoblar va to'g'rilangan varaqning kichik JPEG nusxasi
// (serverda saqlanadi, operator oynasida savol qatori shundan kesib ko'rsatiladi).

import { kulrangga, varaqniOqi, tasvirniKichrayt } from './reader';
import type { Kulrang } from './reader';
import { varaqSahifalari } from './layout';
import type { VaraqParametrlari } from './layout';

export interface IshchiSorov { id: number; bitmap: ImageBitmap; params: VaraqParametrlari; sahifa?: number; jpeg?: boolean }

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Kulrang tasvir → JPEG data-URL. */
async function jpegga(t: Kulrang, sifat: number): Promise<string> {
  const oc = new OffscreenCanvas(t.w, t.h);
  const og = oc.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const id2 = og.createImageData(t.w, t.h);
  for (let i = 0; i < t.d.length; i++) {
    const v = t.d[i];
    id2.data[i * 4] = v; id2.data[i * 4 + 1] = v; id2.data[i * 4 + 2] = v; id2.data[i * 4 + 3] = 255;
  }
  og.putImageData(id2, 0, 0);
  return new FileReaderSync().readAsDataURL(await oc.convertToBlob({ type: 'image/jpeg', quality: sifat }));
}

/** To'g'rilangan varaqdan bo'lak (mm), atrofi bilan — qo'lyozma katakchalari uchun to'liq aniqlikda. */
function kes(t: Kulrang, S: number, q: { x: number; y: number; w: number; h: number }, chet = 1.2): Kulrang {
  const x0 = Math.max(0, Math.round((q.x - chet) * S)), y0 = Math.max(0, Math.round((q.y - chet) * S));
  const x1 = Math.min(t.w, Math.round((q.x + q.w + chet) * S)), y1 = Math.min(t.h, Math.round((q.y + q.h + chet) * S));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) d.set(t.d.subarray((y0 + y) * t.w + x0, (y0 + y) * t.w + x0 + w), y * w);
  return { w, h, d };
}

ctx.onmessage = async (e: MessageEvent<IshchiSorov>) => {
  const { id, bitmap, params, sahifa, jpeg = true } = e.data;
  try {
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    g.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = g.getImageData(0, 0, c.width, c.height);
    const kul = kulrangga(data.data, c.width, c.height);
    const sahifalar = varaqSahifalari(params);
    const r = varaqniOqi(kul, { sahifalar, masshtab: 5, sahifa, qoida: params.qoida });
    let rasm: string | null = null;
    if (jpeg && r.tasvir) rasm = await jpegga(tasvirniKichrayt(r.tasvir, 840), 0.72);
    // Qo'lyozma (ICR) maydonlari — kichik rasm emas, to'g'rilangan tasvirning o'zidan (5 px/mm).
    const icr = r.ok && r.tasvir
      ? await Promise.all((sahifalar.find(x => x.page === r.page)?.icr || []).map(async m => ({ id: m.id, sarlavha: m.sarlavha, maydon: m.maydon, rasm: await jpegga(kes(r.tasvir!, r.masshtab, m.quti), 0.85) })))
      : [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tasvir, ...natija } = r;
    ctx.postMessage({ id, natija: { ...natija, icr }, rasm });
  } catch (err: any) {
    ctx.postMessage({ id, xato: String(err?.message || err) });
  }
};
