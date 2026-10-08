// Rasm fonini tozalash — bepul Hugging Face Space'lari (Gradio 5 API).
//
// 2026-10-08: ilgari server `briaai-bria-rmbg-1-4.hf.space/upload` ga yozardi. Space
// Gradio 5 ga o'tgach bu manzil 404 qaytara boshladi: bepul yo'l jimgina o'lib,
// har rasm pullik fal.ai ga tushardi (balans bo'lmasa — xato). Endi yangi API
// (`/gradio_api/...`) ishlatiladi va bir vaqtning o'zida uchta model so'raladi:
//
//   - BiRefNet va RMBG-2.0 — soch tolalari va murakkab fonni ancha toza kesadi,
//     lekin ular ZeroGPU'da: kirishsiz foydalanuvchiga kunlik limit bor, tugasa
//     1–2 soniyada xato qaytaradi;
//   - RMBG-1.4 — oddiy CPU'da, limitsiz, doim ishlaydi (4–6 soniya).
//
// Yaxshi model ulgursa — o'shaning natijasi, bo'lmasa RMBG-1.4 niki olinadi.
// HF_TOKEN muhit o'zgaruvchisi berilsa (bepul Hugging Face hisobi tokeni)
// ZeroGPU limiti ancha kengayadi.
//
// Brauzerga faqat NIQOB kerak (src/lib/image.ts uni asl rasmga qo'yadi), shuning
// uchun xizmat bergan fayllardan eng kichik shaffofi olinadi: RMBG 1 MB lik PNG
// bilan birga o'sha natijaning ~80 KB lik WebP nusxasini ham beradi.

const XIZMATLAR = {
  birefnet: { nom: 'BiRefNet', manzil: 'https://zhengpeng7-birefnet-demo.hf.space', api: 'image', kirish: f => [f, '1024x1024', 'General'] },
  rmbg20: { nom: 'RMBG-2.0', manzil: 'https://briaai-bria-rmbg-2-0.hf.space', api: 'image', kirish: f => [f] },
  rmbg14: { nom: 'RMBG-1.4', manzil: 'https://briaai-bria-rmbg-1-4.hf.space', api: 'run', kirish: f => [f] },
};

/** Yaxshi model sekin modeldan keyin yana shuncha kutiladi (ms). */
const YAXSHISINI_KUTISH = 2500;
/** Bitta xizmatga ajratilgan eng ko'p vaqt (ms). */
const XIZMAT_VAQTI = 14000;
/** Natija rasmi shundan katta bo'lsa olinmaydi (bayt). */
const ENG_KATTA_RASM = 12 * 1024 * 1024;

const kut = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Rasm baytlarida shaffoflik (alfa kanal) bormi. Fonsiz natijani asl rasmdan
 * shu ajratadi: xizmatlar ikkalasini ham qaytaradi va tartibi har xil.
 */
export function shaffofmi(b) {
  if (!b || b.length < 30) return false;
  // PNG: IHDR dagi rang turi — 4 (kulrang+alfa) yoki 6 (RGBA).
  if (b[0] === 0x89 && b[1] === 0x50) return b[25] === 4 || b[25] === 6;
  // WebP: RIFF....WEBP + birinchi bo'lak.
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const bolak = b.toString('latin1', 12, 16);
    if (bolak === 'VP8X') return (b[20] & 0x10) !== 0;
    if (bolak === 'VP8L') return ((b[24] >> 4) & 1) === 1;
  }
  return false;
}

/**
 * Gradio 5 natijasidagi rasm fayllari, yuklab ko'rish tartibida. Chiqish:
 *   [[asl, natija]]             — Imageslider (BiRefNet)
 *   [[natija, asl], png-fayl]   — Imageslider + File (RMBG)
 * Avval slayderdagilar (kichik), oxirida alohida fayl (katta PNG).
 */
export function natijaFayllari(data) {
  if (!Array.isArray(data)) return [];
  const fayl = (x) => (x && typeof x === 'object' && !Array.isArray(x) && (x.url || x.path) ? x : null);
  const slayder = data.filter(Array.isArray).flat().map(fayl).filter(Boolean);
  const alohida = data.map(fayl).filter(Boolean);
  return [...slayder, ...alohida];
}

/** SSE matnidan `complete` hodisasining ma'lumoti; `error` bo'lsa xato tashlaydi. */
export function sseNatija(matn) {
  for (const blok of String(matn).split(/\r?\n\r?\n/)) {
    const hodisa = (/^event: (.*)$/m.exec(blok) || [])[1];
    const malumot = (/^data: (.*)$/m.exec(blok) || [])[1];
    if (hodisa === 'error') throw new Error('xizmat rad etdi' + (malumot && malumot !== 'null' ? `: ${malumot.slice(0, 160)}` : ' (limit tugagan bo\'lishi mumkin)'));
    if (hodisa === 'complete' && malumot) return JSON.parse(malumot);
  }
  throw new Error('natija kelmadi');
}

