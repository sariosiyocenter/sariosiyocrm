// Imtihon modulining bosqich yo'l ko'rsatkichi (lib/imtihonBosqich.js): bazasiz.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSQICHLAR, bosqichHolati, bosqichIndeksi } from '../lib/imtihonBosqich.js';

const holat = (o = {}) => ({ orinlar: 0, keldi: 0, kelmadi: 0, natijalar: 0, shubhali: 0, skanerlanmagan: 0, xabar: 0, ...o });
const imtihon = (o = {}, h = {}) => ({ lockedAt: null, publishedAt: null, holat: holat(h), ...o });
const QULFLANGAN = '2026-10-13T08:00:00.000Z';

test("bosqichlar: 6 ta, tab tartibi bilan; har birida nomi va maqsadi bor", () => {
  assert.deepEqual(BOSQICHLAR.map(b => b.id), ['savollar', 'imtihonlar', 'orin', 'chop', 'skaner', 'natija']);
  for (const b of BOSQICHLAR) { assert.ok(b.nom); assert.ok(b.maqsad.length > 20); }
  assert.equal(bosqichIndeksi('orin'), 2);
  assert.equal(bosqichIndeksi('yo\'q'), -1);
});

test("savollar banki: imtihonga bog'liq emas — holat yo'q, yo'l tushuntiriladi", () => {
  const h = bosqichHolati('savollar', null);
  assert.equal(h.holat, 'bosh');
  assert.match(h.matn, /Andoza/);
});

test("imtihon tanlanmagan: 2–6 bosqichlarda 'imtihonni tanlang'", () => {
  for (const id of ['imtihonlar', 'orin', 'chop', 'skaner', 'natija']) {
    const h = bosqichHolati(id, null);
    assert.equal(h.holat, 'bosh', id);
    assert.match(h.matn, /tanlang/i, id);
  }
});

test("imtihon: qulflanmagan — jarayonda; qulflangan — tayyor", () => {
  assert.equal(bosqichHolati('imtihonlar', imtihon()).holat, 'jarayon');
  assert.equal(bosqichHolati('imtihonlar', imtihon({ lockedAt: QULFLANGAN })).holat, 'tayyor');
});

test("o'rinlashtirish: qulflanmaguncha yopiq (avval — imtihon); keyin o'rinlar soniga qarab", () => {
  const yopiq = bosqichHolati('orin', imtihon());
  assert.equal(yopiq.holat, 'bloklangan');
  assert.equal(yopiq.avval, 'imtihonlar');
  assert.equal(bosqichHolati('orin', imtihon({ lockedAt: QULFLANGAN })).holat, 'jarayon');
  const tayyor = bosqichHolati('orin', imtihon({ lockedAt: QULFLANGAN }, { orinlar: 120 }));
  assert.equal(tayyor.holat, 'tayyor');
  assert.match(tayyor.matn, /120/);
});

test("chop etish: o'rin bo'lmasa — avval o'rinlashtirish; bo'lsa — ochiq", () => {
  assert.equal(bosqichHolati('chop', imtihon()).avval, 'imtihonlar');
  const o = bosqichHolati('chop', imtihon({ lockedAt: QULFLANGAN }));
  assert.equal(o.holat, 'bloklangan');
  assert.equal(o.avval, 'orin');
  const ochiq = bosqichHolati('chop', imtihon({ lockedAt: QULFLANGAN }, { orinlar: 10 }));
  assert.equal(ochiq.holat, 'jarayon');
  assert.equal(ochiq.avval, undefined);
});

test("skaner: shubhali belgi — jarayonda; hammasi skanerlangan va shubhasiz — tayyor", () => {
  const q = { lockedAt: QULFLANGAN };
  assert.equal(bosqichHolati('skaner', imtihon()).holat, 'bloklangan');
  assert.equal(bosqichHolati('skaner', imtihon(q, { orinlar: 50 })).holat, 'jarayon');
  const shubhali = bosqichHolati('skaner', imtihon(q, { orinlar: 50, natijalar: 40, skanerlanmagan: 0, shubhali: 3 }));
  assert.equal(shubhali.holat, 'jarayon');
  assert.match(shubhali.matn, /3/);
  const qolgan = bosqichHolati('skaner', imtihon(q, { orinlar: 50, natijalar: 40, skanerlanmagan: 10 }));
  assert.equal(qolgan.holat, 'jarayon');
  assert.match(qolgan.matn, /40/);
  assert.equal(bosqichHolati('skaner', imtihon(q, { orinlar: 50, natijalar: 50, skanerlanmagan: 0 })).holat, 'tayyor');
});

test("natijalar: natija yo'q — avval skaner; natija bor — e'lon kutadi; e'lon qilingan — tayyor", () => {
  const q = { lockedAt: QULFLANGAN };
  const yoq = bosqichHolati('natija', imtihon(q, { orinlar: 5 }));
  assert.equal(yoq.holat, 'bloklangan');
  assert.equal(yoq.avval, 'skaner');
  const kutadi = bosqichHolati('natija', imtihon(q, { orinlar: 5, natijalar: 5 }));
  assert.equal(kutadi.holat, 'jarayon');
  assert.match(kutadi.matn, /e'lon/i);
  assert.equal(bosqichHolati('natija', imtihon({ ...q, publishedAt: QULFLANGAN }, { natijalar: 5 })).holat, 'tayyor');
});

test("bosqich holati: kutilmagan ma'lumotda ham buzilmaydi", () => {
  assert.equal(bosqichHolati('orin', { lockedAt: QULFLANGAN }).holat, 'jarayon');
  assert.equal(bosqichHolati('noma\'lum', imtihon()).holat, 'bosh');
});
