// Savol rasmini AI vektor (SVG) qilib chizadi: fayldan savol kiritishda (asl rasm yoki sahifa
// surati bo'yicha) va o'xshash masala tuzishda (yangi sonlar uchun qayta chizish).
// Egasi (2026-10-10): «vector qilib rasm tuzsin, eng zo'r rasm chizishi kerak».
//
// Bir so'rov — bitta chizma (Vercel funksiya vaqti). Model javobi ishonchsiz kirish: har doim
// lib/svgTozala.js dan o'tadi (xavfsizlik + chopga tayyorlash). Tozalagich topgan `jiddiy`
// kamchiliklar bilan mijoz yana bir marta «tuzatib chiz» deb so'raydi — bu alohida so'rov.
//
// Model: avval kuchlirog'i (GEMINI_RASM_MODEL, standart — «pro» modellar), u kalitga
// berilmagan, limiti tugagan yoki ulgurmasa — odatdagi model (lib/imtihonAI.js modelgaSora).
//
// Ko'rsatma (prompt) ingliz tilida: SVG atamalari va chizmachilik qoidalari shu tilda
// aniqroq bajariladi. Chizmadagi yozuvlar masalaning o'z tilida qoladi.

import { aiKaliti, aiSozlanganmi, AiXato, modelgaSora, htmldanMatn } from './imtihonAI.js';
import { svgniTozala, SvgXato } from './svgTozala.js';
import { HARFLAR } from './imtihon.js';

const KUCHLI_MODELLAR = 'gemini-pro-latest,gemini-2.5-pro';
/** Kuchli model shu vaqtda javob bermasa — odatdagi modelga o'tiladi (ms). */
const kuchliVaqt = () => Math.min(120_000, Math.max(5_000, parseInt(process.env.RASM_KUCHLI_MS, 10) || 30_000));
function kuchliModellar() {
  const v = (process.env.GEMINI_RASM_MODEL ?? KUCHLI_MODELLAR).trim();
  return /^(off|yoq|0)?$/i.test(v) ? [] : v.split(',').map(x => x.trim()).filter(Boolean).slice(0, 4);
}

// Sinov uchun: haqiqiy model o'rniga ({ tizim, qismlar, sifat }) => SVG li matn | { matn, uzildi }.
let soxta = null;
export function rasmSoxtaModel(f) { soxta = f; }
export const rasmTayyormi = () => !!soxta || aiSozlanganmi();

