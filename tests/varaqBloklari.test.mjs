// Varaq dizaynerining yangi bloklari (Addmen OMR Designer, 2026-11-02): qo'lyozma katakchalari (ICR),
// shtrix-kod (Code 128) va imzo qutisi; ICR ni AI bilan o'qish (soxta model bilan).
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { varaqAndozaTozala, varaqTuzilmasi } from '../lib/imtihon.js';
import { qolyozmaniOqi, soxtaModelniQoy } from '../lib/imtihonAI.js';
import { varaqSahifalari, blokOlchami, andozaXatolari, ICR_KATAK } from '../src/lib/omr/layout.ts';
import { NAQSHLAR, code128Qiymatlari, code128Modullari, shtrixSvg } from '../src/lib/omr/shtrix.ts';

test('Code 128 jadvali: 106 ta naqsh har biri 11 modul va takrorlanmaydi, stop — 13', () => {
  assert.equal(NAQSHLAR.length, 107);
  for (const n of NAQSHLAR.slice(0, 106)) assert.equal([...n].reduce((a, c) => a + Number(c), 0), 11, n);
  assert.equal(new Set(NAQSHLAR.slice(0, 106)).size, 106);
  assert.equal([...NAQSHLAR[106]].reduce((a, c) => a + Number(c), 0), 13);
});

test('Code 128B: start B, belgilar, nazorat raqami, stop', () => {
  // "AB": A=33, B=34 → (104 + 33·1 + 34·2) % 103 = 205 % 103 = 102.
  assert.deepEqual(code128Qiymatlari('AB'), [104, 33, 34, 102, 106]);
  const m = code128Modullari('K7Q2XZ');
  assert.equal(m.reduce((a, v) => a + v, 0), 11 * (1 + 6 + 1) + 13);
  assert.throws(() => code128Qiymatlari('Ўзб'));
  const svg = shtrixSvg('K7Q2XZ', { x: 20, y: 100, w: 50, h: 12 });
  assert.match(svg, /<rect /);
  assert.match(svg, />K7Q2XZ<\/text>/);
});

const tuzilma = varaqTuzilmasi([{ subject: 'Matematika', rules: [{ count: 10, points: 1 }] }], 'blok');
const andoza = varaqAndozaTozala({
  sahifalar: 1,
  bloklar: [
    { id: 'b1', tur: 'yopiq', sahifa: 1, x: 20, y: 90, boshi: 1, soni: 10, ustunlar: 1 },
    { id: 'ism', tur: 'icr', sahifa: 1, x: 80, y: 90, sarlavha: 'Familiya va ism', soni: 20, maydon: 'ism' },
    { id: 'tel', tur: 'icr', sahifa: 1, x: 20, y: 170, sarlavha: 'Telefon', soni: 50, maydon: 'nimadir' },
    { id: 'sh', tur: 'shtrix', sahifa: 1, x: 80, y: 130, w: 60, h: 14 },
    { id: 'im', tur: 'imzo', sahifa: 1, x: 80, y: 150, sarlavha: 'Nazoratchi imzosi', w: 50, h: 15 },
  ],
});

test("sozlama: yangi bloklar saqlanadi, chegaralar qo'llanadi", () => {
  assert.equal(andoza.bloklar.length, 5);
  const tel = andoza.bloklar.find(b => b.id === 'tel');
  assert.equal(tel.soni, 30);
  assert.equal(tel.maydon, 'matn');
  assert.equal(andoza.bloklar.find(b => b.id === 'sh').w, 60);
  assert.equal(andoza.bloklar.find(b => b.id === 'im').sarlavha, 'Nazoratchi imzosi');
});

test("varaq: ICR, shtrix va imzo o'z joyida; savol emas — tekshiruvda «yo'q savol» chiqmaydi", () => {
  const p = { tuzilma, optionCount: 4, variantCount: 1, variantBubble: false, andoza };
  const [s] = varaqSahifalari(p);
  assert.equal(s.icr.length, 2);
  const ism = s.icr.find(m => m.id === 'ism');
  assert.deepEqual(ism.quti, { x: 80, y: 90 + ICR_KATAK.sarlavha, w: 20 * ICR_KATAK.w, h: ICR_KATAK.h });
  assert.equal(ism.maydon, 'ism');
  assert.deepEqual(s.shtrixlar, [{ x: 80, y: 130, w: 60, h: 14 }]);
  assert.equal(s.imzolar[0].sarlavha, 'Nazoratchi imzosi');
  assert.deepEqual(blokOlchami(andoza.bloklar[1]), { w: 20 * ICR_KATAK.w, h: ICR_KATAK.sarlavha + ICR_KATAK.h });
  assert.deepEqual(andozaXatolari(andoza, p).xatolar, []);
});

test("qolyozmaniOqi: faqat so'ralgan maydonlar, telefon — raqamlar", async () => {
  let sorov = null;
  soxtaModelniQoy(async (s) => {
    sorov = s;
    return { natijalar: [{ id: '1:ism', matn: '  Aliyev   Vali ', ishonch: 0.9 }, { id: '1:tel', matn: '+998 90 123-45-67' }, { id: 'begona', matn: 'x' }] };
  });
  try {
    const rasm = 'data:image/jpeg;base64,AAAA';
    const r = await qolyozmaniOqi([
      { id: '1:ism', sarlavha: 'Familiya', maydon: 'ism', rasm },
      { id: '1:tel', sarlavha: 'Telefon', maydon: 'telefon', rasm },
    ]);
    assert.deepEqual(r, [
      { id: '1:ism', matn: 'Aliyev Vali', ishonch: 0.9 },
      { id: '1:tel', matn: '+998901234567', ishonch: null },
    ]);
    assert.equal(sorov.qismlar.filter(q => q.inlineData).length, 2);
  } finally {
    soxtaModelniQoy(null);
  }
});
