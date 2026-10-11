import { zipYasa } from './zip';
import { texDanOmml, xmlEsc } from './omml';
import { svgmi, svgniPngga } from './svgRasm';

// Kichik .docx yasovchi (kutubxonasiz): hujjat XML i, rasmlar va uslublar —
// bitta ZIP. Savol matni HTML (p, b, i, u, sub, sup, ro'yxat, rasm, $formula$)
// Word paragraflari va "run" lariga o'giriladi; formulalar — OMML.

export const EMU_SM = 360000; // 1 sm
export const TWIP_SM = 567; // 1 sm

export interface YuklanganRasm { data: Uint8Array; tur: 'png' | 'jpeg' | 'gif'; w: number; h: number }

/** Rasmlarni yuklab oladi (bir vaqtda 6 tadan); ochilmaganlari tushib qoladi. */
export async function rasmlarniYukla(urllar: string[]): Promise<Map<string, YuklanganRasm>> {
  const natija = new Map<string, YuklanganRasm>();
  const navbat = [...new Set(urllar.filter(Boolean))];
  const ishchi = async () => {
    for (let url = navbat.shift(); url; url = navbat.shift()) {
      try {
        // Vektor chizma (AI chizgan SVG): Word uni tanimaydi — chop sifatidagi (300 dpi) PNG ga
        // o'giriladi; o'lcham (w, h) — chizmaning tabiiy o'lchami, PNG nuqtalari emas.
        const blob = svgmi(url) ? null : await (await fetch(url)).blob();
        if (!blob || /svg/i.test(blob.type)) {
          const { blob: png, w, h } = await svgniPngga(blob ? await blob.text() : url);
          natija.set(url, { data: new Uint8Array(await png.arrayBuffer()), tur: 'png', w, h });
          continue;
        }
        let tur: YuklanganRasm['tur'] = blob.type.includes('png') ? 'png' : blob.type.includes('gif') ? 'gif' : 'jpeg';
        let data = new Uint8Array(await blob.arrayBuffer());
        const bm = await createImageBitmap(blob);
        // Word webp ni tanimaydi — PNG ga o'giriladi.
        if (!/png|jpe?g|gif/.test(blob.type)) {
          const c = document.createElement('canvas');
          c.width = bm.width; c.height = bm.height;
          c.getContext('2d')!.drawImage(bm, 0, 0);
          data = new Uint8Array(await (await new Promise<Blob>(ok => c.toBlob(b => ok(b!), 'image/png'))).arrayBuffer());
          tur = 'png';
        }
        natija.set(url, { data, tur, w: bm.width, h: bm.height });
      } catch { /* ochilmagan rasm tushib qoladi */ }
    }
  };
  await Promise.all(Array.from({ length: 6 }, ishchi));
  return natija;
}

/** Hujjat rasmlari: har biri bir marta qo'shiladi, drawing XML qaytaradi. */
export class Rasmlar {
  private royxat: { rid: string; nom: string; r: YuklanganRasm }[] = [];
  private idlar = new Map<string, string>();
  private n = 0;
  private yuklangan: Map<string, YuklanganRasm>;
  constructor(yuklangan: Map<string, YuklanganRasm>) { this.yuklangan = yuklangan; }

  drawing(url: string, maxKenglikSm: number, maxBalandlikSm = 7): string {
    const r = this.yuklangan.get(url);
    if (!r) return '';
    let rid = this.idlar.get(url);
    if (!rid) {
      rid = `rRasm${this.royxat.length + 1}`;
      this.royxat.push({ rid, nom: `rasm${this.royxat.length + 1}.${r.tur === 'jpeg' ? 'jpg' : r.tur}`, r });
      this.idlar.set(url, rid);
    }
    // 96 dpi deb: px → sm, chegaraga sig'diriladi.
    let w = (r.w / 96) * 2.54, h = (r.h / 96) * 2.54;
    const k = Math.min(1, maxKenglikSm / w, maxBalandlikSm / h);
    w *= k; h *= k;
    const cx = Math.round(w * EMU_SM), cy = Math.round(h * EMU_SM);
    const id = ++this.n;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Rasm ${id}"/>`
      + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
      + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="rasm${id}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  get fayllar() { return this.royxat; }
}

export interface RunUslub { b?: boolean; i?: boolean; u?: boolean; vert?: 'superscript' | 'subscript'; sz?: number; rang?: string }

function rPr(u: RunUslub): string {
  const q = [u.b && '<w:b/>', u.i && '<w:i/>', u.u && '<w:u w:val="single"/>', u.rang && `<w:color w:val="${u.rang}"/>`, u.sz && `<w:sz w:val="${u.sz}"/><w:szCs w:val="${u.sz}"/>`, u.vert && `<w:vertAlign w:val="${u.vert}"/>`].filter(Boolean).join('');
  return q ? `<w:rPr>${q}</w:rPr>` : '';
}

/** Oddiy matn run i. */
export function matnRun(matn: string, u: RunUslub = {}): string {
  if (!matn) return '';
  return `<w:r>${rPr(u)}<w:t xml:space="preserve">${xmlEsc(matn)}</w:t></w:r>`;
}

/** Matn tugunidagi $...$ — formula, qolgani — run. */
function matnVaFormula(matn: string, u: RunUslub): string {
  const bolaklar = matn.replace(/ /g, ' ').split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g);
  return bolaklar.map(b => {
    if (!b) return '';
    const ikki = b.startsWith('$$') && b.endsWith('$$') && b.length > 4;
    const bir = !ikki && b.startsWith('$') && b.endsWith('$') && b.length > 2;
    if (ikki || bir) return texDanOmml(b.slice(ikki ? 2 : 1, ikki ? -2 : -1)) || matnRun(b, u);
    return matnRun(b, u);
  }).join('');
}