const TIZIM = `You draw the figures for a printed school exam booklet (mathematics, geometry, physics, chemistry, informatics, geography, biology). For the problem you are given, produce ONE clean black-line SVG figure of textbook quality. It is printed small (about 6–9 cm wide) on a black-and-white printer, so precision, clear labels and nothing superfluous matter most.

HOW TO WORK
1. List what the figure must contain: every object, every given length, angle or value, and every letter that the problem (or the source picture) shows.
2. Choose coordinates and COMPUTE them from the data — never eyeball what can be calculated. True proportions (a 6-8-10 triangle is drawn 3:4:5; a 30° angle is 30°), exact intersections, tangency points, midpoints, feet of altitudes, function values. SVG's y axis points down: flip mathematical y yourself.
3. Place every label so that it touches no line and no other label: vertex letters outside the shape, pushed away from its centroid; a side's length beside the midpoint of the side, offset perpendicular to it on the outer side; an angle's value just beyond its arc, on the bisector; axis names at the arrow tips; tick numbers below the x axis and left of the y axis.
4. Only then write the SVG.

OUTPUT
First a short plan inside <reja>…</reja> (at most 12 lines: the key points with their computed coordinates). Then exactly one <svg>…</svg>. No other text and no markdown fences.
If the problem needs no figure at all (plain text or calculation, nothing geometric or visual, and no source picture shows one), answer with the single word NO_FIGURE instead.

SVG RULES (a strict sanitizer removes everything else, which would break your drawing)
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">, no width/height. One unit is about one pixel on paper: W between 180 and 380, H between 100 and 300, with at least 14 units of free margin around everything, labels included.
- Elements: only g, defs, marker, clipPath, pattern, path, line, polyline, polygon, rect, circle, ellipse, text, tspan. Presentation ATTRIBUTES only — no <style>, class, style="", <image>, <use>, foreignObject, filters, gradients, links, scripts, animation or external references.
- Ink: stroke="#000" and fill="none" on every outline (an omitted fill is solid black!). No colours, no background rectangle, no frame, no title. A region the problem calls shaded or painted: fill="#d9d9d9", or a diagonal hatch <pattern> when two regions must differ.
- Line weights: figure outlines 1.6; auxiliary lines (heights, medians, radii, diagonals, projections, dimension lines) 1; axes 1.2; grid 0.5 with stroke="#999". Hidden and auxiliary lines are dashed: stroke-dasharray="5 4". Put stroke-linecap="round" stroke-linejoin="round" on the root.
- Text: font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#000" stroke="none". Letters that name points, sides and variables: font-style="italic". Set text-anchor (start | middle | end) deliberately and remember that y is the BASELINE (a label centred on a point needs y ≈ centre + 5). Keep labels horizontal.
- No LaTeX, no $…$, no MathML. Write mathematics as plain Unicode: α β γ φ θ π ° √ ² ³ ₁ ₂ × · ± ≤ ≥ ≠ ∞ → ∠ ⊥ ∥ Δ; fractions as 1/2 or ½. For other indices use <tspan baseline-shift="sub" font-size="10">…</tspan>.
- Arrowheads: define once
  <marker id="uch" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#000"/></marker>
  and put marker-end="url(#uch)" on the line (marker-start too for a double arrow).

DRAWING CONVENTIONS
- Right angle: a small square of side 8 in the corner, its sides parallel to the two sides of the angle.
- Any other angle: an arc of radius 18–24 centred at the vertex, running from one side to the other through the INTERIOR of the angle (compute both end points from the side directions and choose the sweep flag accordingly); equal angles get the same number of arcs.
- Equal segments: one (two, three) short tick(s) across the midpoint, perpendicular to the segment. Parallel lines: small matching arrow marks.
- A named point that is not a corner of an outline: filled dot r="2.2". Circle centre: dot and the letter O.
- Solids (cube, prism, pyramid, cylinder, cone, sphere): oblique parallel projection; hidden edges dashed; circular bases as ellipses whose back half is dashed.
- Graphs: both axes with arrowheads, labelled x and y, origin O, tick marks with numbers at a regular step, the same unit length on both axes unless the data forbid it. The curve is a path through at least 40 computed points (or exact Bézier/arc segments), clipped to the plot area with a clipPath. Key points get dots, with dashed projections to the axes when their coordinates matter.
- Physics: bodies as rectangles or circles; forces, velocities and accelerations as arrows starting at the point of application, labelled (F, mg, N, v, a…); a surface with short hatching underneath; an inclined plane with its angle arc; a spring as a zigzag; a thread as a thin line; a pulley as a circle with its axle; lenses, mirrors and light rays with arrowheads on the rays; circuits with standard symbols on orthogonal wires (resistor = rectangle, cell = long thin and short thick parallel strokes, lamp = circle with ×, ammeter/voltmeter = circle with A/V, switch = open lever, capacitor = two parallel strokes).
- Tables: a thin rectangular grid with the text centred in each cell. Bar, line and pie charts: labelled axes or sectors, hatch patterns instead of colours. Number line: arrow, ticks, numbers below, marked points as dots (a hollow dot is an excluded endpoint).

CONTENT
- Show what is GIVEN, exactly as the problem or its source shows it, and mark the unknown the way the problem does ("x", "?", "α"). Never write the answer, a step of the solution, or any value the student has to find — even when you are told the correct answer (it is given only so that the proportions come out true).
- Do not put the problem's text, its number or the answer options into the figure.
- Labels use the problem's own letters and language; units as in the problem (sm, m, kg, °).
- With a SOURCE PICTURE: redraw the same figure faithfully — the same objects, labels and arrangement — but straightened, exact and clean. Ignore handwriting, stains, page texture and surrounding text. If the picture is a whole page, draw only the figure that belongs to THIS problem; if the page has no figure for it, draw from the text.
- With a REFERENCE SVG of the original problem (the new problem is its variant with other numbers): keep its style, layout and conventions, but recompute every coordinate and label from the NEW problem's data.`;

