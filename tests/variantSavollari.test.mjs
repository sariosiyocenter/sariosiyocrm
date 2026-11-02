// «Variantlarda savollar» (2026-10-29): 'bir' — hamma variantda bir xil savollar (tartibi
// aralashadi, eski usul); 'har' — har variantning o'z savollari, lekin har o'rinda mavzu va
// qiyinlik hamma variantda bir xil. Bank yetmasa savol boshqa variantda takrorlanadi
// (ogohlantirish bilan), bitta variant ichida esa hech qachon.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { sozlamaniTozala, variantlarniYasash, savolniAlmashtir } from '../lib/imtihon.js';

let keyingiId = 100;
const savol = (topic, difficulty) => ({
  id: keyingiId++, subject: 'Matematika', topic, difficulty, type: 'yopiq', status: 'faol', language: 'uz',
  text: `${topic} ${difficulty} #${keyingiId}`, options: ['1', '2', '3', '4'], correctAnswer: 'A', usedCount: 0,
});
const bankYasa = soni => Object.entries(soni).flatMap(([k, n]) => {
  const [topic, d] = k.split('|');
  return Array.from({ length: n }, () => savol(topic, Number(d)));
});

const BLOKLAR = [{
  id: 'b1', subject: 'Matematika', pointsPerQuestion: 1,
  topicRules: [
    { topic: 'Kasrlar', difficulty: 1, type: 'yopiq', count: 2 },
    { topic: 'Geometriya', difficulty: 3, type: 'yopiq', count: 1 },
  ],
}];
const byId = bank => new Map(bank.map(q => [q.id, q]));
const yasa = (bank, settings) => variantlarniYasash({ blocks: BLOKLAR, settings: { variantCount: 4, ...settings }, seed: 11, bank });

test("standart — 'bir' (Addmen: setlar o'sha savollar, tartibi aralashadi), faqat 'bir' | 'har' qabul qilinadi", () => {
  assert.equal(sozlamaniTozala({}).variantSavollari, 'bir');
  assert.equal(sozlamaniTozala({ variantSavollari: 'har' }).variantSavollari, 'har');
  assert.equal(sozlamaniTozala({ variantSavollari: 'xato' }).variantSavollari, 'bir');
});

test("'har': har o'rinda mavzu va qiyinlik hamma variantda bir xil, savollar har xil", () => {
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const q = byId(bank);
  const r = yasa(bank, { variantSavollari: 'har' });
  assert.equal(r.kamchiliklar.length, 0);
  assert.equal(r.variants.length, 4);
  for (let n = 1; n <= 3; n++) {
    const joy = r.variants.map(v => q.get(v.items.find(it => it.n === n).q));
    assert.equal(new Set(joy.map(x => `${x.topic}|${x.difficulty}`)).size, 1, `${n}-o'rinda mavzu/qiyinlik bir xil`);
    assert.equal(new Set(joy.map(x => x.id)).size, 4, `${n}-o'rinda hamma variantda boshqa savol`);
  }
  assert.equal(r.takror, 0);
});

test("'har': bank kam bo'lsa — boshqa variantda takror va ogohlantirish, variant ichida takror yo'q", () => {
  const bank = bankYasa({ 'Kasrlar|1': 3, 'Geometriya|3': 2 });
  const r = yasa(bank, { variantSavollari: 'har' });
  assert.equal(r.kamchiliklar.length, 0);
  for (const v of r.variants) assert.equal(new Set(v.items.map(it => it.q)).size, v.items.length, `${v.code} ichida takror yo'q`);
  // 12 o'rin, 5 ta savol — kamida 7 o'rinda takror.
  assert.equal(r.takror, 12 - 5);
  assert.ok(r.ogohlantirishlar.some(m => m.includes('takror')), r.ogohlantirishlar.join(' | '));
});

test("'har': variant uchun ham yetmasa — kamchilik (bir marta)", () => {
  const bank = bankYasa({ 'Kasrlar|1': 1, 'Geometriya|3': 2 });
  const r = yasa(bank, { variantSavollari: 'har' });
  assert.equal(r.variants.length, 0);
  assert.equal(r.kamchiliklar.length, 1);
  assert.equal(r.kamchiliklar[0].kerak, 2);
});

