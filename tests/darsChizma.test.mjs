// Video yechim chizmasi (lib/darsChizma.js, lib/ifoda.js) va darsdagi rasm (lib/imtihonDars.js).
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { ifodaniKompilyatsiya } from '../lib/ifoda.js';
import { DARSDA_ELEMENT_MAX, QADAMDA_ELEMENT_MAX, bolinmaQadami, chizmaChegarasi, chizmaniTozala, elementniTozala, jismBolaklari, jismUchlari } from '../lib/darsChizma.js';
import { soxtaModelniQoy } from '../lib/imtihonAI.js';
import { darsMalumoti, darsSorovi, darsTuz, qadamlarniTozala, vaqtlarniQoy } from '../lib/imtihonDars.js';

const hisobla = (ifoda, x) => { const f = ifodaniKompilyatsiya(ifoda); return f ? Math.round(f(x) * 1e6) / 1e6 : null; };

test('formula: amallar tartibi, yashirin ko\'paytirish va funksiyalar', () => {
  assert.equal(hisobla('x^2 - 4*x + 3', 1), 0);
  assert.equal(hisobla('-x^2', 3), -9);
  assert.equal(hisobla('2x', 5), 10);
  assert.equal(hisobla('3(x+1)', 1), 6);
  assert.equal(hisobla('sin(x)^2', Math.PI / 2), 1);
  assert.equal(hisobla('2sin(x)', Math.PI / 2), 2);
  assert.equal(hisobla('sqrt(x + 1)', 3), 2);
  assert.equal(hisobla('2^-x', 1), 0.5);
  assert.equal(hisobla('x · 2 − 1', 3), 5);
  assert.equal(hisobla('π', 0), 3.141593);
  assert.equal(hisobla('abs(x - 2)', 0), 2);
  assert.equal(hisobla('tg(x)', 0), 0);
});

test('formula: ruxsat etilmagan narsa — null (eval yo\'q)', () => {
  for (const yomon of ['alert(1)', 'x+', '(x', ')', '', 'y + 1', 'constructor', 'x;1', 'x'.repeat(130), '__proto__']) {
    assert.equal(ifodaniKompilyatsiya(yomon), null, yomon);
  }
});

test('element tozalash: turlar, sonlar chegarasi, ortiqcha maydonlar', () => {
  assert.deepEqual(elementniTozala({ tur: 'nuqta', x: '2', y: 3.14159, nom: ' A ', zarar: '<script>' }), { tur: 'nuqta', rang: 'asosiy', nom: 'A', x: 2, y: 3.142 });
  assert.equal(elementniTozala({ tur: 'nuqta', x: 1e9, y: -1e9 }).x, 1000);
  assert.equal(elementniTozala({ tur: 'boshqa' }), null);
  assert.equal(elementniTozala(null), null);
  assert.equal(elementniTozala({ tur: 'oqlar', xdan: 5, xgacha: -5 }), null);
  assert.equal(elementniTozala({ tur: 'grafik', ifoda: 'alert(1)' }), null);
  assert.deepEqual(elementniTozala({ tur: 'grafik', ifoda: 'x^2', dan: 3, gacha: 1 }), { tur: 'grafik', rang: 'asosiy', ifoda: 'x^2' });
  assert.equal(elementniTozala({ tur: 'aylana', x: 0, y: 0, r: -2 }).r, 1);
  assert.equal(elementniTozala({ tur: 'kopburchak', nuqtalar: [{ x: 0, y: 0 }] }), null);
  assert.equal(elementniTozala({ tur: 'matn', x: 0, y: 0, matn: '  ' }), null);
  assert.equal(elementniTozala({ tur: 'nuqta', x: 0, y: 0, rang: 'qizil' }).rang, 'asosiy');
  assert.equal(elementniTozala({ tur: 'nuqta', x: 0, y: 0, nom: '<b>A</b>' }).nom, 'b A /b');
  const kub = elementniTozala({ tur: 'jism', jism: 'kub', a: 3, b: 9, c: 9, belgilar: 'A B C D' });
  assert.deepEqual([kub.a, kub.b, kub.c, kub.belgilar], [3, 3, 3, 'ABCD']);
  assert.equal(elementniTozala({ tur: 'jism', jism: 'tetraedr' }), null);
  // π birlikdagi o'qlar va uzuq grafik (asosiy funksiyani taqqoslash uchun).
  assert.equal(elementniTozala({ tur: 'oqlar', xdan: -6.3, xgacha: 6.3, ydan: -1.5, ygacha: 1.5, birlik: 'pi' }).birlik, 'pi');
  assert.equal(elementniTozala({ tur: 'oqlar', birlik: 'gradus' }).birlik, undefined);
  assert.equal(elementniTozala({ tur: 'grafik', ifoda: 'sin(x)', uzuq: true }).uzuq, true);
  // Koordinatasi berilmagan element 0;0 da "arvoh" bo'lmaydi — tashlanadi.
  assert.equal(elementniTozala({ tur: 'nuqta', x: 1 }), null);
  assert.equal(elementniTozala({ tur: 'nuqta', x: 1, y: null }), null);
  assert.equal(elementniTozala({ tur: 'kesma', x1: 0, y1: 0, x2: 1 }), null);
  assert.equal(elementniTozala({ tur: 'aylana', x: 0, y: 0 }), null);
  // Jism uchlari orasidagi kesma: koordinatasiz.
  assert.deepEqual(elementniTozala({ tur: 'kesma', uch1: 'A', uch2: 'C1', x1: 5 }), { tur: 'kesma', rang: 'asosiy', uch1: 'A', uch2: 'C1' });
});

