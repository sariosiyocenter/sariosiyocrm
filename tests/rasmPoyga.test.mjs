// Chizma tezligi (lib/imtihonRasm.js): ustoz kutib turgan chizmada kuchli model kechiksa yonida odatdagi
// model ham chizadi va tezrog'i olinadi; ustoz ko'rsatmasi bilan qayta chizish — TAHRIR (odatdagi model,
// «qolganini o'zgartirma»). Google kutubxonasi soxta: har modelning kechikishi va javobi jadvaldan.
//   npm test   (modul almashtirish uchun --experimental-test-module-mocks kerak)
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'SINOV';
process.env.GEMINI_RASM_MODEL = 'kuchli-pro';
process.env.GEMINI_MODEL = 'gemini-2.5-flash';
process.env.RASM_ZAXIRA_MS = '3000';

const SVG = (nom) => `<reja>-</reja><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><line x1="10" y1="60" x2="190" y2="60" stroke="#000"/><text x="20" y="40" font-size="14">${nom}</text></svg>`;
/** model → { kechikish (ms), javob (matn) yoki xato } */
let jadval = {};
const chaqiruvlar = [];

class GoogleGenAI {
  constructor() {
    this.models = {
      generateContent: ({ model, contents, config }) => new Promise((ok, rad) => {
        const c = { model, config, matn: contents[0].parts.map(p => p.text || '').join('\n'), toxtatildi: false };
        chaqiruvlar.push(c);
        const q = jadval[model];
        if (!q) return rad(new Error(`404 model ${model} not found`));
        let tugadi = false;
        const t = setTimeout(() => { tugadi = true; if (q.xato) rad(new Error(q.xato)); else ok({ text: q.javob, candidates: [{ finishReason: q.uzildi ? 'MAX_TOKENS' : 'STOP' }] }); }, q.kechikish);
        // Javob kelib bo'lgach to'xtatish hech narsa qilmaydi (haqiqiy kutubxonada ham).
        config?.abortSignal?.addEventListener('abort', () => { if (tugadi) return; clearTimeout(t); c.toxtatildi = true; rad(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })); }, { once: true });
      }),
    };
  }
}
mock.module('@google/genai', { namedExports: { GoogleGenAI } });
const { rasmChiz } = await import('../lib/imtihonRasm.js');

const MASALA = { matn: '<p>ABC uchburchakda AB = 5 sm.</p>' };
const boshla = (j) => { jadval = j; chaqiruvlar.length = 0; return Date.now(); };

test('kuchli model zaxira vaqtigacha ulgursa — o\'zi, odatdagisi chaqirilmaydi', async () => {
  boshla({ 'kuchli-pro': { kechikish: 50, javob: SVG('kuchli') } });
  const r = await rasmChiz({ ...MASALA, shoshilinch: true });
  assert.equal(r.model, 'kuchli-pro');
  assert.deepEqual(chaqiruvlar.map(c => c.model), ['kuchli-pro']);
});

test('kuchli model kechiksa — yonida odatdagisi chizadi, tezrog\'i olinadi, kuchlisi to\'xtatiladi', async () => {
  const t0 = boshla({ 'kuchli-pro': { kechikish: 20_000, javob: SVG('kuchli') }, 'gemini-2.5-flash': { kechikish: 100, javob: SVG('tez') } });
  const r = await rasmChiz({ ...MASALA, shoshilinch: true });
  const vaqt = Date.now() - t0;
  assert.equal(r.model, 'gemini-2.5-flash');
  assert.ok(vaqt >= 3000 && vaqt < 6000, `${vaqt} ms`);
  assert.equal(chaqiruvlar.find(c => c.model === 'kuchli-pro').toxtatildi, true);
});

test('poygada odatdagi model yiqilsa — kuchlisining javobi kutiladi', async () => {
  boshla({ 'kuchli-pro': { kechikish: 3800, javob: SVG('kuchli') }, 'gemini-2.5-flash': { kechikish: 50, xato: '500 ichki xato' } });
  const r = await rasmChiz({ ...MASALA, shoshilinch: true });
  assert.equal(r.model, 'kuchli-pro');
});

test('poygada odatdagi modelning «chizma kerak emas» yoki uzilgan javobi kuchlisini to\'xtatmaydi', async () => {
  for (const tez of [{ kechikish: 50, javob: 'NO_FIGURE' }, { kechikish: 50, javob: SVG('chala'), uzildi: true }]) {
    boshla({ 'kuchli-pro': { kechikish: 3600, javob: SVG('kuchli') }, 'gemini-2.5-flash': tez });
    const r = await rasmChiz({ ...MASALA, shoshilinch: true });
    assert.equal(r.model, 'kuchli-pro', JSON.stringify(tez));
    assert.equal(chaqiruvlar.find(c => c.model === 'kuchli-pro').toxtatildi, false);
  }
});

test('kuchli model darrov ishlamasa (limit) — odatdagisi to\'liq sozlama bilan, kutmasdan', async () => {
  const t0 = boshla({ 'kuchli-pro': { kechikish: 20, xato: '429 RESOURCE_EXHAUSTED' }, 'gemini-2.5-flash': { kechikish: 50, javob: SVG('tez') } });
  // Limit kuchli modelni shu kalit uchun 30 daqiqa chetga qo'yadi — boshqa testlarga ta'sir qilmasin.
  process.env.GEMINI_API_KEY = 'LIMITLI';
  const r = await rasmChiz({ ...MASALA, shoshilinch: true }).finally(() => { process.env.GEMINI_API_KEY = 'SINOV'; });
  assert.equal(r.model, 'gemini-2.5-flash');
  assert.ok(Date.now() - t0 < 1500);
  const tez = chaqiruvlar.find(c => c.model === 'gemini-2.5-flash');
  assert.equal(tez.config.thinkingConfig?.thinkingBudget, 6144);
  assert.equal(tez.config.maxOutputTokens, 24000);
});

test('ustoz ko\'rsatmasi bilan — tahrir: faqat odatdagi model, «qolganini o\'zgartirma» ko\'rsatmasi bilan', async () => {
  boshla({ 'kuchli-pro': { kechikish: 50, javob: SVG('kuchli') }, 'gemini-2.5-flash': { kechikish: 50, javob: SVG('tahrir') } });
  const avvalgi = SVG('eski').replace(/^<reja>-<\/reja>/, '');
  const r = await rasmChiz({ ...MASALA, avvalgiSvg: avvalgi, korsatma: 'A harfini pastga tushir', shoshilinch: true });
  assert.equal(r.model, 'gemini-2.5-flash');
  assert.deepEqual(chaqiruvlar.map(c => c.model), ['gemini-2.5-flash']);
  assert.match(chaqiruvlar[0].matn, /EDIT it according to the TEACHER'S INSTRUCTION/);
  assert.match(chaqiruvlar[0].matn, /A harfini pastga tushir/);
  assert.doesNotMatch(chaqiruvlar[0].matn, /laid out differently/);
  assert.equal(chaqiruvlar[0].config.thinkingConfig?.thinkingBudget, 2048);
});

test('ko\'rsatmasiz «Qayta chizish» — boshqacha qilib qayta chiziladi (kuchli model bilan)', async () => {
  boshla({ 'kuchli-pro': { kechikish: 50, javob: SVG('yangi') } });
  const avvalgi = SVG('eski').replace(/^<reja>-<\/reja>/, '');
  const r = await rasmChiz({ ...MASALA, avvalgiSvg: avvalgi, shoshilinch: true });
  assert.equal(r.model, 'kuchli-pro');
  assert.match(chaqiruvlar[0].matn, /laid out differently/);
});