const qisqa = (v, maks) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, maks);
/** Namuna yoki avvalgi chizma modelga matn bo'lib boradi — juda kattasi so'rovni sekinlashtiradi. */
const MAKS_NAMUNA = 24_000;

/** data:image/…;base64,… → Gemini inlineData qismi (asl rasm yoki sahifa surati). */
export function manbaRasmQismi(dataUrl) {
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new AiXato("Asl rasm formati noto'g'ri (PNG, JPEG yoki WebP)", 400);
  return { inlineData: { mimeType: m[1].toLowerCase().replace('jpg', 'jpeg'), data: m[2] } };
}

/**
 * Modelga boradigan qismlar. `matn`, `shart`, `variantlar` — bank HTML i yoki oddiy matn;
 * `rasmlar` — SHU savolning asl rasmi yoki sahifa surati (tayyor inlineData qismlari, manbaRasmQismi);
 * `namunaSvg` / `namunaRasmlar` — o'xshash masalada ASL masalaning chizmasi (vektor yoki rastr):
 * uslub va joylashuv shundan, sonlar — yangi masaladan; `avvalgiSvg` — shu savolning avvalgi
 * chizmasi (ustoz «qayta chiz» degan yoki `tanqid` — avtomatik tekshiruv kamchiliklari).
 */
export function sorovQismlari({ matn = '', shart = '', variantlar = [], javob = '', fan = '', raqam = '', rasmlar = [], namunaSvg = '', namunaRasmlar = [], avvalgiSvg = '', tanqid = [], korsatma = '' }) {
  const masala = htmldanMatn(String(matn).slice(0, 20000)).slice(0, 6000);
  const umumiy = htmldanMatn(String(shart).slice(0, 20000)).slice(0, 4000);
  const variantMatni = (Array.isArray(variantlar) ? variantlar : []).slice(0, HARFLAR.length)
    .map((v, i) => `${HARFLAR[i]}) ${htmldanMatn(String(v ?? '').slice(0, 4000)).slice(0, 400)}`).join('\n');
  const kamchiliklar = (Array.isArray(tanqid) ? tanqid : []).map(t => qisqa(t, 240)).filter(Boolean).slice(0, 8);
  const talab = qisqa(korsatma, 400);
  const bosh = [
    fan ? `SUBJECT: ${qisqa(fan, 120)}` : '',
    umumiy ? `SHARED CONDITION:\n${umumiy}` : '',
    `PROBLEM${raqam ? ` (number ${qisqa(raqam, 8)} in the source)` : ''}:\n${masala || '(no text — draw the figure shown in the source picture)'}`,
    variantMatni ? `ANSWER OPTIONS (context only — never drawn):\n${variantMatni}` : '',
    javob ? `CORRECT ANSWER (secret — for true proportions only, never shown): ${qisqa(javob, 120)}` : '',
    rasmlar.length ? `SOURCE PICTURE${rasmlar.length > 1 ? 'S' : ''}: attached below.` : '',
  ].filter(Boolean).join('\n\n');
  const oxiri = [
    namunaSvg && namunaSvg.length <= MAKS_NAMUNA ? `REFERENCE SVG — the figure of the ORIGINAL problem that this one is a variant of:\n${namunaSvg}` : '',
    avvalgiSvg && avvalgiSvg.length <= MAKS_NAMUNA
      ? (kamchiliklar.length
        ? `YOUR PREVIOUS ATTEMPT is below. An automatic check found these defects — fix every one of them and return the complete corrected SVG:\n${kamchiliklar.map(k => `- ${k}`).join('\n')}\n${avvalgiSvg}`
        : `THE PREVIOUS DRAWING is below. The teacher was not satisfied with it — draw the figure again, better and laid out differently:\n${avvalgiSvg}`)
      : '',
    talab ? `TEACHER'S INSTRUCTION (follow it exactly; it overrides the conventions above where they conflict):\n${talab}` : '',
  ].filter(Boolean).join('\n\n');
  const namunaQismlari = namunaRasmlar.length
    ? [{ text: 'REFERENCE PICTURE — the figure of the ORIGINAL problem that this one is a variant of (other numbers). Keep the kind of figure and its layout, but take every value and label from THIS problem:' }, ...namunaRasmlar.slice(0, 2)]
    : [];
  return [{ text: bosh }, ...rasmlar.slice(0, 3), ...namunaQismlari, ...(oxiri ? [{ text: oxiri }] : [])];
}

