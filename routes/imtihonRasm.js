// Savol rasmini AI vektor (SVG) qilib chizadi — mantiq lib/imtihonRasm.js, tozalash
// lib/svgTozala.js. Bitta so'rov — bitta chizma. Natija bankka yozilmaydi: tozalangan SVG
// Storage'ga fayl bo'lib tushadi va havolasi qaytadi — xodim savolni saqlaganda shu havola
// odatdagi `imageUrl` bo'ladi (rasm ko'rsatadigan hamma joy uni <img> bilan ochadi).
//
// Kalit — markazniki (routes/imtihonAI.js bilan bir xil: aiBilan + markazKaliti).

import { randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { aiBilan, AiXato } from '../lib/imtihonAI.js';
import { markazKaliti } from './imtihonAI.js';
import { rasmChiz, rasmTayyormi, manbaRasmQismi } from '../lib/imtihonRasm.js';
import { svgniTozala } from '../lib/svgTozala.js';

// Chizma — AI so'rovlarining eng og'iri; savol kiritishda ketma-ket ko'p chaqiriladi.
const rasmCheklovi = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `rasm:${req.user?.id ?? 'nomalum'}`,
  message: { error: "Chizma so'rovlari juda ko'p — bir soatdan keyin qayta urinib ko'ring" },
});

const AI_YOQILMAGAN = "AI yoqilmagan: administrator Imtihonlar → Sozlamalar bo'limida AI kalitini kiritishi kerak";
const MAKS_RASM = 3 * 1024 * 1024;

const aiKontekst = async (req, res, next) => {
  let kalit;
  try { kalit = await markazKaliti(req.user); } catch (err) { return next(err); }
  aiBilan(kalit, () => next());
};

/** Havola shu loyihaning ochiq Storage'iga tegishlimi (server boshqa manzilga so'rov yubormaydi). */
function ozStorageHavolasi(url) {
  try {
    const u = new URL(url);
    const asos = new URL(process.env.SUPABASE_URL || '');
    return u.protocol === 'https:' && u.host === asos.host && u.pathname.startsWith('/storage/v1/object/public/');
  } catch { return false; }
}

async function havolaniOl(url) {
  let javob;
  try {
    javob = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AiXato("Asl rasmni ochib bo'lmadi", 400);
  }
  if (!javob.ok || !javob.body) throw new AiXato("Asl rasmni ochib bo'lmadi", 400);
  // Hajm oqim davomida tekshiriladi (content-length bo'lmasa ham butun fayl xotiraga olinmaydi).
  const bolaklar = [];
  let jami = 0;
  try {
    for await (const bolak of javob.body) {
      jami += bolak.length;
      if (jami > MAKS_RASM) throw new AiXato('Asl rasm juda katta', 413);
      bolaklar.push(bolak);
    }
  } catch (e) {
    if (e instanceof AiXato) throw e;
    throw new AiXato("Asl rasmni ochib bo'lmadi", 400);
  }
  return { tur: (javob.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), bayt: Buffer.concat(bolaklar) };
}

function svgDataUrlMatni(v) {
  const m = /^data:image\/svg\+xml((?:;[^,]*)?),(.*)$/is.exec(v);
  if (!m) return '';
  try { return /;base64/i.test(m[1]) ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2]); } catch { return ''; }
}

/**
 * Mijoz yuborgan manba (SVG matni, data URL yoki o'zimizning Storage havolasi) →
 * { svg: matn } | { rasm: inlineData qismi } | null (bo'sh).
 */
async function manbaniOl(qiymat) {
  const v = typeof qiymat === 'string' ? qiymat.trim() : '';
  if (!v) return null;
  if (v.startsWith('<')) return { svg: v };
  if (/^data:image\/svg\+xml/i.test(v)) return { svg: svgDataUrlMatni(v) };
  if (v.startsWith('data:')) return { rasm: manbaRasmQismi(v) };
  if (!ozStorageHavolasi(v)) throw new AiXato("Rasm manbasi noto'g'ri", 400);
  const { tur, bayt } = await havolaniOl(v);
  if (tur.includes('svg') || /\.svg$/i.test(new URL(v).pathname)) return { svg: bayt.toString('utf8') };
  if (!/^image\/(png|jpeg|webp)$/.test(tur)) throw new AiXato("Asl rasm formati noto'g'ri (PNG, JPEG yoki WebP)", 400);
  return { rasm: { inlineData: { mimeType: tur, data: bayt.toString('base64') } } };
}

/** Modelga namuna bo'lib boradigan SVG ham tozalanadi (hajmi cheklanadi, ortiqchasi va oq foni ketadi); yaroqsizi — bo'sh. */
function tozaSvg(xom) {
  try { return svgniTozala(String(xom || ''), { fon: false }).svg; } catch { return ''; }
}

