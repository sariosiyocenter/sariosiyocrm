// Bankdan tasodifiy tanlash (lib/bankTasodifiy.js): bazasiz — `yukla` xotiradagi jadvaldan javob beradi.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { aralashtir, birliklarga, tasodifiyTanla, TASODIFIY_MAX } from '../lib/bankTasodifiy.js';

/** Deterministik "tasodif": 0 dan 1 gacha takrorlanuvchi qatorlar. */
function urugli(urug = 7) {
  let x = urug;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
}

/** Jadval qatori: yaroqli faol savol (aks holda `p` bilan o'zgartiriladi). */
const q = (id, p = {}) => ({ id, type: 'yopiq', passageId: null, status: 'faol', xato: null, bankTopicId: 1, hasAnswers: false, ...p });

/** `yukla`: jadvaldan yakka savollar va matnlarning hamma savolini qaytaradi. */
const yuklovchi = jadval => async ({ idlar, passageIdlar }) => jadval.filter(x => idlar.includes(x.id) || (x.passageId && passageIdlar.includes(x.passageId)));
const nomzodlar = jadval => jadval.map(({ id, type, passageId }) => ({ id, type, passageId }));
const tanla = (jadval, p) => tasodifiyTanla({ nomzodlar: nomzodlar(jadval), yukla: yuklovchi(jadval), tasodif: urugli(), ...p });

test('aralashtir: yangi nusxa, hamma element joyida, asl ro\'yxat o\'zgarmaydi', () => {
  const asl = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = aralashtir(asl, urugli(3));
  assert.deepEqual(asl, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...a].sort((x, y) => x - y), asl);
  assert.notEqual(a, asl);
});

test('yakka savollar: aynan N ta, takrorsiz', async () => {
  const jadval = Array.from({ length: 30 }, (_, i) => q(i + 1));
  const r = await tanla(jadval, { soni: 7 });
  assert.equal(r.soni, 7);
  assert.equal(r.tanlandi.length, 7);
  assert.equal(new Set(r.tanlandi.map(x => x.id)).size, 7);
});

test('yakka savollar: andozada borlari, faol bo\'lmaganlari va chalalari olinmaydi', async () => {
  const jadval = [q(1), q(2), q(3, { status: 'qoralama' }), q(4, { xato: 'Variant yo\'q' }), q(5)];
  const r = await tanla(jadval, { soni: 10, istisno: [1] });
  assert.deepEqual(r.tanlandi.map(x => x.id).sort(), [2, 5]);
  assert.equal(r.soni, 2);
});

test('yetarli savol bo\'lmasa — borini oladi', async () => {
  const r = await tanla([q(1), q(2)], { soni: 5 });
  assert.equal(r.soni, 2);
});

test('N ning chegarasi — TASODIFIY_MAX; 0 yoki noto\'g\'ri son — hech narsa', async () => {
  const jadval = Array.from({ length: TASODIFIY_MAX + 30 }, (_, i) => q(i + 1));
  assert.equal((await tanla(jadval, { soni: 100000 })).soni, TASODIFIY_MAX);
  assert.equal((await tanla(jadval, { soni: 0 })).soni, 0);
  assert.equal((await tanla(jadval, { soni: 'abc' })).soni, 0);
});

test('qismli savol: butunligicha olinadi va bitta savol hisoblanadi', async () => {
  const jadval = [
    q(1, { type: 'qismli', passageId: 10 }), q(2, { type: 'qismli', passageId: 10 }),
    q(3, { type: 'qismli', passageId: 10 }), q(4),
  ];
  const r = await tanla(jadval, { soni: 2 });
  assert.equal(r.soni, 2);
  assert.deepEqual(r.tanlandi.map(x => x.id).sort(), [1, 2, 3, 4]);
});

test('qismli savol: bir qismi faol bo\'lmasa — butun guruh o\'tkazib yuboriladi, boshqasi olinadi', async () => {
  const jadval = [
    q(1, { type: 'qismli', passageId: 10 }), q(2, { type: 'qismli', passageId: 10, status: 'qoralama' }),
    q(3),
  ];
  const r = await tanla(jadval, { soni: 1 });
  assert.deepEqual(r.tanlandi.map(x => x.id), [3]);
});

test('qismli savol: 4 tadan ko\'p qism — olinmaydi; andozada bo\'lagi bor guruh ham', async () => {
  const kop = [1, 2, 3, 4, 5].map(id => q(id, { type: 'qismli', passageId: 10 }));
  assert.equal((await tanla(kop, { soni: 1 })).soni, 0);
  const guruh = [q(1, { type: 'qismli', passageId: 10 }), q(2, { type: 'qismli', passageId: 10 })];
  assert.equal((await tanla(guruh, { soni: 1, istisno: [2] })).soni, 0);
});

test('juft guruh: qismlari butunligicha, har biri alohida hisoblanadi (MS-33-35 — 3 ta)', async () => {
  const jadval = [33, 34, 35].map(id => q(id, { type: 'juft', passageId: 20 }));
  const r = await tanla(jadval, { soni: 3 });
  assert.equal(r.soni, 3);
  assert.deepEqual(r.tanlandi.map(x => x.id).sort(), [33, 34, 35]);
});

test('juft guruh sig\'masa (qoldiq kam) — o\'tkazib yuboriladi', async () => {
  const jadval = [33, 34, 35].map(id => q(id, { type: 'juft', passageId: 20 })).concat([q(1), q(2)]);
  const r = await tanla(jadval, { soni: 2 });
  assert.deepEqual(r.tanlandi.map(x => x.id).sort(), [1, 2]);
});

test('oddiy matn: faqat faol va andozada yo\'q savollari, hammasi birga', async () => {
  const jadval = [
    q(1, { passageId: 30 }), q(2, { passageId: 30 }), q(3, { passageId: 30, status: 'qoralama' }),
    q(4, { passageId: 30 }), q(5, { passageId: 30, xato: 'chala' }),
  ];
  const r = await tanla(jadval, { soni: 10, istisno: [4] });
  assert.deepEqual(r.tanlandi.map(x => x.id).sort(), [1, 2]);
  assert.equal(r.soni, 2);
});

test('natijada yuklangan ma\'lumot bor: turi, matni, mavzusi va javoblari', async () => {
  const jadval = [q(1, { bankTopicId: 9, hasAnswers: true })];
  const r = await tanla(jadval, { soni: 1 });
  assert.equal(r.tanlandi[0].bankTopicId, 9);
  assert.equal(r.tanlandi[0].hasAnswers, true);
  assert.equal(r.tanlandi[0].type, 'yopiq');
});

test('birliklarga: bitta matnning savollari — bitta birlik, andozadagi yakka savol tashlanadi', () => {
  const b = birliklarga([
    { id: 1, type: 'yopiq', passageId: null }, { id: 2, type: 'yopiq', passageId: null },
    { id: 3, type: 'qismli', passageId: 5 }, { id: 4, type: 'qismli', passageId: 5 },
  ], new Set([2]));
  assert.deepEqual(b, [{ id: 1 }, { pa: 5, guruhli: true, turi: 'qismli' }]);
});

test('paketlab yuklash: ko\'p nomzodda ham N ta topiladi', async () => {
  const jadval = [...Array.from({ length: 100 }, (_, i) => q(i + 1, { status: 'qoralama' })), q(101), q(102), q(103)];
  const r = await tanla(jadval, { soni: 3, paket: 7 });
  assert.deepEqual(r.tanlandi.map(x => x.id).sort(), [101, 102, 103]);
});
