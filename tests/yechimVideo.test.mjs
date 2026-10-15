// Yechim + video yechimni birga yaratish (lib/yechimVideo.js): bosqichlar, AI yechimini ustoz ko'rmay
// saqlash qoidasi, yagona natija xabari va «eskirgan» mantig'i (yangi yechim → yangi video yechim izi).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bosqichMatni, bosqichlar, natijaXabari, yechimOzTasdiqlansinmi, yechimTekshirishKerakmi,
} from '../lib/yechimVideo.js';
import { darsEskirganmi, darsHolati, yechimIzi } from '../lib/imtihonDars.js';

const MOS = { yechim: '<p>x = 3</p>', aiJavobi: '3', mos: true, kalit: '3', izoh: '', rasmKerak: false, rasm: { jami: 0, berildi: 0 } };

test('bosqichlar: yechim yozilsa 3 ta (yechim, video, ovoz), yozilmasa 2 ta; ovozsiz — ovoz tushadi', () => {
  assert.deepEqual(bosqichlar({ yechim: true }), ['yechim', 'video', 'ovoz']);
  assert.deepEqual(bosqichlar({ yechim: false }), ['video', 'ovoz']);
  assert.deepEqual(bosqichlar({ yechim: true, ovoz: false }), ['yechim', 'video']);
  assert.deepEqual(bosqichlar(), ['video', 'ovoz']);
});

test('bosqichMatni: "n/jami" hisobi bosqichlar soniga mos', () => {
  assert.match(bosqichMatni('yechim', { yechim: true }), /^1\/3 · AI yechimni/);
  assert.match(bosqichMatni('video', { yechim: true }), /^2\/3 · AI video yechimni/);
  assert.match(bosqichMatni('ovoz', { yechim: true }), /^3\/3 · Ovoz/);
  assert.match(bosqichMatni('video'), /^1\/2 · /);
  assert.match(bosqichMatni('ovoz'), /^2\/2 · /);
  assert.equal(bosqichMatni('nomalum'), '');
  // Ro'yxatda yo'q bosqich (masalan ovoz o'chirilgan) — raqamsiz matn.
  assert.doesNotMatch(bosqichMatni('ovoz', { ovoz: false }), /^\d\//);
});

test("AI yechimi: javob mos yoki solishtirib bo'lmasa — ustoz ko'rmay saqlanadi; mos emas yoki rasm ko'rinmasa — yo'q", () => {
  assert.equal(yechimTekshirishKerakmi(MOS), false);
  assert.equal(yechimTekshirishKerakmi({ ...MOS, mos: null }), false); // yozma savol: qoralama bo'lib saqlanadi
  assert.equal(yechimTekshirishKerakmi({ ...MOS, mos: false }), true);
  assert.equal(yechimTekshirishKerakmi({ ...MOS, rasmKerak: true }), true);
  assert.equal(yechimTekshirishKerakmi({ ...MOS, rasm: { jami: 2, berildi: 1 } }), true);
  assert.equal(yechimTekshirishKerakmi({ ...MOS, rasm: { jami: 2, berildi: 2 } }), false);
  assert.equal(yechimTekshirishKerakmi(null), true);
});

test("yechim o'zi tasdiqlanadi faqat javob aniq mos chiqqanda; mos=null — qoralama", () => {
  assert.equal(yechimOzTasdiqlansinmi(MOS), true);
  assert.equal(yechimOzTasdiqlansinmi({ ...MOS, mos: null }), false);
  assert.equal(yechimOzTasdiqlansinmi({ ...MOS, mos: false }), false);
  assert.equal(yechimOzTasdiqlansinmi({ ...MOS, rasm: { jami: 1, berildi: 0 } }), false);
  assert.equal(yechimOzTasdiqlansinmi(undefined), false);
});

test('natijaXabari: bitta xabar — yechim holati, ovoz va ovoz xatosi bilan', () => {
  assert.deepEqual(natijaXabari({ yechimYozildi: true, yechimTasdiq: true, ovoz: true }),
    { matn: "Yechim (tasdiqlangan) va video yechim tayyor — ko'rib, tasdiqlang", turi: 'success' });
  assert.match(natijaXabari({ yechimYozildi: true, yechimTasdiq: false, ovoz: true }).matn, /^Yechim \(qoralama\) va video yechim tayyor/);
  assert.match(natijaXabari({ ovoz: false }).matn, /^Video yechim tayyor \(ovozsiz\)/);
  const x = natijaXabari({ yechimYozildi: true, ovoz: false, ovozXato: 'limit' });
  assert.equal(x.turi, 'info');
  assert.match(x.matn, /saqlandi, lekin ovoz yozilmadi: limit$/);
});

test('birga yaratishdan keyin video yechim joriy: eskisi eskiradi, yangisi yangi yechim izi bilan eskirmaydi', () => {
  const eski = { solution: '<p>Eski yechim</p>', correctAnswer: 'B' };
  const yangi = { solution: MOS.yechim, correctAnswer: 'B' };
  const eskiDars = { status: 'tasdiqlangan', yechimIzi: yechimIzi(eski), qadamlar: [] };
  // Yechim saqlandi, video yechim hali tuzilmagan: eskisi eskirgan (o'quvchiga ko'rinmaydi).
  assert.equal(darsEskirganmi(eskiDars, yangi), true);
  assert.equal(darsHolati(eskiDars, yangi), 'eskirgan');
  // Server yangi ssenariyni saqlaganda izni hozirgi yechimdan oladi (routes/imtihonDars.js: yechimIzi(q)).
  const yangiDars = { status: 'qoralama', yechimIzi: yechimIzi(yangi), qadamlar: [] };
  assert.equal(darsEskirganmi(yangiDars, yangi), false);
  assert.equal(darsHolati(yangiDars, yangi), 'qoralama');
});
