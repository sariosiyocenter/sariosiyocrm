// Bankdagi kichik mavzu (2026-11-05): bo'lim → mavzu → kichik mavzu.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mavzuTartibi, kichiklariBilan } from '../lib/mavzuDaraxti.js';

const m = (id, order, parentId = null) => ({ id, order, parentId });

test("kichik mavzu otasidan keyin turadi, o'z tartibida", () => {
  const l = mavzuTartibi([m(1, 1), m(2, 2), m(3, 3, 1), m(4, 4), m(5, 5, 1)]);
  assert.deepEqual(l.map(t => t.id), [1, 3, 5, 2, 4]);
});

test("ota keyinroq yaratilgan bo'lsa ham — bolasi uning ortidan", () => {
  const l = mavzuTartibi([m(10, 1, 20), m(20, 2), m(30, 3)]);
  assert.deepEqual(l.map(t => t.id), [20, 10, 30]);
});

test("otasi ro'yxatda yo'q kichik mavzu — oddiy mavzu kabi o'z o'rnida", () => {
  const l = mavzuTartibi([m(1, 1), m(2, 2, 99), m(3, 3)]);
  assert.deepEqual(l.map(t => t.id), [1, 2, 3]);
});

test("nabira yoki aylana (bir vaqtdagi ko'chirishdan) — hech bir mavzu yo'qolmaydi", () => {
  const nabira = mavzuTartibi([m(1, 1), m(2, 2, 1), m(3, 3, 2)]);
  assert.deepEqual(nabira.map(t => t.id), [1, 2, 3]);
  const aylana = mavzuTartibi([m(1, 1, 2), m(2, 2, 1), m(3, 3)]);
  assert.deepEqual(aylana.map(t => t.id).sort(), [1, 2, 3]);
});

test("parentId yo'q eski mavzular — tartib o'zgarmaydi", () => {
  const eski = [{ id: 3, order: 2 }, { id: 1, order: 1 }, { id: 2, order: 1 }];
  assert.deepEqual(mavzuTartibi(eski).map(t => t.id), [1, 2, 3]);
});

test('ota tanlansa — kichik mavzulari ham; kichik mavzu tanlansa — faqat o\'zi', () => {
  const l = [m(1, 1), m(2, 2, 1), m(3, 3, 1), m(4, 4)];
  assert.deepEqual(kichiklariBilan(l, [1]).map(t => t.id), [1, 2, 3]);
  assert.deepEqual(kichiklariBilan(l, [2]).map(t => t.id), [2]);
  assert.deepEqual(kichiklariBilan(l, [4]).map(t => t.id), [4]);
});