const BLOK_TEGLAR = new Set(['P', 'DIV', 'H3', 'H4', 'BLOCKQUOTE', 'LI', 'UL', 'OL', 'TABLE', 'TR', 'PRE']);

/**
 * HTML → paragraflar (har biri — run lar). Rasm alohida paragrafda emas, o'z
 * joyida (inline). Ro'yxat bandlari "• " yoki "1) " bilan.
 */
export function htmlParagraflar(html: string, rasmlar: Rasmlar, maxRasmSm: number, asos: RunUslub = {}): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const ildiz = doc.body.firstElementChild as HTMLElement;
  const paragraflar: string[] = [];
  let joriy = '';
  const yop = () => { if (joriy.trim() || paragraflar.length === 0) paragraflar.push(joriy); joriy = ''; };
  const inline = (n: Node, u: RunUslub): string => {
    if (n.nodeType === 3) return matnVaFormula((n as Text).data, u);
    if (n.nodeType !== 1) return '';
    const el = n as HTMLElement;
    const t = el.tagName;
    if (t === 'BR') return '<w:r><w:br/></w:r>';
    if (t === 'IMG') return rasmlar.drawing(el.getAttribute('src') || '', maxRasmSm);
    const yangi: RunUslub = { ...u, ...(t === 'B' || t === 'STRONG' ? { b: true } : {}), ...(t === 'I' || t === 'EM' ? { i: true } : {}), ...(t === 'U' ? { u: true } : {}), ...(t === 'SUP' ? { vert: 'superscript' as const } : {}), ...(t === 'SUB' ? { vert: 'subscript' as const } : {}) };
    return Array.from(el.childNodes).map(c => inline(c, yangi)).join('');
  };
  const blok = (el: Node, u: RunUslub, prefiks = '') => {
    if (el.nodeType !== 1 || !BLOK_TEGLAR.has((el as HTMLElement).tagName)) { joriy += inline(el, u); return; }
    const e = el as HTMLElement;
    if (e.tagName === 'UL' || e.tagName === 'OL') {
      yop();
      Array.from(e.children).forEach((li, i) => { joriy = matnRun(e.tagName === 'OL' ? `${i + 1}) ` : '• ', u); Array.from(li.childNodes).forEach(c => blok(c, u)); yop(); });
      return;
    }
    if (e.tagName === 'TABLE') {
      yop();
      for (const tr of Array.from(e.querySelectorAll('tr'))) {
        joriy = Array.from(tr.children).map(td => Array.from(td.childNodes).map(c => inline(c, u)).join('')).join('<w:r><w:tab/></w:r>');
        yop();
      }
      return;
    }
    if (joriy.trim()) yop();
    joriy += prefiks;
    Array.from(e.childNodes).forEach(c => blok(c, u));
    yop();
  };
  Array.from(ildiz.childNodes).forEach(c => blok(c, asos));
  if (joriy.trim()) yop();
  return paragraflar.length ? paragraflar : [''];
}

/** HTML ni bitta paragraf run lariga (paragraflar orasida — qator uzilishi). */
export function htmlRunlar(html: string, rasmlar: Rasmlar, maxRasmSm: number, asos: RunUslub = {}): string {
  return htmlParagraflar(html, rasmlar, maxRasmSm, asos).filter(p => p.trim()).join('<w:r><w:br/></w:r>');
}

const USLUBLAR = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="uz-Latn-UZ"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

/** Butun hujjat: `tana` — paragraflar va bo'limlar (oxirgi bo'lim xossalari `oxirgiSectPr`). */
export async function docxYasa(tana: string, oxirgiSectPr: string, rasmlar: Rasmlar): Promise<Blob> {
  const kod = new TextEncoder();
  const hujjat = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${tana}${oxirgiSectPr}</w:body></w:document>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rUslub" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rasmlar.fayllar.map(f => `<Relationship Id="${f.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${f.nom}"/>`).join('')}</Relationships>`;
  const turlar = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const asosiyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rHujjat" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const zip = await zipYasa([
    { nom: '[Content_Types].xml', data: kod.encode(turlar) },
    { nom: '_rels/.rels', data: kod.encode(asosiyRels) },
    { nom: 'word/document.xml', data: kod.encode(hujjat) },
    { nom: 'word/styles.xml', data: kod.encode(USLUBLAR) },
    { nom: 'word/_rels/document.xml.rels', data: kod.encode(rels) },
    ...rasmlar.fayllar.map(f => ({ nom: `word/media/${f.nom}`, data: f.r.data })),
  ]);
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
