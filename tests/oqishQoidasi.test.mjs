// Skaner o'qish qoidalari (Addmen «Reading rules», 2026-11-02): sezgirlik, bir nechta belgi va xira
// belgi qarori; takroriy ID (boshqa varaq bir o'ringa tushishi) aniqlash.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { sozlamaniTozala, takrorFarqi, QULFDAN_KEYIN_OZGARADI } from '../lib/imtihon.js';
import { yopiqQarori } from '../src/lib/omr/reader.ts';

const Q = (o = {}) => ({ sezgirlik: 'orta', kopBelgi: 'shubha', xira: 'shubha', ...o });

test('standart qoida: avvalgi xatti-harakat saqlanadi', () => {
  assert.deepEqual(yopiqQarori([0.95, 0, 0, 0]), { j: 0 });
  assert.deepEqual(yopiqQarori([0, 0.02, 0.05, 0]), { j: '' });
  assert.deepEqual(yopiqQarori([0.9, 0.85, 0, 0]), { j: '*', sabab: "Bir nechta doira bo'yalgan" });
  // To'liq + o'chirilgan belgi — to'lgani taklif, lekin operatorga.
  assert.deepEqual(yopiqQarori([0.92, 0.3, 0, 0]), { j: 0, sabab: 'Noaniq belgi' });
  assert.deepEqual(yopiqQarori([0, 0, 0.35, 0]), { j: 2, sabab: 'Noaniq belgi' });
});

test("bir nechta belgi: noto'g'ri — shubhasiz '*'", () => {
  assert.deepEqual(yopiqQarori([0.9, 0.85, 0, 0], Q({ kopBelgi: 'notogri' })), { j: '*' });
});

test('bir nechta belgi: aniq qoraroq bo\'lsa — o\'sha, yaqin bo\'lsa operatorga', () => {
  assert.deepEqual(yopiqQarori([0.98, 0.62, 0, 0], Q({ kopBelgi: 'qorasi' })), { j: 0 });
  assert.equal(yopiqQarori([0.9, 0.8, 0, 0], Q({ kopBelgi: 'qorasi' })).sabab, "Bir nechta doira bo'yalgan");
});

test("xira belgi: eng qorasi aniq ajralsa — javob, bo'lmasa operatorga", () => {
  assert.deepEqual(yopiqQarori([0.92, 0.3, 0, 0], Q({ xira: 'qorasi' })), { j: 0 });
  assert.deepEqual(yopiqQarori([0, 0.45, 0, 0], Q({ xira: 'qorasi' })), { j: 1 });
  assert.equal(yopiqQarori([0.4, 0.3, 0, 0], Q({ xira: 'qorasi' })).sabab, 'Noaniq belgi');
});

test('sezgirlik chegarani suradi', () => {
  assert.deepEqual(yopiqQarori([0.55, 0, 0, 0], Q({ sezgirlik: 'yuqori' })), { j: 0 });
  assert.equal(yopiqQarori([0.55, 0, 0, 0], Q()).sabab, 'Noaniq belgi');
  assert.equal(yopiqQarori([0.65, 0, 0, 0], Q({ sezgirlik: 'past' })).sabab, 'Noaniq belgi');
  // Past sezgirlikda qalam izi (0.18) bo'sh hisoblanadi.
  assert.deepEqual(yopiqQarori([0.18, 0, 0, 0], Q({ sezgirlik: 'past' })), { j: '' });
});

test('sozlama: oqishQoidasi tozalanadi va qulfdan keyin ham o\'zgaradi', () => {
  assert.deepEqual(sozlamaniTozala({}).oqishQoidasi, { sezgirlik: 'orta', kopBelgi: 'shubha', xira: 'shubha' });
  assert.deepEqual(sozlamaniTozala({ oqishQoidasi: { sezgirlik: 'yuqori', kopBelgi: 'qorasi', xira: 'nimadir' } }).oqishQoidasi,
    { sezgirlik: 'yuqori', kopBelgi: 'qorasi', xira: 'shubha' });
  assert.ok(QULFDAN_KEYIN_OZGARADI.includes('oqishQoidasi'));
});

test('takrorFarqi: qayta skanerlangan o\'sha varaq — takror emas, boshqa varaq — takror', () => {
  const eski = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A', 6: '', 7: 'B', 8: 'C' };
  assert.equal(takrorFarqi(eski, { ...eski }).boshqa, false);
  // Bitta xira belgi boshqacha o'qilgan — baribir o'sha varaq.
  assert.equal(takrorFarqi(eski, { ...eski, 3: '*' }).boshqa, false);
  const boshqa = { 1: 'B', 2: 'C', 3: 'C', 4: 'A', 5: 'D', 6: 'A', 7: 'B', 8: 'D' };
  const f = takrorFarqi(eski, boshqa);
  assert.equal(f.boshqa, true);
  assert.equal(f.jami, 8);
  assert.equal(f.soni, 6);
  // Savol kam bo'lsa (5 dan oz) qaror qilinmaydi.
  assert.equal(takrorFarqi({ 1: 'A', 2: 'B' }, { 1: 'C', 2: 'D' }).boshqa, false);
  assert.equal(takrorFarqi(null, { 1: 'A' }).boshqa, false);
});
