// Oylik daftari (2026-11-02): hisoblangan oylik, berilgan pul, qoldiq qarz va avans.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { oylikDaftari, taqsimla, oyQosh, AVVALGI_OY } from '../lib/oylikDaftar.js';

const hisob = (month, amount, extra = {}) => ({ id: month.length, month, baseSalary: amount, kpi: 0, bonuses: 0, fines: 0, amount, ...extra });
let n = 0;
const tolov = (amount, paidAt, extra = {}) => ({ id: ++n, month: null, amount, paidAt: new Date(paidAt), ...extra });
const oy = (d, m) => d.oylar.find(o => o.month === m);

test("qisman berilgan oy: 10 mln dan 5 mln berildi — 5 mln qarz qoladi", () => {
  const d = oylikDaftari({ hisoblar: [hisob('2026-10', 10_000_000)], tolovlar: [tolov(5_000_000, '2026-11-01')], joriyOy: '2026-11' });
  assert.equal(oy(d, '2026-10').berilgan, 5_000_000);
  assert.equal(oy(d, '2026-10').qoldiq, 5_000_000);
  assert.equal(d.yopiqQarz, 5_000_000);
  assert.equal(d.avans, 0);
  assert.equal(d.engEski, '2026-10');
});

test("joriy oy hali yopilmagan — ro'yxatda ochiq bo'lib turadi, qarzga qo'shilmaydi", () => {
  const d = oylikDaftari({ hisoblar: [hisob('2026-10', 10_000_000)], tolovlar: [], joriyOy: '2026-11' });
  const noyabr = oy(d, '2026-11');
  assert.equal(noyabr.yopiq, false);
  assert.equal(d.yopiqQarz, 10_000_000);
});

test("pul eng eski qarzni birinchi yopadi", () => {
  const d = oylikDaftari({
    hisoblar: [hisob('2026-09', 9_000_000), hisob('2026-10', 10_000_000)],
    tolovlar: [tolov(12_000_000, '2026-11-01')], joriyOy: '2026-11',
  });
  assert.equal(oy(d, '2026-09').qoldiq, 0);
  assert.equal(oy(d, '2026-10').berilgan, 3_000_000);
  assert.equal(oy(d, '2026-10').qoldiq, 7_000_000);
  assert.deepEqual(d.tolovlar[0].taqsim, [{ month: '2026-09', summa: 9_000_000 }, { month: '2026-10', summa: 3_000_000 }]);
});

test("ortiqcha berilgan pul — avans; oy yopilganda o'sha oyga tushadi", () => {
  const avval = oylikDaftari({ hisoblar: [hisob('2026-10', 10_000_000)], tolovlar: [tolov(12_000_000, '2026-11-01')], joriyOy: '2026-11' });
  assert.equal(avval.yopiqQarz, 0);
  assert.equal(avval.avans, 2_000_000);
  const keyin = oylikDaftari({ hisoblar: [hisob('2026-10', 10_000_000), hisob('2026-11', 8_000_000)], tolovlar: [tolov(12_000_000, '2026-11-01')], joriyOy: '2026-11' });
  assert.equal(keyin.avans, 0);
  assert.equal(oy(keyin, '2026-11').berilgan, 2_000_000);
  assert.equal(keyin.yopiqQarz, 6_000_000);
});

test("eski yozuv (oy bilan berilgan to'lov) — o'sha oy yopilgan va to'liq to'langan hisoblanadi", () => {
  const eski = tolov(9_500_000, '2026-10-04', { month: '2026-09', baseSalary: 3_000_000, bonuses: 200_000, fines: 0 });
  const d = oylikDaftari({ hisoblar: [], tolovlar: [eski], joriyOy: '2026-11' });
  const sen = oy(d, '2026-09');
  assert.equal(sen.yopiq, true);
  assert.equal(sen.eski, true);
  assert.equal(sen.amount, 9_500_000);
  assert.equal(sen.kpi, 6_300_000);
  assert.equal(sen.qoldiq, 0);
  assert.equal(d.yopiqQarz, 0);
  // Sentyabrdan beri yopilmagan oktabr ochiq ko'rinadi — unutilib qolmaydi.
  assert.equal(oy(d, '2026-10').yopiq, false);
});

