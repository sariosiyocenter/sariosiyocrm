// Oddiy ZIP (siqmasdan, "stored"): bir nechta faylni bitta yuklab olishga
// yig'ish — har o'quvchiga alohida PDF, skanerlangan varaq rasmlari. PDF va
// JPG o'zi siqilgan, shuning uchun siqish kerak emas; kutubxona ham kerak emas.

const CRC_JADVAL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_JADVAL[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fayl nomidan taqiqlangan belgilarni olib tashlaydi. */
export function faylNomi(s: string): string {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'fayl';
}

export async function zipYasa(fayllar: { nom: string; data: Blob | Uint8Array }[]): Promise<Blob> {
  const kod = new TextEncoder();
  const qismlar: BlobPart[] = [];
  const markaziy: Uint8Array[] = [];
  const band = new Set<string>();
  let siljish = 0;
  for (const f of fayllar) {
    // Bir xil nom bo'lsa — (2), (3) qo'shiladi.
    let nom = f.nom;
    for (let i = 2; band.has(nom.toLowerCase()); i++) nom = f.nom.replace(/(\.[^.]+)?$/, ` (${i})$1`);
    band.add(nom.toLowerCase());
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
    const nomB = kod.encode(nom);
    const crc = crc32(data);
    const sarlavha = new DataView(new ArrayBuffer(30));
    sarlavha.setUint32(0, 0x04034b50, true);
    sarlavha.setUint16(4, 20, true);
    sarlavha.setUint16(6, 0x0800, true); // UTF-8 nomlar
    sarlavha.setUint32(14, crc, true);
    sarlavha.setUint32(18, data.length, true);
    sarlavha.setUint32(22, data.length, true);
    sarlavha.setUint16(26, nomB.length, true);
    qismlar.push(sarlavha.buffer, nomB, data);

    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true);
    m.setUint16(4, 20, true);
    m.setUint16(6, 20, true);
    m.setUint16(8, 0x0800, true);
    m.setUint32(16, crc, true);
    m.setUint32(20, data.length, true);
    m.setUint32(24, data.length, true);
    m.setUint16(28, nomB.length, true);
    m.setUint32(42, siljish, true);
    const yozuv = new Uint8Array(46 + nomB.length);
    yozuv.set(new Uint8Array(m.buffer), 0);
    yozuv.set(nomB, 46);
    markaziy.push(yozuv);
    siljish += 30 + nomB.length + data.length;
  }
  const markaziyHajm = markaziy.reduce((a, x) => a + x.length, 0);
  const oxiri = new DataView(new ArrayBuffer(22));
  oxiri.setUint32(0, 0x06054b50, true);
  oxiri.setUint16(8, markaziy.length, true);
  oxiri.setUint16(10, markaziy.length, true);
  oxiri.setUint32(12, markaziyHajm, true);
  oxiri.setUint32(16, siljish, true);
  return new Blob([...qismlar, ...markaziy, oxiri.buffer], { type: 'application/zip' });
}

export function yuklabOl(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
