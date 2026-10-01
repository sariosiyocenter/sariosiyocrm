// HTML bo'lagidan A4 PDF (Addmen "Multiple PDFs"): har o'quvchining hisoboti
// alohida fayl — ota-onaga yuborish yoki papkada saqlash uchun. Bo'lak yashirin
// iframe'da chiziladi, html2canvas rasmga oladi, jsPDF A4 betlarga bo'ladi.
// Kutubxonalar faqat kerak bo'lganda yuklanadi.

const KENGLIK = 794; // A4 eni 96 dpi da, px
const CHET = 42; // ~11 mm

export async function pdflarYasa(css: string, bolaklar: string[], onQadam?: (n: number) => void): Promise<Blob[]> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', left: '-10000px', top: '0', width: `${KENGLIK}px`, height: '1123px', border: '0' });
  document.body.appendChild(iframe);
  const natija: Blob[] = [];
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>${css}
      html, body { width: ${KENGLIK}px; } body { padding: ${CHET}px; box-sizing: border-box; background: #fff; }
      .bet { break-after: auto !important; margin: 0 !important; }</style></head><body></body></html>`);
    doc.close();
    for (const [i, html] of bolaklar.entries()) {
      doc.body.innerHTML = html;
      await Promise.all(Array.from(doc.images).filter(im => !im.complete).map(im => new Promise(ok => { im.onload = im.onerror = ok; })));
      await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
      const canvas = await html2canvas(doc.body, { scale: 2, backgroundColor: '#ffffff', windowWidth: KENGLIK, logging: false });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const betPx = Math.floor((canvas.width * 297) / 210);
      for (let tepa = 0; tepa < canvas.height; tepa += betPx) {
        const bo = document.createElement('canvas');
        bo.width = canvas.width;
        bo.height = Math.min(betPx, canvas.height - tepa);
        bo.getContext('2d')!.drawImage(canvas, 0, tepa, canvas.width, bo.height, 0, 0, canvas.width, bo.height);
        if (tepa > 0) pdf.addPage();
        pdf.addImage(bo.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, (bo.height * 210) / canvas.width);
      }
      natija.push(pdf.output('blob'));
      onQadam?.(i + 1);
    }
  } finally {
    iframe.remove();
  }
  return natija;
}