test("'har': o'rinlar aralashmaydi (shuffleQuestions yoqilgan bo'lsa ham)", () => {
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const q = byId(bank);
  const r = yasa(bank, { variantSavollari: 'har', shuffleQuestions: true });
  for (const v of r.variants) assert.deepEqual(v.items.map(it => q.get(it.q).topic), ['Kasrlar', 'Kasrlar', 'Geometriya']);
});

test("'har' + «har smenaga boshqa»: bank yetsa smenalar savollari kesishmaydi", () => {
  const bank = bankYasa({ 'Kasrlar|1': 20, 'Geometriya|3': 10 });
  const sessions = [{ id: 1, name: '1-smena', time: '09:00' }, { id: 2, name: '2-smena', time: '13:00' }];
  const r = yasa(bank, { variantSavollari: 'har', sessionQuestions: 'alohida', sessions });
  const smenaSavollari = sid => new Set(r.variants.filter(v => v.session === sid).flatMap(v => v.items.map(it => it.q)));
  const [a, b] = [smenaSavollari(1), smenaSavollari(2)];
  assert.equal([...a].filter(id => b.has(id)).length, 0);
  assert.equal(r.takror, 0);
});

test("'har' + «har smenaga boshqa»: bank yetmasa — boshqa smenadagisi ham olinadi, ogohlantirish bilan", () => {
  const bank = bankYasa({ 'Kasrlar|1': 4, 'Geometriya|3': 3 });
  const sessions = [{ id: 1, name: '1-smena', time: '09:00' }, { id: 2, name: '2-smena', time: '13:00' }];
  const r = yasa(bank, { variantSavollari: 'har', sessionQuestions: 'alohida', sessions });
  assert.equal(r.kamchiliklar.length, 0);
  assert.ok(r.ogohlantirishlar.some(m => m.includes('boshqa smenadagi')), r.ogohlantirishlar.join(' | '));
  for (const v of r.variants) assert.equal(new Set(v.items.map(it => it.q)).size, v.items.length);
});

test("bir xil urug' — bir xil variantlar (yig'ish va qulflash mos)", () => {
  const bank = bankYasa({ 'Kasrlar|1': 6, 'Geometriya|3': 3 });
  const iz = r => JSON.stringify(r.variants.map(v => v.items.map(it => it.q)));
  assert.equal(iz(yasa(bank, { variantSavollari: 'har' })), iz(yasa(bank, { variantSavollari: 'har' })));
});

test("'har': qo'lda tanlangan savollar hamma variantda — takror hisoblanmaydi", () => {
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const tanlangan = bank.find(q => q.topic === 'Geometriya');
  const blocks = [{ ...BLOKLAR[0], topicRules: [BLOKLAR[0].topicRules[0], { topic: '', type: 'yopiq', count: 1, questionIds: [tanlangan.id] }] }];
  const r = variantlarniYasash({ blocks, settings: { variantCount: 4, variantSavollari: 'har' }, seed: 3, bank });
  assert.ok(r.variants.every(v => v.items.some(it => it.q === tanlangan.id)));
  assert.equal(r.takror, 0);
});

test("savolniAlmashtir: smenasiz `variant` (faqat kod) — hamma smenadagi o'sha variant", () => {
  const v = (session, code, q) => ({ session, code, items: [{ n: 1, q, b: 0, t: 'yopiq', p: 1, m: [0, 1, 2, 3], k: 0 }] });
  const variants = [v(1, 'A', 5), v(1, 'B', 6), v(2, 'A', 5), v(2, 'B', 6)];
  const yangi = savol('Kasrlar', 1);
  const natija = savolniAlmashtir({ variants, eski: 5, yangi, settings: {}, variant: { code: 'A' } });
  assert.deepEqual(natija.map(x => x.items[0].q), [yangi.id, 6, yangi.id, 6]);
});

test("'har': takror yon/diagonal qo'shniga emas, oldi-orqadagiga tushadi (A–C, B–D)", () => {
  // O'rin varianti (2·qator + o'rin) mod 4: farqi 1 yoki 3 — yonma-yon/diagonal, 2 — oldi-orqa.
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 3 });
  const r = yasa(bank, { variantSavollari: 'har' });
  const kodlar = 'ABCD';
  for (const v of r.variants) {
    const q = v.items.find(it => it.n === 3).q;
    for (const w of r.variants) {
      if (w === v || w.items.find(it => it.n === 3).q !== q) continue;
      const farq = Math.abs(kodlar.indexOf(v.code) - kodlar.indexOf(w.code));
      assert.equal(farq, 2, `${v.code} va ${w.code} bir savolda — qo'shni`);
    }
  }
});

