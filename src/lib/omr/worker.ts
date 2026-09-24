/// <reference lib="webworker" />
// Varaqni o'qish fonda: katta rasm (telefon 12 MP, skaner 300 dpi) sahifani
// qotirib qo'ymasin. Kiradi: rasm (ImageBitmap) + varaq parametrlari.
// Chiqadi: o'qilgan javoblar va to'g'rilangan varaqning kichik JPEG nusxasi
// (serverda saqlanadi, operator oynasida savol qatori shundan kesib ko'rsatiladi).

import { kulrangga, varaqniOqi, tasvirniKichrayt } from './reader';
import { varaqSahifalari } from './layout';
import type { VaraqParametrlari } from './layout';

export interface IshchiSorov { id: number; bitmap: ImageBitmap; params: VaraqParametrlari; sahifa?: number; jpeg?: boolean }

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<IshchiSorov>) => {
  const { id, bitmap, params, sahifa, jpeg = true } = e.data;
  try {
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    g.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = g.getImageData(0, 0, c.width, c.height);
    const kul = kulrangga(data.data, c.width, c.height);
    const r = varaqniOqi(kul, { sahifalar: varaqSahifalari(params), masshtab: 5, sahifa });
    let rasm: string | null = null;
    if (jpeg && r.tasvir) {
      const t = tasvirniKichrayt(r.tasvir, 840);
      const oc = new OffscreenCanvas(t.w, t.h);
      const og = oc.getContext('2d') as OffscreenCanvasRenderingContext2D;
      const id2 = og.createImageData(t.w, t.h);
      for (let i = 0; i < t.d.length; i++) {
        const v = t.d[i];
        id2.data[i * 4] = v; id2.data[i * 4 + 1] = v; id2.data[i * 4 + 2] = v; id2.data[i * 4 + 3] = 255;
      }
      og.putImageData(id2, 0, 0);
      const blob = await oc.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
      rasm = new FileReaderSync().readAsDataURL(blob);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tasvir, ...natija } = r;
    ctx.postMessage({ id, natija, rasm });
  } catch (err: any) {
    ctx.postMessage({ id, xato: String(err?.message || err) });
  }
};
