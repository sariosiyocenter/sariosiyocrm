/// <reference types="vite/client" />
// Skanerning brauzer qismi: fayllarni (rasm yoki ko'p sahifali PDF) sahifa
// rasmlariga ajratish va ularni Web Worker'da o'qitish.

import type { VaraqParametrlari } from './layout';
import type { OqishNatijasi } from './reader';

export type IshchiNatija = { natija: Omit<OqishNatijasi, 'tasvir'>; rasm: string | null };

/** Bitta worker, navbat bilan. */
export class OmrIshchi {
  private w: Worker;
  private kutish = new Map<number, { ok: (v: IshchiNatija) => void; xato: (e: Error) => void }>();
  private n = 0;

  constructor() {
    this.w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = (e: MessageEvent) => {
      const k = this.kutish.get(e.data.id);
      if (!k) return;
      this.kutish.delete(e.data.id);
      if (e.data.xato) k.xato(new Error(e.data.xato));
      else k.ok({ natija: e.data.natija, rasm: e.data.rasm });
    };
  }

  oqi(bitmap: ImageBitmap, params: VaraqParametrlari, o: { sahifa?: number; jpeg?: boolean } = {}): Promise<IshchiNatija> {
    const id = ++this.n;
    return new Promise((ok, xato) => {
      this.kutish.set(id, { ok, xato });
      this.w.postMessage({ id, bitmap, params, ...o }, [bitmap]);
    });
  }

  yop() {
    this.w.terminate();
  }
}

/** 200 dpi atrofida — o'qish uchun yetarli, xotira ham ko'p ketmaydi. */
const PDF_MASSHTAB = 200 / 72;

/** Fayldan sahifa rasmlari: rasm — bitta, PDF — har sahifasi. */
export async function* faylSahifalari(file: File): AsyncGenerator<{ bitmap: ImageBitmap; nom: string }> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!pdf) {
    yield { bitmap: await createImageBitmap(file, { imageOrientation: 'from-image' } as any), nom: file.name };
    return;
  }
  const pdfjs = await import('pdfjs-dist');
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  // JBIG2 / JPEG2000 dekoderlari — vite.config.ts pdfjsWasm() qo'ygan papkadan.
  const vazifa = pdfjs.getDocument({ data: await file.arrayBuffer(), wasmUrl: '/pdfjs-wasm/' } as any);
  const doc = await vazifa.promise;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: PDF_MASSHTAB });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      await page.render({ canvas, viewport: vp, background: '#ffffff' } as any).promise;
      const bitmap = await createImageBitmap(canvas);
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      yield { bitmap, nom: `${file.name} · ${i}-sahifa` };
    }
  } finally {
    await vazifa.destroy();
  }
}
