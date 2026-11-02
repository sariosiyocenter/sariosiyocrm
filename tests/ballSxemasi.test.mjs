// Ball sxemalari (2026-11-01, Addmen «Scoring schemes»): varaq raqamiga to'g'ri/xato/bo'sh bali.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { natijaniHisobla, sozlamaniTozala } from '../lib/imtihon.js';

const it = (n, k, p = 1) => ({ n, q: 100 + n, b: 0, t: 'yopiq', p, k, m: [0, 1, 2, 3] });
const items = [it(1, 0), it(2, 1), it(3, 2), it(4, 3)];
const blocks = [{ subject: 'Matematika' }];
// 1 — to'g'ri (A), 2 — xato, 3 — bo'sh, 4 — to'g'ri (D)
const javoblar = { 1: 'A', 2: 'C', 3: '', 4: 'D' };

test("sxemasiz — avvalgidek: to'g'riga savol bali", () => {
  const r = natijaniHisobla({ items, javoblar, blocks, settings: {} });
  assert.equal(r.ball, 2);
  assert.equal(r.maks, 4);
});

test("DTM sxemasi 3,1 / 0 / 0 — to'g'ri javob 3,1 ball, maksimum ham shundan", () => {
  const sx = { togri: 3.1, xato: 0, bosh: 0 };
  const r = natijaniHisobla({ items, javoblar, blocks, settings: { ballSxemalari: { 1: sx, 2: sx, 3: sx, 4: sx } } });
  assert.equal(r.ball, 6.2);
  assert.equal(r.maks, 12.4);
});

test("manfiy sxema +1 / −0,25 / 0 — faqat qo'yilgan savollarga", () => {
  const r = natijaniHisobla({ items, javoblar, blocks, settings: { ballSxemalari: { 2: { togri: 1, xato: -0.25, bosh: 0 } }, jarimaNoldan: false } });
  assert.equal(r.ball, 1.75);
  assert.equal(r.maks, 4);
});

test("bekor qilingan savolga (hammaga) sxemaning to'g'ri bali", () => {
  const r = natijaniHisobla({ items, javoblar, blocks, settings: { cancelled: { 102: 'hammaga' }, ballSxemalari: { 2: { togri: 2, xato: 0, bosh: 0 } } } });
  assert.equal(r.ball, 4);
  assert.equal(r.maks, 5);
});

test("tozalash: noto'g'ri kalit va qiymatlar tashlanadi, nom qoladi", () => {
  const s = sozlamaniTozala({ ballSxemalari: { 1: { togri: '3.1', xato: -0.5, bosh: 0, nom: 'DTM 1-fan' }, abc: { togri: 1 }, 2: 'x' } });
  assert.deepEqual(s.ballSxemalari, { 1: { togri: 3.1, xato: -0.5, bosh: 0, nom: 'DTM 1-fan' } });
});

// Savollar tahlili: kuchli/kuchsiz 27% va point-biserial (2026-11-01).
import { savolTahlili } from '../lib/imtihon.js';
test("savolTahlili: kuchlilar topgan savolda korrelyatsiya musbat, kuchsizlar topganida — manfiy", () => {
  const variants = [{ session: 1, code: 'A', items: [{ n: 1, q: 11, t: 'yopiq', b: 0, m: [0, 1, 2, 3] }, { n: 2, q: 12, t: 'yopiq', b: 0, m: [0, 1, 2, 3] }] }];
  const natija = (id, score, h1, h2) => ({ id, score, session: 1, variantCode: 'A', detail: [{ n: 1, holat: h1, javob: 'A' }, { n: 2, holat: h2, javob: 'B' }] });
  const natijalar = [natija(1, 10, 'togri', 'xato'), natija(2, 9, 'togri', 'xato'), natija(3, 8, 'togri', 'xato'), natija(4, 3, 'xato', 'togri'), natija(5, 2, 'xato', 'togri'), natija(6, 1, 'xato', 'togri')];
  const t = new Map(savolTahlili({ variants, natijalar }).map(x => [x.q, x]));
  assert.ok(t.get(11).pbis > 0.8);
  assert.ok(t.get(12).pbis < -0.8);
  assert.equal(t.get(11).yuqoriFoiz, 1);
  assert.equal(t.get(11).quyiFoiz, 0);
});

// Murakkab qoidalar (2026-11-02): bog'lash, og'irlik, o'lchangan ball, bo'lim o'tish bali.
import { otishHolati, olchanganBall } from '../lib/imtihon.js';
test("bog'lash: 4-savol faqat 3-savol to'g'ri bo'lsa hisoblanadi", () => {
  const r = natijaniHisobla({ items, javoblar, blocks, settings: { boglanish: { 4: '3' } } });
  // 3 — bo'sh, shuning uchun 4-savol (to'g'ri) bali olib tashlanadi: 1 + 0
  assert.equal(r.ball, 1);
  assert.equal(r.detail.find(d => d.n === 4).holat, 'boglangan');
  const r2 = natijaniHisobla({ items, javoblar, blocks, settings: { boglanish: { 4: '1' } } });
  assert.equal(r2.ball, 2);
});
test("javob og'irligi: tanlangan javob bali, maksimum — eng katta og'irlik", () => {
  const r = natijaniHisobla({ items: [it(1, 0)], javoblar: { 1: 'C' }, blocks, settings: { javobOgirligi: { 1: [4, 3, 2, 1] } } });
  assert.equal(r.ball, 2);
  assert.equal(r.maks, 4);
});
test("o'lchangan ball: jadval oralig'ida chiziqli", () => {
  const s = { olchangan: [[0, 200], [40, 760], [44, 800]] };
  assert.equal(olchanganBall(s, 44), 800);
  assert.equal(olchanganBall(s, 20), 480);
  assert.equal(olchanganBall({}, 20), null);
});
test("bo'lim o'tish bali: umumiy o'tgan bo'lsa ham bo'limda past — o'tmadi", () => {
  const s = { otish: { turi: 'foiz', qiymat: 50 }, bolimOtish: { 1: 40 } };
  assert.equal(otishHolati(s, 30, 60, [{ earned: 20, max: 20 }, { earned: 2, max: 10 }]), false);
  assert.equal(otishHolati(s, 30, 60, [{ earned: 20, max: 20 }, { earned: 5, max: 10 }]), true);
});
