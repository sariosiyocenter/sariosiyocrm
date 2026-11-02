// Aralashmaydigan bo'lim (Addmen «lock section from shuffling», 2026-11-02): sozlamada
// qotirBloklar — shu fanlarning savollari hamma variantda bir xil tartibda (oson → qiyin),
// boshqa fanlar odatdagidek aralashadi.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { sozlamaniTozala, variantlarniYasash } from '../lib/imtihon.js';

let id = 500;
const savollar = (subject, n) => Array.from({ length: n }, (_, i) => ({
  id: id++, subject, topic: 'Umumiy', difficulty: 2, type: 'yopiq', status: 'faol', language: 'uz',
  text: `${subject} savol ${i}`, options: ['1', '2', '3', '4'], correctAnswer: 'A', usedCount: 0,
}));
const bank = [...savollar('Matematika', 12), ...savollar('Fizika', 12)];
const bloklar = ['Matematika', 'Fizika'].map((subject, i) => ({
  id: `b${i}`, subject, pointsPerQuestion: 1, topicRules: [{ topic: 'Umumiy', difficulty: 2, type: 'yopiq', count: 10 }],
}));
const yasa = qotirBloklar => variantlarniYasash({ blocks: bloklar, settings: { variantCount: 4, shuffleQuestions: true, qotirBloklar }, seed: 7, bank });
const blokTartibi = (v, b) => v.items.filter(it => it.b === b).map(it => it.q).join(',');

test("qotirBloklar tozalanadi: butun, manfiy emas, takrorsiz va tartiblangan", () => {
  assert.deepEqual(sozlamaniTozala({}).qotirBloklar, []);
  assert.deepEqual(sozlamaniTozala({ qotirBloklar: [2, '0', 2, -1, 'x', 1.5] }).qotirBloklar, [0, 2]);
});

test("qotirilgan fan hamma variantda bir xil tartibda, boshqasi aralashadi", () => {
  const r = yasa([0]);
  assert.equal(r.kamchiliklar.length, 0);
  assert.equal(new Set(r.variants.map(v => blokTartibi(v, 0))).size, 1, 'Matematika tartibi bir xil');
  assert.ok(new Set(r.variants.map(v => blokTartibi(v, 1))).size > 1, 'Fizika aralashgan');
});

test("qotirilmasa — ikkala fan ham aralashadi", () => {
  const r = yasa([]);
  assert.ok(new Set(r.variants.map(v => blokTartibi(v, 0))).size > 1);
  assert.ok(new Set(r.variants.map(v => blokTartibi(v, 1))).size > 1);
});