test("eski oyga haqiqiy hisob kiritilsa — u eski yozuvdan ustun", () => {
  const eski = tolov(5_000_000, '2026-10-04', { month: '2026-09', baseSalary: 5_000_000 });
  const d = oylikDaftari({ hisoblar: [hisob('2026-09', 10_000_000)], tolovlar: [eski], joriyOy: '2026-09' });
  assert.equal(oy(d, '2026-09').eski, undefined);
  assert.equal(d.yopiqQarz, 5_000_000);
});

test("eski to'lov o'z oyiga tushadi — keyin kiritilgan avvalgi qarz uni tortib olmaydi", () => {
  const eski = tolov(9_000_000, '2026-10-04', { month: '2026-09', baseSalary: 9_000_000 });
  const d = oylikDaftari({ hisoblar: [hisob(AVVALGI_OY, 4_000_000)], tolovlar: [eski], joriyOy: '2026-09' });
  assert.equal(oy(d, '2026-09').qoldiq, 0);
  assert.equal(oy(d, AVVALGI_OY).qoldiq, 4_000_000);
  assert.equal(d.engEski, AVVALGI_OY);
});

test("avvalgi qarz ro'yxat boshida va birinchi yopiladi", () => {
  const d = oylikDaftari({
    hisoblar: [hisob('2026-10', 10_000_000), hisob(AVVALGI_OY, 4_000_000)],
    tolovlar: [tolov(6_000_000, '2026-11-01')], joriyOy: '2026-10',
  });
  assert.equal(d.oylar[0].month, AVVALGI_OY);
  assert.equal(oy(d, AVVALGI_OY).qoldiq, 0);
  assert.equal(oy(d, '2026-10').qoldiq, 8_000_000);
});

test("to'lovlar sana tartibida taqsimlanadi, kiritilish tartibida emas", () => {
  const a = tolov(3_000_000, '2026-11-20');
  const b = tolov(4_000_000, '2026-11-05');
  const d = oylikDaftari({ hisoblar: [hisob('2026-09', 4_000_000), hisob('2026-10', 10_000_000)], tolovlar: [a, b], joriyOy: '2026-11' });
  const bT = d.tolovlar.find(t => t.id === b.id);
  assert.deepEqual(bT.taqsim, [{ month: '2026-09', summa: 4_000_000 }]);
});

test("taqsimla — oldindan ko'rish: qaysi oyga qancha va qolgani avans", () => {
  const d = oylikDaftari({ hisoblar: [hisob('2026-10', 10_000_000)], tolovlar: [tolov(5_000_000, '2026-11-01')], joriyOy: '2026-11' });
  assert.deepEqual(taqsimla(d, 7_000_000), { qismlar: [{ month: '2026-10', summa: 5_000_000, keyin: 0 }], avans: 2_000_000 });
  assert.deepEqual(taqsimla(d, 3_000_000), { qismlar: [{ month: '2026-10', summa: 3_000_000, keyin: 2_000_000 }], avans: 0 });
});

test("hisobsiz va to'lovsiz xodim — faqat joriy oy, qarz yo'q", () => {
  const d = oylikDaftari({ hisoblar: [], tolovlar: [], joriyOy: '2026-11' });
  assert.deepEqual(d.oylar.map(o => o.month), ['2026-11']);
  assert.equal(d.yopiqQarz, 0);
  assert.equal(d.engEski, null);
});

test("oyQosh yil chegarasidan o'tadi", () => {
  assert.equal(oyQosh('2026-12', 1), '2027-01');
  assert.equal(oyQosh('2026-01', -1), '2025-12');
});