test("'har': bank faqat bitta variantga yetsa — umumiy savollar qo'shni variantlarda bir raqamda turmaydi", () => {
  // Geometriya·qiyin: 3 ta o'rin, bankda aynan 3 ta — 4 variantda ham shu 3 savol.
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 3 });
  const blocks = [{ ...BLOKLAR[0], topicRules: [BLOKLAR[0].topicRules[0], { topic: 'Geometriya', difficulty: 3, type: 'yopiq', count: 3 }] }];
  const r = variantlarniYasash({ blocks, settings: { variantCount: 4, variantSavollari: 'har' }, seed: 5, bank });
  const q = byId(bank);
  const kod = 'ABCD';
  for (const v of r.variants) for (const w of r.variants) {
    const farq = Math.abs(kod.indexOf(v.code) - kod.indexOf(w.code));
    if (farq !== 1 && farq !== 3) continue;
    for (const it of v.items) assert.notEqual(w.items.find(x => x.n === it.n).q, it.q, `${v.code}/${w.code} ${it.n}-o'rinda bir savol`);
  }
  // O'rinlar baribir mos: 3–5-o'rinlar hamma variantda Geometriya·qiyin.
  for (const v of r.variants) assert.deepEqual(v.items.slice(2).map(it => q.get(it.q).topic), ['Geometriya', 'Geometriya', 'Geometriya']);
});

test("'bir': hamma variantda bir xil savollar (eski usul)", () => {
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const r = yasa(bank, { variantSavollari: 'bir' });
  const toplam = v => v.items.map(it => it.q).sort().join(',');
  assert.equal(new Set(r.variants.map(toplam)).size, 1);
  assert.equal(r.takror, 0);
});

test("savolniAlmashtir: `variant` berilsa — faqat o'sha variantdagi savol almashadi", () => {
  const bank = bankYasa({ 'Kasrlar|1': 3, 'Geometriya|3': 2 });
  const r = yasa(bank, { variantSavollari: 'har' });
  const geo = r.variants.map(v => v.items.find(it => it.n === 3).q);
  const eski = geo[0];
  const qaysilar = r.variants.filter(v => v.items.some(it => it.q === eski)).map(v => v.code);
  assert.ok(qaysilar.length > 1, 'takroriy savol bir nechta variantda');
  const yangi = savol('Geometriya', 3);
  const natija = savolniAlmashtir({ variants: r.variants, eski, yangi, settings: { variantSavollari: 'har' }, variant: { session: 1, code: qaysilar[0] } });
  const keyin = natija.filter(v => v.items.some(it => it.q === eski)).map(v => v.code);
  assert.deepEqual(keyin, qaysilar.slice(1));
  assert.ok(natija.find(v => v.code === qaysilar[0]).items.some(it => it.q === yangi.id));
});

// Andozadan «har xil» (2026-11-01): andoza savollari A variantda, qolganlarida — har biri o'rniga
// o'sha mavzu, qiyinlik va tildagi boshqa savol.
const andozaBloki = ids => [{ id: 'b1', subject: 'Matematika', pointsPerQuestion: 1, topicRules: [{ topic: '', type: 'yopiq', count: ids.length, questionIds: ids, oxshash: true }] }];
const andozaYasa = (bank, ids, settings = {}) => variantlarniYasash({ blocks: andozaBloki(ids), settings: { variantCount: 4, variantSavollari: 'har', ...settings }, seed: 7, bank });

test("andoza 'har': A — andozaning o'zi, B/C/D — o'sha raqamda o'sha mavzu va qiyinlikdagi boshqa savol", () => {
  const bank = bankYasa({ 'Kasrlar|1': 6, 'Geometriya|3': 6 });
  const q = byId(bank);
  const ids = [bank.find(x => x.topic === 'Kasrlar').id, bank.find(x => x.topic === 'Geometriya').id];
  const r = andozaYasa(bank, ids);
  assert.equal(r.kamchiliklar.length, 0);
  assert.deepEqual(r.variants.find(v => v.code === 'A').items.map(it => it.q), ids);
  for (let n = 1; n <= 2; n++) {
    const joy = r.variants.map(v => q.get(v.items.find(it => it.n === n).q));
    assert.equal(new Set(joy.map(x => `${x.topic}|${x.difficulty}`)).size, 1, `${n}-o'rinda mavzu/qiyinlik bir xil`);
    assert.equal(new Set(joy.map(x => x.id)).size, 4, `${n}-o'rinda hamma variantda boshqa savol`);
  }
  assert.equal(r.takror, 0);
});