/** Model matnidan SVG ni ajratadi (reja, izoh va ```...``` atrofdagi matn tashlanadi). */
export function svgniAjrat(javob) {
  const s = String(javob || '');
  const bosh = s.search(/<svg[\s>]/i);
  if (bosh < 0) return null;
  const oxir = s.lastIndexOf('</svg>');
  // Yopilmagan (uzilib qolgan) javob — tozalagich teglarni o'zi yopadi.
  return oxir > bosh ? s.slice(bosh, oxir + 6) : s.slice(bosh);
}

// --- Model chaqiruvi ---------------------------------------------------------

const mijozlar = new Map();
async function mijozOl(kalit) {
  if (!mijozlar.has(kalit)) {
    const { GoogleGenAI } = await import('@google/genai');
    mijozlar.set(kalit, new GoogleGenAI({ apiKey: kalit }));
  }
  return mijozlar.get(kalit);
}

/**
 * Modelga qarab sozlama. «O'ylash» chegarasi faqat 2.5 modellarida beriladi, harorat — faqat 2.x da:
 * keyingi avlod (va «-latest» nomlar) o'z standartida ishlaydi — Google ularda haroratni pasaytirishni
 * tavsiya qilmaydi.
 */
function sorovSozlamasi(model, qismlar, { tez, harorat }) {
  const oylash = /2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: tez ? 1024 : /pro/.test(model) ? 8192 : 6144 } } : {};
  const harorati = /gemini-2/.test(model) ? { temperature: harorat } : {};
  return {
    contents: [{ role: 'user', parts: qismlar }],
    config: { systemInstruction: TIZIM, maxOutputTokens: tez ? 12000 : 24000, ...harorati, ...oylash },
  };
}

// Kuchli model ishlamagan kalit uchun uni bir muddat chetlab o'tamiz (har so'rovda bekorga kutmaslik uchun).
const chetda = new Map();
const CHETDA = { yoq: 24 * 60 * 60_000, limit: 30 * 60_000, sekin: 10 * 60_000, band: 2 * 60_000 };

/** Kuchli modeldan so'raydi. Bo'lmasa (model yo'q, limit, band, ulgurmadi) — null: odatdagi model ishlaydi. */
async function kuchliModeldan(kalit, qismlar, harorat) {
  for (const model of kuchliModellar()) {
    const belgi = `${model}|${kalit.slice(-6)}`;
    if ((chetda.get(belgi) || 0) > Date.now()) continue;
    try {
      const sorov = sorovSozlamasi(model, qismlar, { tez: false, harorat });
      const mijoz = await mijozOl(kalit);
      const javob = await mijoz.models.generateContent({ model, ...sorov, config: { ...sorov.config, abortSignal: AbortSignal.timeout(kuchliVaqt()) } });
      return { javob, model };
    } catch (e) {
      const matn = String(e?.message || e);
      const sabab = /abort|timeout|timed out/i.test(`${e?.name} ${matn}`) ? 'sekin'
        : /not found|404|is not supported/i.test(matn) ? 'yoq'
        : /429|RESOURCE_EXHAUSTED|quota/i.test(matn) ? 'limit' : 'band';
      chetda.set(belgi, Date.now() + CHETDA[sabab]);
      if (chetda.size > 500) chetda.delete(chetda.keys().next().value);
      // Kalit yoki hudud xatosi bo'lsa ham shu yerda to'xtamaymiz: odatdagi yo'l uni tushunarli matn bilan aytadi.
      if (sabab === 'sekin') return { ulgurmadi: true };
    }
  }
  return null;
}

