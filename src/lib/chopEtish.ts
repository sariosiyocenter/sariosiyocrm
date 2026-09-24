// Brauzerning chop etish oynasi orqali chiqarish (printer yoki "PDF sifatida saqlash").
//
// Alohida iframe'da: ilova ichida `@media print` bilan qolganini yashirish oq
// varaq chiqarardi (DailySheet.tsx ham shunday qiladi). Imtihon varaqlarida
// o'quvchi rasmi, QR va formulalar (KaTeX shriftlari) bor — chop etish oynasi
// ular yuklangandan keyin ochiladi, aks holda varaqlar bo'sh joy bilan chiqadi.

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export interface ChopParam {
  sarlavha: string;
  css: string;
  /** Tayyor HTML (sahifalar). */
  body: string;
  /** Qo'shimcha <link> teglari (masalan KaTeX CSS). */
  head?: string;
  /** Rasm va shriftlarni kutish chegarasi, ms. */
  kutish?: number;
}

export function chopEt({ sarlavha, css, body, head = '', kutish = 20000 }: ChopParam): Promise<void> {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>${esc(sarlavha)}</title>${head}<style>${css}</style></head><body>${body}</body></html>`);
    doc.close();
    const win = iframe.contentWindow!;
    const tozala = () => setTimeout(() => iframe.remove(), 500);
    win.onafterprint = tozala;

    const rasmlar = Array.from(doc.images).filter(img => !img.complete).map(img => new Promise<void>(ok => {
      img.addEventListener('load', () => ok(), { once: true });
      img.addEventListener('error', () => ok(), { once: true });
    }));
    const shriftlar = (doc as Document & { fonts?: FontFaceSet }).fonts?.ready?.then(() => undefined) ?? Promise.resolve();
    const chegara = new Promise<void>(ok => setTimeout(ok, kutish));
    Promise.race([Promise.all([...rasmlar, shriftlar]), chegara]).then(() => {
      setTimeout(() => {
        win.focus();
        win.print();
        setTimeout(tozala, 60000);
        resolve();
      }, 150);
    });
  });
}