async function gradioChaqir(x, buffer, mime, signal) {
  const kengaytma = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const token = process.env.HF_TOKEN;
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const asos = `${x.manzil}/gradio_api`;

  const form = new FormData();
  form.append('files', new Blob([buffer], { type: mime }), `input.${kengaytma}`);
  const yuklash = await fetch(`${asos}/upload`, { method: 'POST', body: form, headers: auth, signal });
  if (!yuklash.ok) throw new Error(`upload ${yuklash.status}`);
  const [yol] = await yuklash.json();
  if (!yol) throw new Error('upload bo\'sh javob');

  const fayl = { path: yol, orig_name: `input.${kengaytma}`, mime_type: mime, meta: { _type: 'gradio.FileData' } };
  const chaqiruv = await fetch(`${asos}/call/${x.api}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ data: x.kirish(fayl) }),
    signal,
  });
  if (!chaqiruv.ok) throw new Error(`call ${chaqiruv.status}`);
  const { event_id: hodisaId } = await chaqiruv.json();
  if (!hodisaId) throw new Error('event_id yo\'q');

  const oqim = await fetch(`${asos}/call/${x.api}/${hodisaId}`, { headers: auth, signal });
  if (!oqim.ok) throw new Error(`natija ${oqim.status}`);
  const fayllar = natijaFayllari(sseNatija(await oqim.text()));
  if (!fayllar.length) throw new Error('natijada rasm yo\'q');

  for (const f of fayllar) {
    // Fayl faqat shu xizmatning o'z manzilidan olinadi: javobda begona havola kelsa
    // server uni ochmaydi (va tokenni begona manzilga yubormaydi).
    let manzil = `${asos}/file=${f.path}`;
    try { if (f.url && new URL(f.url).origin === new URL(x.manzil).origin) manzil = f.url; } catch { /* yo'l bo'yicha olinadi */ }
    if (!f.path && manzil.endsWith('=undefined')) continue;
    const rasm = await fetch(manzil, { headers: auth, signal });
    if (!rasm.ok) continue;
    if (Number(rasm.headers.get('content-length') || 0) > ENG_KATTA_RASM) continue;
    const bayt = Buffer.from(await rasm.arrayBuffer());
    if (bayt.length > ENG_KATTA_RASM) continue;
    if (!shaffofmi(bayt)) continue;   // bu asl rasm — natija emas
    const tur = rasm.headers.get('content-type') || 'image/png';
    return `data:${tur};base64,${bayt.toString('base64')}`;
  }
  throw new Error('natijada shaffof rasm yo\'q');
}

/** Xizmatni chaqiradi; xato yoki vaqt tugasa — null (hech qachon tashlamaydi). */
async function urin(kalit, buffer, mime) {
  const x = XIZMATLAR[kalit];
  const boshqaruv = new AbortController();
  const taymer = setTimeout(() => boshqaruv.abort(), XIZMAT_VAQTI);
  const boshi = Date.now();
  try {
    const image = await gradioChaqir(x, buffer, mime, boshqaruv.signal);
    console.log(`[Remove BG] ${x.nom}: tayyor, ${Date.now() - boshi} ms, ${Math.round(image.length / 1024)} KB`);
    return { image, manba: x.nom };
  } catch (e) {
    console.warn(`[Remove BG] ${x.nom}: ${e.name === 'AbortError' ? 'vaqt tugadi' : e.message} (${Date.now() - boshi} ms)`);
    return null;
  } finally {
    clearTimeout(taymer);
  }
}

/** Birinchi muvaffaqiyatli natija; hammasi null bo'lsa — null. */
function birinchisi(vadalar) {
  return new Promise(hal => {
    let qoldi = vadalar.length;
    if (!qoldi) hal(null);
    for (const v of vadalar) v.then(n => { if (n) hal(n); else if (--qoldi === 0) hal(null); });
  });
}

/**
 * Fonni tozalaydi.
 * @param {Buffer} buffer rasm baytlari
 * @param {string} mime   masalan image/jpeg
 * @returns {Promise<{ image: string, manba: string } | null>} shaffof rasm (data URL) yoki null
 */
export async function fonTozalash(buffer, mime = 'image/jpeg') {
  const yaxshi = birinchisi([urin('birefnet', buffer, mime), urin('rmbg20', buffer, mime)]);
  const oddiy = urin('rmbg14', buffer, mime);
  return Promise.race([
    // Yaxshi model ulgurdi — o'shani; ikkalasi ham bo'lmadi — oddiysini kutamiz.
    yaxshi.then(n => n || oddiy),
    // Oddiysi tayyor: yaxshisiga yana biroz vaqt beriladi.
    oddiy.then(n => (n ? Promise.race([yaxshi, kut(YAXSHISINI_KUTISH).then(() => null)]).then(y => y || n) : yaxshi)),
  ]);
}