const royxat = (v) => (Array.isArray(v) ? v : [v]).filter(x => typeof x === 'string' && x.trim());

/**
 * `storage` — Supabase Storage mijozi (server.js dagi supabaseAdmin.storage).
 */
export function registerImtihonRasmRoutes(app, { storage }) {
  /** Tozalangan SVG ni ochiq Storage'ga yozadi. Bo'lmasa null (mijoz PNG qilib odatdagi yo'l bilan yuklaydi). */
  async function svgniYukla(svg) {
    // Mahalliy sinov (scratch/o10_rasm_soxta_server.mjs): Storage'siz — chizma havola o'rniga data URL bo'lib qaytadi.
    if (process.env.RASM_SOXTA_STORAGE === '1' && !process.env.VERCEL) return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
    try {
      const nom = `svg_${Date.now()}_${randomBytes(6).toString('hex')}.svg`;
      const { error } = await storage.from('uploads').upload(nom, Buffer.from(svg, 'utf8'), { contentType: 'image/svg+xml', cacheControl: '31536000', upsert: false });
      if (error) throw error;
      return storage.from('uploads').getPublicUrl(nom).data?.publicUrl || null;
    } catch (e) {
      console.error('[rasm] SVG Storage ga yuklanmadi:', e?.message || e);
      return null;
    }
  }

  // Savol matni (va asl rasm) bo'yicha vektor chizma. Kirish:
  //   matn, shart?, variantlar?, javob?, fan?, raqam? — savol (bank HTML i yoki oddiy matn);
  //   aslRasm? — shu savolning asl rasmi yoki sahifa surati: data URL yoki o'zimizning Storage havolasi (3 tagacha);
  //   namuna? — o'xshash masalada ASL masalaning rasmi (SVG matni/havolasi yoki rastr);
  //   avvalgiSvg? — shu savolning avvalgi chizmasi (qayta chizish); tanqid? — uning kamchiliklari; korsatma? — ustoz so'zi;
  //   sifat? — 'yuqori' | 'tez'; saqla? — false bo'lsa Storage'ga yozilmaydi.
  // Javob: { svg, url, eni, boyi, ogohlar, jiddiy, tuzat, model }.
  app.post('/api/ai/rasm', authenticate, rasmCheklovi, aiKontekst, async (req, res, next) => {
    try {
      if (!rasmTayyormi()) return res.status(503).json({ error: AI_YOQILMAGAN });
      const b = req.body || {};
      // Manbalar (ko'pi bilan 6 ta) birga olinadi — Storage'dan ketma-ket kutish funksiya vaqtini yeb qo'ymasin.
      const [asllar, namunalar, avvalgi] = await Promise.all([
        Promise.all(royxat(b.aslRasm).slice(0, 3).map(manbaniOl)),
        Promise.all(royxat(b.namuna).slice(0, 2).map(manbaniOl)),
        typeof b.avvalgiSvg === 'string' && b.avvalgiSvg ? manbaniOl(b.avvalgiSvg) : null,
      ]);
      const rasmlar = asllar.filter(x => x?.rasm).map(x => x.rasm);
      const namunaRasmlar = namunalar.filter(x => x?.rasm).map(x => x.rasm);
      // Asl rasm yoki namuna allaqachon vektor bo'lsa — modelga matn bo'lib boradi (bittasi).
      const namunaSvg = tozaSvg([...asllar, ...namunalar].find(x => x?.svg)?.svg);
      const matn = String(b.matn ?? '').slice(0, 20000);
      if (!matn.replace(/<[^>]*>/g, '').trim() && !rasmlar.length) return res.status(400).json({ error: 'Savol matni yoki asl rasm kerak' });

      const natija = await rasmChiz({
        matn, shart: String(b.shart ?? '').slice(0, 20000),
        variantlar: Array.isArray(b.variantlar) ? b.variantlar : [],
        javob: String(b.javob ?? ''), fan: String(b.fan ?? ''), raqam: String(b.raqam ?? '').replace(/[^\dA-Za-z]/g, ''),
        rasmlar, namunaSvg, namunaRasmlar,
        avvalgiSvg: avvalgi?.svg ? tozaSvg(avvalgi.svg) : '',
        tanqid: Array.isArray(b.tanqid) ? b.tanqid : [],
        korsatma: String(b.korsatma ?? ''),
        sifat: b.sifat === 'tez' ? 'tez' : 'yuqori',
      });
      const url = b.saqla === false ? null : await svgniYukla(natija.svg);
      res.json({ svg: natija.svg, url, eni: natija.eni, boyi: natija.boyi, ogohlar: natija.ogohlar, jiddiy: natija.jiddiy, tuzat: natija.jiddiy > 0, model: natija.model });
    } catch (err) {
      if (err instanceof AiXato) return res.status(err.status).json({ error: err.message, ...(err.sabab ? { sabab: err.sabab } : {}) });
      next(err);
    }
  });
}
