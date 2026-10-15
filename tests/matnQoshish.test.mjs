// Ovozli matnni maydonga qo'shish (lib/matnQoshish.js).
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { matnQoshish } from '../lib/matnQoshish.js';

test('yozilgan matn o\'chmaydi: yangi matn bo\'sh joy bilan oxiriga qo\'shiladi', () => {
  assert.equal(matnQoshish('Kasrlar haqida', '6-sinf uchun'), 'Kasrlar haqida 6-sinf uchun');
  assert.equal(matnQoshish('  Kasrlar  ', ' 6-sinf '), 'Kasrlar 6-sinf');
});

test('maydon bo\'sh bo\'lsa — faqat yangi matn', () => {
  assert.equal(matnQoshish('', 'Soddaroq tilda'), 'Soddaroq tilda');
  assert.equal(matnQoshish(undefined, 'Soddaroq tilda'), 'Soddaroq tilda');
});

test('bo\'sh yangi matn — maydon o\'zgarmaydi', () => {
  assert.equal(matnQoshish('Yozilgan  ', '   '), 'Yozilgan  ');
  assert.equal(matnQoshish('Yozilgan', null), 'Yozilgan');
});

test('chegaradan oshsa — oxiri kesiladi, avvalgi matn saqlanadi', () => {
  assert.equal(matnQoshish('abc', 'defgh', 6), 'abc de');
  assert.equal(matnQoshish('abc', 'def').length, 7);
});