test('qadam va dars chegarasi: ko\'p elementdan ortig\'i olinmaydi', () => {
  const kop = Array.from({ length: 30 }, (_, i) => ({ tur: 'nuqta', x: i, y: 0 }));
  assert.equal(chizmaniTozala(kop).length, QADAMDA_ELEMENT_MAX);
  assert.equal(chizmaniTozala(kop, 5).length, 5);
  assert.deepEqual(chizmaniTozala('matn'), []);
  const qadamlar = Array.from({ length: 6 }, (_, i) => ({ doska: '$1$', nutq: `Qadam ${i}.`, chizma: kop }));
  const toza = qadamlarniTozala(qadamlar).qadamlar;
  assert.equal(toza.reduce((a, q) => a + (q.chizma?.length || 0), 0), DARSDA_ELEMENT_MAX);
  assert.equal(toza.at(-1).chizma, undefined);
});

test('nutqsiz qadamning chizmasi va rasmi yo\'qolmaydi — qo\'shni qadamga o\'tadi', () => {
  const url = 'https://abc.supabase.co/storage/v1/object/public/uploads/a.png';
  const oq = { tur: 'oqlar', xdan: -2, xgacha: 2, ydan: -2, ygacha: 2 };
  const { qadamlar } = qadamlarniTozala([
    { doska: '', nutq: '', chizma: [oq], rasm: 1 },
    { doska: '$1$', nutq: 'Birinchi.', chizma: [{ tur: 'nuqta', x: 1, y: 1 }] },
    { doska: '', nutq: '', chizma: [{ tur: 'aylana', x: 0, y: 0, r: 1 }] },
    { doska: '$2$', nutq: 'Ikkinchi.' },
  ], { rasmlar: [url] });
  assert.equal(qadamlar.length, 2);
  assert.deepEqual(qadamlar[0].chizma.map(e => e.tur), ['oqlar', 'nuqta', 'aylana']);
  assert.equal(qadamlar[0].rasm, url);
  assert.equal(qadamlar[1].chizma, undefined);
});

