// Savollar banki filtrlari (lib/bankFiltr.js): bazasiz — faqat shart va so'rov matnlari.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { natijaQiyinligi } from '../lib/imtihon.js';
import { darsHolati, yechimIzi } from '../lib/imtihonDars.js';
import {
  DARS_FILTRI, NATIJA_FILTRI, YANGI_KUNLAR, YECHIM_HOLATI_FILTRI,
  boshqaSonlarSorovi, boshqaSonlari, natijaSharti, yangiChegara,
} from '../lib/bankFiltr.js';

test("natija sharti: noma'lum va to'liq tanlov — shart qo'yilmaydi", () => {
  assert.equal(natijaSharti(undefined), null);
  assert.equal(natijaSharti([]), null);
  assert.equal(natijaSharti(['noma\'lum']), null);
  assert.equal(natijaSharti([...NATIJA_FILTRI]), null);
});

test("natija sharti: chegaralar natijaQiyinligi bilan bir xil (0.7 — oson, 0.4 — o'rta)", () => {
  assert.equal(natijaQiyinligi(0.7), 1);
  assert.equal(natijaQiyinligi(0.4), 2);
  const s = natijaSharti(['oson', 'orta', 'qiyin']);
  assert.deepEqual(s.OR[0], { usedCount: { gt: 0 }, pCorrect: { gte: 0.7 } });
  assert.deepEqual(s.OR[1], { usedCount: { gt: 0 }, pCorrect: { gte: 0.4, lt: 0.7 } });
  assert.deepEqual(s.OR[2], { usedCount: { gt: 0 }, pCorrect: { lt: 0.4 } });
});

test("natija sharti: ma'lumot yo'q — ishlatilmagan yoki natijasi hisoblanmagan", () => {
  const s = natijaSharti(['yoq', 'oson']);
  assert.deepEqual(s.OR[0], { OR: [{ usedCount: { lte: 0 } }, { pCorrect: null }] });
  assert.equal(s.OR.length, 2);
});

test("yangi chegarasi: faqat 1, 7 va 30 kun; qolgani — null", () => {
  const hozir = new Date('2026-10-13T12:00:00Z');
  assert.deepEqual(YANGI_KUNLAR, [1, 7, 30]);
  assert.equal(yangiChegara(7, hozir).toISOString(), '2026-10-06T12:00:00.000Z');
  assert.equal(yangiChegara('30', hozir).toISOString(), '2026-09-13T12:00:00.000Z');
  assert.equal(yangiChegara(1, hozir).toISOString(), '2026-10-12T12:00:00.000Z');
  for (const x of [0, 2, -7, NaN, null, undefined, 'abc']) assert.equal(yangiChegara(x, hozir), null);
});

test("dars holati: yo'q, qoralama, tasdiqlangan va eskirgan (yechim o'zgargan)", () => {
  const savol = { solution: '<p>x = 2</p>', correctAnswer: 'B' };
  const dars = (status, izi = yechimIzi(savol)) => ({ status, yechimIzi: izi });
  assert.equal(darsHolati(null, savol), 'yoq');
  assert.equal(darsHolati(dars('qoralama'), savol), 'qoralama');
  assert.equal(darsHolati(dars('tasdiqlangan'), savol), 'tasdiqlangan');
  assert.equal(darsHolati(dars('tasdiqlangan'), { ...savol, solution: '<p>x = 3</p>' }), 'eskirgan');
  assert.equal(darsHolati(dars('qoralama'), { ...savol, correctAnswer: 'C' }), 'eskirgan');
  assert.deepEqual([...DARS_FILTRI].sort(), ['eskirgan', 'qoralama', 'tasdiqlangan', 'yoq']);
  assert.deepEqual(YECHIM_HOLATI_FILTRI, ['tasdiqlangan', 'qoralama']);
});

test("sonlar so'rovi: qiymatlar tartibi va arxivsiz sharti", () => {
  const s = boshqaSonlarSorovi([1, 2], [10, 11]);
  assert.deepEqual(s.qiymatlar, [[1, 2], [10, 11], 0.7, 0.4]);
  assert.match(s.sql, /"schoolId" = ANY\(\$1::int\[\]\)/);
  assert.match(s.sql, /"bankTopicId" = ANY\(\$2::int\[\]\)/);
  assert.match(s.sql, /"status" <> 'arxiv'/);
  assert.match(s.sql, /"pCorrect" >= \$3/);
  assert.match(s.sql, /"pCorrect" < \$4/);
  // Matnga faqat kodda yozilgan 1/7/30 kunlik oraliqlar kiradi — qolgan hamma qiymat parametr.
  const raqamlar = [...s.sql.replace(/\$\d+/g, '').matchAll(/\d+/g)].map(m => m[0]);
  assert.deepEqual([...new Set(raqamlar)].sort(), ['0', '1', '30', '7']);
  const boshqa = boshqaSonlarSorovi([99, 98], [77, 66]);
  assert.equal(boshqa.sql, s.sql);
});

test("sonlar: bazadagi qator va darslardan yig'iladi, yo'qlari 'yo'q' ga o'tadi", () => {
  const qator = {
    jami: 100, yechimTasdiqlangan: 7, yechimQoralama: 3, ishlatilgan: 40, tarjimali: 5,
    oson: 10, orta: 20, qiyin: 6, yangi1: 2, yangi7: 9, yangi30: 30,
  };
  const darslar = new Map([[1, 'tasdiqlangan'], [2, 'tasdiqlangan'], [3, 'qoralama'], [4, 'eskirgan']]);
  const r = boshqaSonlari(qator, darslar);
  assert.deepEqual(r.yechim, { tasdiqlangan: 7, qoralama: 3 });
  assert.deepEqual(r.dars, { tasdiqlangan: 2, qoralama: 1, eskirgan: 1, yoq: 96 });
  assert.deepEqual(r.ishlatilgan, { bor: 40, yoq: 60 });
  assert.deepEqual(r.tarjimali, { bor: 5, yoq: 95 });
  assert.deepEqual(r.natija, { oson: 10, orta: 20, qiyin: 6, yoq: 64 });
  assert.deepEqual(r.yangi, { 1: 2, 7: 9, 30: 30 });
});

test("sonlar: bo'sh qator va darslarsiz ham buzilmaydi", () => {
  const r = boshqaSonlari({}, new Map());
  assert.equal(r.dars.yoq, 0);
  assert.equal(r.natija.yoq, 0);
  assert.deepEqual(r.ishlatilgan, { bor: 0, yoq: 0 });
});
