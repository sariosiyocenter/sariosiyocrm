// Ko'chirish oyining puli ikki kurs orasida (lib/kochirish.js): eski kursning
// o'tilmagan darslari puli yangi kursga o'tadi, balans o'zgarmaydi.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { kochirishUlushi } from '../lib/kochirish.js';

// 2026-yil oktabr, toq kunlar (du/chor/ju): 13 dars. 14.10 dan oxirigacha —
// 14, 16, 19, 21, 23, 26, 28, 30 — 8 dars.
const TOQ_OKTABR = { days: 'TOQ', month: '2026-10' };

test("o'tilmagan darslar puli: 500 000 / 13 × 8", () => {
  const r = kochirishUlushi({ ...TOQ_OKTABR, yozilgan: 500000, sana: '2026-10-14' });
  assert.equal(r.summa, 307692);
  assert.equal(r.darslar, 8);
  assert.equal(r.oyDarslari, 13);
});

test("oy boshida ko'chsa — butun oy yangi kursga o'tadi", () => {
  const r = kochirishUlushi({ ...TOQ_OKTABR, yozilgan: 500000, sana: '2026-10-01' });
  assert.equal(r.summa, 500000);
  assert.equal(r.darslar, 13);
});

test("chegirmali hisob — o'tilgan darslar puli yangi kursga o'tmaydi (8/13 ulush)", () => {
  // 500 000 dan 250 000 chegirma: sof 250 000. Yalpi narxdan sanalsa 250 000 to'liq o'tardi.
  const r = kochirishUlushi({ ...TOQ_OKTABR, yozilgan: 250000, sana: '2026-10-14' });
  assert.equal(r.summa, 153846);
});

test("oy o'rtasida kelgan — ulush kelgan kundan sanaladi", () => {
  // 12.10 dan hisob: 12, 14, 16, 19, 21, 23, 26, 28, 30 — 9 dars, 346 154 so'm.
  const r = kochirishUlushi({ ...TOQ_OKTABR, yozilgan: 346154, sana: '2026-10-14', boshi: '2026-10-12' });
  assert.equal(r.darslar, 8);
  assert.equal(r.oyDarslari, 9);
  assert.equal(r.summa, 307692);
});

test("eski kursga bu oy hisob yozilmagan bo'lsa — hech narsa o'tmaydi", () => {
  assert.equal(kochirishUlushi({ ...TOQ_OKTABR, yozilgan: 0, sana: '2026-10-14' }).summa, 0);
  assert.equal(kochirishUlushi({ ...TOQ_OKTABR, yozilgan: -100, sana: '2026-10-14' }).summa, 0);
});

test("eski kursning jadvali yo'q — summa taxmin qilinmaydi", () => {
  const r = kochirishUlushi({ ...TOQ_OKTABR, days: 'Belgilanmagan', yozilgan: 500000, sana: '2026-10-14' });
  assert.equal(r.summa, 0);
  assert.equal(r.sabab, 'jadval');
});

test("oyning oxirgi darsidan keyin ko'chsa — o'tadigan pul yo'q", () => {
  const r = kochirishUlushi({ ...TOQ_OKTABR, yozilgan: 500000, sana: '2026-10-31' });
  assert.equal(r.summa, 0);
  assert.equal(r.darslar, 0);
});
