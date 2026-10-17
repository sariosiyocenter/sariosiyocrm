// Imtihon sozlamalari o'z bosqichida (2026-10-17): o'tkazish sozlamalari (onlayn, smenalar,
// o'rinlar) va natija sozlamalari qulfdan keyin o'z tablarida o'zgaradi; «Qog'oz / Onlayn /
// Ikkalasi» — onlayn.yoqilgan va onlayn.faqat dan.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { sozlamaniTozala, QULFDAN_KEYIN_OZGARADI, topshirishTuri, topshirishOnlayn, filiallarniBirlashtir } from '../lib/imtihon.js';
import { imtihonSozlamaTozala } from '../lib/imtihonSozlama.js';

test("onlayn.faqat — standart yo'q, faqat boolean qabul qilinadi", () => {
  assert.equal(sozlamaniTozala({}).onlayn.faqat, false);
  assert.equal(sozlamaniTozala({ onlayn: { yoqilgan: true, faqat: 'ha' } }).onlayn.faqat, false);
  assert.equal(sozlamaniTozala({ onlayn: { yoqilgan: true, faqat: true } }).onlayn.faqat, true);
});

test("onlayn o'chiq bo'lsa «faqat onlayn» bo'lolmaydi", () => {
  assert.equal(sozlamaniTozala({ onlayn: { yoqilgan: false, faqat: true } }).onlayn.faqat, false);
});

test("topshirish turi onlayn sozlamasidan", () => {
  assert.equal(topshirishTuri({ yoqilgan: false, faqat: false }), 'qogoz');
  assert.equal(topshirishTuri({ yoqilgan: true, faqat: false }), 'ikkalasi');
  assert.equal(topshirishTuri({ yoqilgan: true, faqat: true }), 'onlayn');
  assert.equal(topshirishTuri(undefined), 'qogoz');
});

test("topshirish turi tanlansa — vaqtlar saqlanib, yoqilgan va faqat almashadi", () => {
  const eski = { yoqilgan: false, faqat: false, ochiladi: '2026-10-25T09:00', yopiladi: '', daqiqa: 90 };
  assert.deepEqual(topshirishOnlayn('onlayn', eski), { ...eski, yoqilgan: true, faqat: true });
  assert.deepEqual(topshirishOnlayn('ikkalasi', eski), { ...eski, yoqilgan: true, faqat: false });
  assert.deepEqual(topshirishOnlayn('qogoz', { ...eski, yoqilgan: true, faqat: true }), { ...eski, yoqilgan: false, faqat: false });
});

test("qulfdan keyin o'tkazish va natija sozlamalari o'zgaradi, tuzilmaniki — yo'q", () => {
  for (const k of ['onlayn', 'seatMode', 'sessionFill', 'roomIds', 'admit', 'notify', 'otish', 'ranking', 'topN', 'orinUsuli', 'rasch', 'showQuestionsAfter']) {
    assert.ok(QULFDAN_KEYIN_OZGARADI.includes(k), k);
  }
  for (const k of ['variantCount', 'sessionQuestions', 'shuffleQuestions', 'shuffleOptions', 'xatoJarima', 'language', 'source']) {
    assert.ok(!QULFDAN_KEYIN_OZGARADI.includes(k), k);
  }
});

test("filiallar: foydalanuvchi ko'rmaydigan filial ro'yxatdan tushib qolmaydi", () => {
  // Menejer faqat 1 va 2 ni ko'radi; imtihonda 2 va 5 bor; u 3 ni qo'shmoqchi (ruxsati yo'q) va 2 ni olib tashlaydi.
  const r = filiallarniBirlashtir({ eski: [2, 5], kelgan: [3], ruxsat: [1, 2] });
  assert.deepEqual(r.yangi, [5]);
  assert.deepEqual(r.olibTashlangan, [2]);
});

test("filiallar: qo'shilgani va takrorlari", () => {
  const r = filiallarniBirlashtir({ eski: [], kelgan: ['4', 4, 7], ruxsat: [4, 7] });
  assert.deepEqual(r.yangi, [4, 7]);
  assert.deepEqual(r.olibTashlangan, []);
});

test("markaz standarti: smenalarga bo'lish va topshirish turi bor, onlayn vaqtlari yo'q", () => {
  const { yangi } = imtihonSozlamaTozala({
    yangi: { settings: { sessionFill: 'kurs', onlayn: { yoqilgan: true, faqat: true, ochiladi: '2026-10-25T09:00', yopiladi: '2026-10-25T21:00', daqiqa: 90 } } },
  });
  assert.equal(yangi.settings.sessionFill, 'kurs');
  assert.deepEqual(yangi.settings.onlayn, { yoqilgan: true, faqat: true, ochiladi: '', yopiladi: '', daqiqa: 90 });
});