test("andoza 'har': o'xshashi boshqa tilda bo'lsa olinmaydi (tarjima o'xshash emas)", () => {
  const bank = bankYasa({ 'Kasrlar|1': 1 });
  const ru = { ...savol('Kasrlar', 1), language: 'ru' };
  const r = andozaYasa([...bank, ru], [bank[0].id]);
  assert.equal(r.kamchiliklar.length, 0);
  assert.ok(r.variants.every(v => v.items[0].q === bank[0].id), "o'xshashi yo'q — hamma variantda o'zi");
  assert.ok(r.ogohlantirishlar.some(m => m.includes('takror')));
});

test("andoza 'har': bank kam bo'lsa takror qo'shniga emas (A–C, B–D)", () => {
  const bank = bankYasa({ 'Kasrlar|1': 2 });
  const r = andozaYasa(bank, [bank[0].id]);
  const kod = Object.fromEntries(r.variants.map(v => [v.code, v.items[0].q]));
  assert.equal(kod.A, kod.C);
  assert.equal(kod.B, kod.D);
  assert.notEqual(kod.A, kod.B);
});

test("andoza 'bir' (oxshash bo'lsa ham): hamma variantda andozaning o'zi", () => {
  const bank = bankYasa({ 'Kasrlar|1': 6 });
  const ids = bank.slice(0, 3).map(x => x.id);
  const r = andozaYasa(bank, ids, { variantSavollari: 'bir' });
  for (const v of r.variants) assert.deepEqual(v.items.map(it => it.q).sort(), [...ids].sort());
});

// To'plam × tartib (2026-11-01, Addmen Group × Set): 4 variant, 2 to'plam — A va C bir savollar
// (tartibi boshqa), B va D — boshqa to'plam; yonma-yon (A–B) savollari kesishmaydi.
test("to'plamlar: 4 variant 2 to'plam — A=C va B=D savollari, A va B boshqa", () => {
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const r = yasa(bank, { variantSavollari: 'har', toplamlar: 2 });
  assert.equal(r.kamchiliklar.length, 0);
  const toplam = c => r.variants.find(v => v.code === c).items.map(it => it.q).sort().join(',');
  assert.equal(toplam('A'), toplam('C'));
  assert.equal(toplam('B'), toplam('D'));
  const a = new Set(r.variants.find(v => v.code === 'A').items.map(it => it.q));
  assert.equal(r.variants.find(v => v.code === 'B').items.filter(it => a.has(it.q)).length, 0);
  assert.equal(r.takror, 0);
});

test("to'plamlar: savolni almashtirish shu to'plamning hamma setida", () => {
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const settings = { variantCount: 4, variantSavollari: 'har', toplamlar: 2 };
  const r = yasa(bank, settings);
  const eski = r.variants.find(v => v.code === 'A').items[0].q;
  const yangi = savol('Kasrlar', 1);
  const natija = savolniAlmashtir({ variants: r.variants, eski, yangi, settings, variant: { code: 'A' } });
  for (const c of ['A', 'C']) assert.ok(natija.find(v => v.code === c).items.some(it => it.q === yangi.id), `${c} da yangisi`);
  for (const c of ['B', 'D']) assert.ok(!natija.find(v => v.code === c).items.some(it => it.q === yangi.id), `${c} ga tegilmaydi`);
});

test("to'plamlar: 0 yoki variantlar soniga teng — har variant o'z to'plami (avvalgidek)", () => {
  assert.equal(sozlamaniTozala({}).toplamlar, 0);
  const bank = bankYasa({ 'Kasrlar|1': 8, 'Geometriya|3': 4 });
  const iz = r => JSON.stringify(r.variants.map(v => v.items.map(it => it.q)));
  assert.equal(iz(yasa(bank, { variantSavollari: 'har', toplamlar: 4 })), iz(yasa(bank, { variantSavollari: 'har' })));
});