async function modeldanSora({ qismlar, sifat, harorat }) {
  if (soxta) {
    const j = await soxta({ tizim: TIZIM, qismlar, sifat });
    return typeof j === 'string' ? { matn: j, model: 'soxta', uzildi: false } : { matn: String(j?.matn || ''), model: 'soxta', uzildi: !!j?.uzildi };
  }
  const kalit = aiKaliti();
  if (!kalit) throw new AiXato('AI yoqilmagan: administrator AI kalitini kiritishi kerak', 503);
  let tez = sifat === 'tez';
  if (!tez) {
    const kuchli = await kuchliModeldan(kalit, qismlar, harorat);
    if (kuchli?.javob) return natijaMatni(kuchli.javob, kuchli.model);
    // Kuchli model vaqtni yeb qo'ydi — qolganiga odatdagi model yengil rejimda ulguradi.
    if (kuchli?.ulgurmadi) tez = true;
  }
  let model = null;
  const javob = await modelgaSora(kalit, (m) => { model = m; return sorovSozlamasi(m, qismlar, { tez, harorat }); });
  return natijaMatni(javob, model);
}

const natijaMatni = (javob, model) => ({ matn: String(javob?.text || ''), model, uzildi: javob?.candidates?.[0]?.finishReason === 'MAX_TOKENS' });

/** 422 — model chizma bermadi. `sabab`: 'kerak-emas' (savolga rasm kerak emas) | 'chizilmadi'. */
function rasmXato(matn, sabab) {
  const x = new AiXato(matn, 422);
  x.sabab = sabab;
  return x;
}

/**
 * Bitta chizma. Qaytaradi: { svg (tozalangan), eni, boyi (CSS px), viewBox, ogohlar: string[],
 * jiddiy: soni (0 dan katta — qayta chizdirishga arziydi), model }. Hech narsa saqlanmaydi.
 * `sifat`: 'yuqori' (avval kuchli model) | 'tez' (darrov odatdagi model, kam «o'ylash»).
 */
export async function rasmChiz({ sifat = 'yuqori', ...malumot }) {
  const qismlar = sorovQismlari(malumot);
  // Ustoz «qayta chiz» degan (avtomatik tuzatish emas) — boshqacha chiqsin.
  const qaytaChizish = !!malumot.avvalgiSvg && !(malumot.tanqid || []).length;
  const { matn, model, uzildi } = await modeldanSora({ qismlar, sifat: sifat === 'tez' ? 'tez' : 'yuqori', harorat: qaytaChizish ? 0.6 : 0.2 });
  const xom = svgniAjrat(matn);
  if (!xom) {
    if (/\bNO_FIGURE\b/.test(matn)) throw rasmXato('AI bu savolga chizma kerak emas deb topdi', 'kerak-emas');
    throw rasmXato("AI chizma qaytarmadi — qayta urinib ko'ring", 'chizilmadi');
  }
  let natija;
  try {
    natija = svgniTozala(xom);
  } catch (e) {
    // Tozalagichning kutilmagan xatosi ham «chizma yaroqsiz»: tekshiruvdan o'tmagan matn hech qachon saqlanmaydi.
    if (!(e instanceof SvgXato)) console.error('[rasm] tozalagich xatosi:', e);
    throw rasmXato(`AI chizmasi yaroqsiz chiqdi${e instanceof SvgXato ? ` (${e.message})` : ''} — qayta urinib ko'ring`, 'chizilmadi');
  }
  if (uzildi) return { ...natija, ogohlar: ['Chizma oxirigacha yozilmadi', ...natija.ogohlar], jiddiy: natija.jiddiy + 1, model };
  return { ...natija, model };
}