test('jism: parallelepipedning ko\'rinmas qirralari uzuq, uchlari nomlangan', () => {
  const { chiziqlar, belgilar } = jismBolaklari(elementniTozala({ tur: 'jism', jism: 'parallelepiped', a: 4, b: 3, c: 2 }));
  assert.equal(chiziqlar.length, 12);
  assert.equal(chiziqlar.filter(c => c.yashirin).length, 3);
  assert.deepEqual(belgilar.map(b => b.matn), ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁']);
  const piramida = jismBolaklari(elementniTozala({ tur: 'jism', jism: 'piramida', a: 4, b: 4, h: 5 }));
  assert.equal(piramida.chiziqlar.length, 8);
  assert.equal(piramida.belgilar.at(-1).matn, 'S');
  for (const jism of ['silindr', 'konus', 'shar']) assert.ok(jismBolaklari(elementniTozala({ tur: 'jism', jism, r: 2, h: 4 })).ellipslar.length >= 2, jism);
  // Uchlar nomi bilan topish: "C1" = "C₁", harf kattaligi farqsiz.
  const uchlar = jismUchlari([elementniTozala({ tur: 'jism', jism: 'kub', a: 2 })]);
  assert.deepEqual(uchlar.top('c1'), uchlar.top('C₁'));
  assert.ok(uchlar.top('A'));
  assert.equal(uchlar.top('Z'), null);
});

test('chegara va bo\'linmalar: chizma o\'lchami elementlardan, bo\'linmalar 4–8 ta', () => {
  assert.deepEqual(chizmaChegarasi([elementniTozala({ tur: 'oqlar', xdan: -1, xgacha: 5, ydan: -2, ygacha: 5 })]), { xdan: -1, xgacha: 5, ydan: -2, ygacha: 5 });
  assert.deepEqual(chizmaChegarasi([]), { xdan: -5, xgacha: 5, ydan: -5, ygacha: 5 });
  const nuqta = chizmaChegarasi([elementniTozala({ tur: 'nuqta', x: 2, y: 2 })]);
  assert.ok(nuqta.xgacha - nuqta.xdan >= 1 && nuqta.ygacha - nuqta.ydan >= 1);
  for (const oraliq of [1, 6, 10, 37, 250]) {
    const q = bolinmaQadami(oraliq);
    assert.ok(oraliq / q <= 8 && oraliq / q >= 2, `${oraliq} → ${q}`);
  }
});

test('rasm: AI raqami havolaga aylanadi; faqat savolning o\'z https rasmi qabul qilinadi', () => {
  const rasmlar = ['https://abc.supabase.co/storage/v1/object/public/uploads/a.png', 'data:image/png;base64,AAAA', 'https://abc.supabase.co/storage/v1/object/public/uploads/b.png'];
  const { qadamlar } = qadamlarniTozala([
    { doska: '$1$', nutq: 'Birinchi.', rasm: 1 },
    { doska: '$2$', nutq: 'Ikkinchi.', rasm: 2 },
    { doska: '$3$', nutq: 'Uchinchi.', rasm: 'https://yomon.example/x.png' },
    { doska: '$4$', nutq: 'To\'rtinchi.', rasm: rasmlar[2] },
  ], { rasmlar });
  assert.equal(qadamlar[0].rasm, rasmlar[0]);
  // Raqam — modelga berilgan tartibda; 2-rasm data: — darsga ko'chirilmaydi (boshqa rasmga siljimaydi).
  assert.equal(qadamlar[1].rasm, undefined);
  assert.equal(qadamlar[2].rasm, undefined);
  assert.equal(qadamlar[3].rasm, rasmlar[2]);
  // Vaqt qo'yilganda chizma va rasm yo'qolmaydi; saqlashda ham shu qoida.
  const vaqtli = vaqtlarniQoy([{ ...qadamlar[0], chizma: [{ tur: 'nuqta', x: 0, y: 0, rang: 'asosiy' }] }, qadamlar[1]]);
  assert.equal(vaqtli.qadamlar[0].rasm, rasmlar[0]);
  assert.equal(vaqtli.qadamlar[0].chizma.length, 1);
  const { d } = darsMalumoti({ qadamlar: [{ doska: '$1$', nutq: 'Bir.', rasm: rasmlar[0] }, { doska: '$2$', nutq: 'Ikki.', rasm: 'https://yomon.example/x.png' }] }, null, { rasmlar });
  assert.equal(d.qadamlar[0].rasm, rasmlar[0]);
  assert.equal(d.qadamlar[1].rasm, undefined);
});

test('darsTuz: rasmlar modelga beriladi, so\'rovda chizma va rasm qoidasi bor', async () => {
  let oxirgi = null;
  soxtaModelniQoy(async (s) => {
    oxirgi = s;
    return { qadamlar: [
      { sarlavha: 'Berilgan', doska: '$x^2$', nutq: 'Grafikni chizamiz.', rasm: 1, chizma: [{ tur: 'oqlar', xdan: -3, xgacha: 3, ydan: -1, ygacha: 9 }] },
      { sarlavha: 'Javob', doska: 'Javob: 3', nutq: 'Javob uch.', chizma: [{ tur: 'grafik', ifoda: 'x^2' }, { tur: 'grafik', ifoda: 'eval(1)' }] },
    ] };
  });
  const q = { type: 'raqamli', language: 'uz', text: '<p>Rasmga qarang</p>', correctAnswer: '3', solution: '<p>Yechim: 3</p>' };
  const url = 'https://abc.supabase.co/storage/v1/object/public/uploads/r.png';
  const r = await darsTuz(q, [], { rasmlar: [{ url, qism: { inlineData: { mimeType: 'image/png', data: 'AAAA' } } }, { url: 'https://x/y.png', qism: null }] });
  assert.equal(oxirgi.qismlar.filter(x => x.inlineData).length, 1);
  assert.match(oxirgi.qismlar[0].text, /CHIZMA:[\s\S]*avval X, keyin Y/);
  assert.match(oxirgi.qismlar[0].text, /Savolga 1 ta rasm ilova qilingan/);
  assert.match(oxirgi.qismlar[0].text, /SAVOL RASMIDA[\s\S]*QAYTA CHIZING/);
  assert.ok(oxirgi.sxema.properties.qadamlar.items.properties.chizma);
  assert.equal(r.qadamlar[0].rasm, url);
  assert.equal(r.qadamlar[0].chizma[0].tur, 'oqlar');
  assert.deepEqual(r.qadamlar[1].chizma.map(e => e.ifoda), ['x^2']);
  assert.doesNotMatch(darsSorovi(q, []), /rasm ilova qilingan/);
  soxtaModelniQoy(null);
});
