// Savollarni ommaviy tarjima qilish (lib/tarjimaKop.js): til tanlovi, chegara, xato turlari va
// cheklangan parallellikdagi navbat.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TARJIMA_KOP_MAX, TARJIMA_PARALLEL, boshTarjimaTili, idlarniChekla, navbatBilanBajar,
  tarjimaQilinmaydimi, tarjimaTillari, tarjimaXatoTuri, tilNomi,
} from '../lib/tarjimaKop.js';

test("tillar: savolning o'z tili tanlovda yo'q; boshlang'ich tanlov — o'zbekchadan ruschaga, boshqasidan o'zbekchaga", () => {
  assert.deepEqual(tarjimaTillari('uz').map(t => t.v), ['ru', 'en']);
  assert.deepEqual(tarjimaTillari('ru').map(t => t.v), ['uz', 'en']);
  assert.deepEqual(tarjimaTillari(undefined).map(t => t.v), ['ru', 'en']);
  assert.equal(boshTarjimaTili('uz'), 'ru');
  assert.equal(boshTarjimaTili(undefined), 'ru');
  assert.equal(boshTarjimaTili('en'), 'uz');
  assert.equal(tilNomi('ru'), 'Ruscha');
  assert.equal(tilNomi('xx'), 'xx');
});

test('guruhli savollar (juft, qismli) tarjima qilinmaydi', () => {
  assert.equal(tarjimaQilinmaydimi('juft'), true);
  assert.equal(tarjimaQilinmaydimi('qismli'), true);
  assert.equal(tarjimaQilinmaydimi('yopiq'), false);
  assert.equal(tarjimaQilinmaydimi('yozma'), false);
});

test("idlarniChekla: takror, noto'g'ri qiymatlar tashlanadi; chegaradan oshgani sanaladi", () => {
  assert.deepEqual(idlarniChekla([3, 3, '4', 0, -1, 1.5, 'x', null, 5]), { olingan: [3, 4, 5], ortiqcha: 0 });
  const kop = Array.from({ length: TARJIMA_KOP_MAX + 7 }, (_, i) => i + 1);
  const r = idlarniChekla(kop);
  assert.equal(r.olingan.length, TARJIMA_KOP_MAX);
  assert.equal(r.ortiqcha, 7);
  assert.deepEqual(idlarniChekla("yo'q"), { olingan: [], ortiqcha: 0 });
});

test("tarjimaXatoTuri: limit/kalit — to'xtash, savol sababi — o'tkazish, qolgani — xato", () => {
  assert.equal(tarjimaXatoTuri(429), 'toxta');
  assert.equal(tarjimaXatoTuri(503), 'toxta');
  assert.equal(tarjimaXatoTuri(400), 'otkazildi');
  assert.equal(tarjimaXatoTuri(404), 'otkazildi');
  assert.equal(tarjimaXatoTuri(504), 'xato');
  assert.equal(tarjimaXatoTuri(500), 'xato');
  assert.equal(tarjimaXatoTuri(0), 'xato');
});

test("navbatBilanBajar: bir vaqtda ko'pi bilan `parallel` ta, hammasi bajariladi", async () => {
  let yugurmoqda = 0; let eng = 0;
  const bajarilgan = [];
  await navbatBilanBajar([1, 2, 3, 4, 5, 6, 7], async (n) => {
    yugurmoqda++; eng = Math.max(eng, yugurmoqda);
    await new Promise(r => setTimeout(r, 5));
    bajarilgan.push(n);
    yugurmoqda--;
  }, { parallel: TARJIMA_PARALLEL });
  assert.equal(TARJIMA_PARALLEL, 2);
  assert.equal(eng, 2);
  assert.deepEqual(bajarilgan.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
});

test("navbatBilanBajar: toxta() rost bo'lgach yangisi boshlanmaydi, boshlanganlari tugaydi", async () => {
  let toxta = false;
  const boshlangan = [];
  await navbatBilanBajar([1, 2, 3, 4, 5, 6], async (n) => {
    boshlangan.push(n);
    await new Promise(r => setTimeout(r, 5));
    if (n === 2) toxta = true;
  }, { parallel: 2, toxta: () => toxta });
  assert.ok(boshlangan.length < 6, `${boshlangan.length} ta boshlandi`);
  assert.ok(boshlangan.includes(1) && boshlangan.includes(2));
});

test("navbatBilanBajar: bo'sh ro'yxat — hech narsa qilmaydi", async () => {
  let chaqirildi = false;
  await navbatBilanBajar([], async () => { chaqirildi = true; });
  assert.equal(chaqirildi, false);
});
