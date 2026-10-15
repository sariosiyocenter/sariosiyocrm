// Video yechim ssenariysi (lib/imtihonDars.js) — soxta model bilan: bazasiz, haqiqiy AI siz.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { soxtaModelniQoy } from '../lib/imtihonAI.js';
import {
  NUTQ_JAMI_MAX, QADAM_MAX, bankDarsi, darsMalumoti, darsOgohlari, darsSorovi, darsTuz, doskaniTozala,
  harfsizmi, nutqdaFormulaBormi, nutqniTozala, oquvchiDarsi, ovozFayli, qadamlarniTozala, taxminiyDavom, variantHarfiBormi,
  vaqtlarniQoy, yechimIzi,
} from '../lib/imtihonDars.js';

const SAVOL = {
  id: 7, type: 'yopiq', language: 'uz', text: '<p>$x^2-5x+6=0$ tenglamaning katta ildizini toping.</p>',
  correctAnswer: 'B', solutionStatus: 'tasdiqlangan',
  solution: '<p>$D = 25 - 24 = 1$</p><p>$x_1 = 2$, $x_2 = 3$</p><p>Javob: B</p>',
};
const VARIANTLAR = ['2', '3', '5', '6'];
const QADAMLAR = [
  { sarlavha: 'Berilgan', doska: '$x^2-5x+6=0$', nutq: 'Bizga kvadrat tenglama berilgan, uning katta ildizini topamiz' },
  { sarlavha: 'Diskriminant', doska: '$D = b^2-4ac$\n$D = 25-24 = 1$', nutq: 'Diskriminant yigirma beshdan yigirma to\'rtni ayirsak, birga teng.' },
  { sarlavha: 'Javob', doska: '$x_2 = 3$', nutq: 'Ikki ildizdan kattasi uch, demak javob uch.' },
];

let oxirgi = null;
/** Soxta model: so'rovni eslab qoladi va `javob` ni qaytaradi. */
const model = (javob) => soxtaModelniQoy(async (s) => { oxirgi = { ...s, matn: s.qismlar.map(q => q.text || '').join('\n') }; return javob; });

test('nutq tozalanadi: bir qator, burchakli qavs va Markdownsiz, oxirida tinish belgisi', () => {
  assert.equal(nutqniTozala('  Avval **diskriminantni**\n topamiz <pause> '), 'Avval diskriminantni topamiz.');
  assert.equal(nutqniTozala('Javob uchga teng!'), 'Javob uchga teng!');
  assert.equal(nutqniTozala('iks < besh va igrek > uch'), 'iks besh va igrek uch.');
  assert.equal(nutqniTozala(''), '');
});

test('uzun nutq gap oxirida kesiladi, yarim so\'zda emas', () => {
  const gap = 'Bu juda uzun tushuntirishning bir gapi. ';
  const natija = nutqniTozala(gap.repeat(40));
  assert.ok(natija.length <= 600);
  assert.ok(natija.endsWith('bir gapi.'));
});

test('nutqdagi formula belgilari aniqlanadi', () => {
  assert.equal(nutqdaFormulaBormi('iks kvadrat minus besh iks'), false);
  assert.equal(nutqdaFormulaBormi('bu yerda $x^2$ bor'), true);
  assert.equal(nutqdaFormulaBormi('\\frac ham qolgan'), true);
});

test('doska: qatorlar saqlanadi, Markdown ketadi, formuladagi «<» belgiga tegilmaydi', () => {
  assert.equal(doskaniTozala('## Yechim\r\n**$x < 5$**\n\n  $y = 2$  '), 'Yechim\n$x < 5$\n$y = 2$');
  assert.equal(doskaniTozala('$$a\n+ b$$'), '$$a + b$$');
});

test('doska chegaradan oshsa oxirgi qatorlar tashlanadi — qator o\'rtasidan kesilmaydi', () => {
  const qator = `$${'a+'.repeat(120)}b$`;
  const natija = doskaniTozala([qator, qator, qator, qator].join('\n'));
  assert.deepEqual(natija.split('\n'), [qator, qator]);
  assert.equal(doskaniTozala(Array.from({ length: 9 }, (_, i) => `q${i}`).join('\n')).split('\n').length, 6);
});

test('nutqsiz qadamning doskasi qo\'shni qadamga qo\'shiladi; bo\'sh qadam tashlanadi', () => {
  const { qadamlar, kesildi } = qadamlarniTozala([
    { doska: '$a = 1$', nutq: '' },
    { sarlavha: 'Birinchi', doska: '$b = 2$', nutq: 'Birinchi qadam' },
    { doska: '$c = 3$' },
    null, { sarlavha: 'bo\'sh' },
    { sarlavha: 'Ikkinchi', doska: '', nutq: 'Ikkinchi qadam.' },
  ]);
  assert.equal(kesildi, false);
  assert.deepEqual(qadamlar, [
    { sarlavha: 'Birinchi', doska: '$a = 1$\n$b = 2$\n$c = 3$', nutq: 'Birinchi qadam.' },
    { sarlavha: 'Ikkinchi', doska: '', nutq: 'Ikkinchi qadam.' },
  ]);
});

test('juda uzun dars kesiladi va bu belgilanadi', () => {
  const kop = Array.from({ length: QADAM_MAX + 3 }, (_, i) => ({ sarlavha: `Q${i}`, doska: '$1$', nutq: 'Qisqa gap.' }));
  const r = qadamlarniTozala(kop);
  assert.equal(r.qadamlar.length, QADAM_MAX);
  assert.equal(r.kesildi, true);
  const uzun = Array.from({ length: 8 }, () => ({ doska: '$1$', nutq: 'so\'z '.repeat(110) }));
  const u = qadamlarniTozala(uzun);
  assert.equal(u.kesildi, true);
  assert.ok(u.qadamlar.reduce((a, q) => a + q.nutq.length, 0) <= NUTQ_JAMI_MAX);
  assert.deepEqual(qadamlarniTozala('matn'), { qadamlar: [], kesildi: false });
});

test('vaqt: ovozsiz — nutq uzunligidan taxmin; ovoz bilan — haqiqiy chegaralar', () => {
  const toza = qadamlarniTozala(QADAMLAR).qadamlar;
  const taxmin = vaqtlarniQoy(toza);
  assert.equal(taxmin.qadamlar[0].boshi, 0);
  assert.equal(taxmin.qadamlar[1].boshi, taxmin.qadamlar[0].davomi);
  assert.equal(taxmin.qadamlar[0].davomi, taxminiyDavom(toza[0].nutq));
  assert.ok(Math.abs(taxmin.davomiylik - taxmin.qadamlar.reduce((a, q) => a + q.davomi, 0)) < 0.05);
  assert.equal(taxminiyDavom('Ha.'), 2.5);

  const aniq = vaqtlarniQoy(toza, [0, 4.25, 9.5, 13]);
  assert.deepEqual(aniq.qadamlar.map(q => [q.boshi, q.davomi]), [[0, 4.25], [4.25, 5.25], [9.5, 3.5]]);
  assert.equal(aniq.davomiylik, 13);
  // Chegaralar soni mos kelmasa — taxminga qaytadi (buzilgan vaqt saqlanmaydi).
  assert.equal(vaqtlarniQoy(toza, [0, 5]).davomiylik, taxmin.davomiylik);
});

test('so\'rov: savol, to\'g\'ri javob, tayyor yechim, nutq qoidasi va ustoz talabi', () => {
  const matn = darsSorovi(SAVOL, VARIANTLAR, { korsatma: '  Soddaroq   tilda ' });
  assert.match(matn, /katta ildizini toping/);
  // Variantlar har o'quvchida boshqa tartibda: javob harfsiz, qiymati bilan beriladi.
  assert.match(matn, /TO'G'RI JAVOB: 3\n/);
  assert.match(matn, /variant harfini \(A, B, C…\) doskada ham, nutqda ham ishlatmang[\s\S]*«Javob: 3»/);
  assert.match(matn, /TAYYOR YECHIM[\s\S]*\$D = 25 - 24 = 1\$/);
  assert.match(matn, /Masalani qayta yechmang/);
  assert.match(matn, /iks kvadrat minus besh iks/);
  assert.match(matn, /USTOZNING TALABI[\s\S]*«Soddaroq tilda»/);
  assert.match(matn, /o'zbek \(lotin yozuvi\) tilida/);
  assert.doesNotMatch(darsSorovi(SAVOL, VARIANTLAR), /USTOZNING TALABI/);
  // Javoblari aralashtirilmaydigan savolda harf o'zgarmaydi — harfi bilan beriladi.
  const qulflangan = darsSorovi({ ...SAVOL, lockOptions: true }, VARIANTLAR);
  assert.match(qulflangan, /TO'G'RI JAVOB: B\) 3/);
  assert.doesNotMatch(qulflangan, /BOSHQA TARTIBDA/);
  assert.doesNotMatch(darsSorovi({ ...SAVOL, type: 'raqamli', correctAnswer: '3' }, []), /BOSHQA TARTIBDA/);
  assert.match(darsSorovi({ ...SAVOL, language: 'ru' }, VARIANTLAR), /икс в квадрате[\s\S]*rus tilida/);
});

test('darsTuz: AI javobi tozalanadi, vaqt va ogohlantirishlar qo\'yiladi', async () => {
  model({ qadamlar: [...QADAMLAR, { sarlavha: 'Ortiqcha', doska: '', nutq: 'Bu yerda $x^2$ qolgan' }] });
  const r = await darsTuz(SAVOL, VARIANTLAR, { korsatma: 'Qisqaroq' });
  assert.match(oxirgi.matn, /«Qisqaroq»/);
  assert.equal(oxirgi.sxema.required[0], 'qadamlar');
  assert.equal(r.qadamlar.length, 4);
  assert.equal(r.qadamlar[0].nutq.at(-1), '.');
  assert.ok(r.davomiylik > 10);
  assert.equal(r.ogohlar.length, 1);
  assert.match(r.ogohlar[0], /formula belgilari/);
});

test('darsTuz: yechimi yo\'q savolga dars tuzilmaydi; chala javob — xato', async () => {
  model({ qadamlar: QADAMLAR });
  await assert.rejects(() => darsTuz({ ...SAVOL, solution: '<p></p>' }, VARIANTLAR), { status: 400, message: /avval yechim/ });
  model({ qadamlar: [QADAMLAR[0]] });
  await assert.rejects(() => darsTuz(SAVOL, VARIANTLAR), /video yechim tuza olmadi/);
  model({});
  await assert.rejects(() => darsTuz(SAVOL, VARIANTLAR), /video yechim tuza olmadi/);
});

test('saqlash: yangi ssenariy qoralama bo\'ladi; holatni o\'zgartirish — faqat bor darsga', () => {
  const yangi = darsMalumoti({ qadamlar: QADAMLAR, korsatma: 'Qisqaroq' }, null);
  assert.equal(yangi.d.status, 'qoralama');
  assert.equal(yangi.d.korsatma, 'Qisqaroq');
  assert.equal(yangi.d.qadamlar.length, 3);
  assert.ok(yangi.d.davomiylik > 0);
  assert.deepEqual(Object.keys(yangi.d.qadamlar[0]), ['sarlavha', 'doska', 'nutq', 'boshi', 'davomi']);

  assert.deepEqual(darsMalumoti({ status: 'tasdiqlangan' }, { id: 1 }), { d: { status: 'tasdiqlangan' } });
  assert.match(darsMalumoti({ status: 'tasdiqlangan' }, null).xato, /avval video yechim tuzing/);
  assert.match(darsMalumoti({ status: 'boshqa' }, { id: 1 }).xato, /holati noto'g'ri/);
  assert.match(darsMalumoti({}, { id: 1 }).xato, /kerak/);
  assert.match(darsMalumoti(null, null).xato, /kerak/);
  assert.match(darsMalumoti({ qadamlar: [QADAMLAR[0]] }, null).xato, /kamida 2 ta qadam/);
  assert.match(darsMalumoti({ qadamlar: Array.from({ length: 20 }, () => QADAMLAR[0]) }, null).xato, /juda uzun/);
});

test('saqlashda mijoz yuborgan ortiqcha maydon va teglar bazaga o\'tmaydi', () => {
  const { d } = darsMalumoti({ qadamlar: [
    { sarlavha: '<b>Bir</b>', doska: '<img src=x onerror=alert(1)>', nutq: 'Birinchi <script> gap', boshi: 999, ovozUrl: 'http://x' },
    { sarlavha: 'Ikki', doska: '$2$', nutq: 'Ikkinchi gap' },
  ] }, null);
  assert.deepEqual(Object.keys(d.qadamlar[0]), ['sarlavha', 'doska', 'nutq', 'boshi', 'davomi']);
  assert.equal(d.qadamlar[0].boshi, 0);
  assert.equal(d.qadamlar[0].nutq, 'Birinchi gap.');
  // Doska — oddiy matn: pleer uni ekranlab chizadi, shuning uchun teg matn bo'lib qoladi.
  assert.equal(d.qadamlar[0].doska, '<img src=x onerror=alert(1)>');
});

test('yechim izi: bo\'shliq farqi hisobga olinmaydi, mazmun o\'zgarsa — o\'zgaradi', () => {
  const iz = (solution, correctAnswer = 'B') => yechimIzi({ solution, correctAnswer });
  assert.equal(iz('<p>a  b</p>'), iz('<p>a b</p>'));
  assert.notEqual(iz('<p>a b</p>'), iz('<p>a c</p>'));
  // To'g'ri javob (kalit) tuzatilsa ham dars eskiradi.
  assert.notEqual(iz('<p>a b</p>', 'B'), iz('<p>a b</p>', 'C'));
  assert.equal(iz('<p>a b</p>', ' B '), iz('<p>a b</p>', 'B'));
  assert.match(yechimIzi(null), /^[0-9a-f]{16}$/);
});

test('o\'quvchi faqat tasdiqlangan, yechimi tasdiqlangan va eskirmagan darsni ko\'radi', () => {
  const { qadamlar, davomiylik } = vaqtlarniQoy(qadamlarniTozala(QADAMLAR).qadamlar);
  const dars = { qadamlar, davomiylik, ovozUrl: 'https://x/dars.mp3', status: 'tasdiqlangan', yechimIzi: yechimIzi(SAVOL), korsatma: null };
  assert.deepEqual(oquvchiDarsi(dars, SAVOL), { qadamlar, davomiylik, ovoz: 'https://x/dars.mp3' });
  assert.equal(oquvchiDarsi({ ...dars, status: 'qoralama' }, SAVOL), null);
  assert.equal(oquvchiDarsi(dars, { ...SAVOL, solutionStatus: 'qoralama' }), null);
  assert.equal(oquvchiDarsi(dars, { ...SAVOL, solution: '<p>Boshqa yechim</p>' }), null);
  // Kalit tuzatilgan: dars eski javobni aytadi — o'quvchiga ko'rinmaydi.
  assert.equal(oquvchiDarsi(dars, { ...SAVOL, correctAnswer: 'C' }), null);
  assert.equal(oquvchiDarsi({ ...dars, qadamlar: [] }, SAVOL), null);
  assert.equal(oquvchiDarsi(undefined, SAVOL), null);

  assert.equal(bankDarsi(null, SAVOL), null);
  assert.deepEqual(bankDarsi({ ...dars, ovozUrl: null }, { ...SAVOL, solution: '<p>Boshqa yechim</p>' }),
    { qadamlar, davomiylik, ovoz: null, status: 'tasdiqlangan', eskirgan: true, korsatma: null });
  assert.equal(bankDarsi(dars, SAVOL).eskirgan, false);
});

test('ovoz fayli: faqat o\'z Storage\'imizdagi dars fayli tanilanadi (boshqasi o\'chirilmaydi)', () => {
  const asos = 'https://abc.supabase.co';
  const yol = `${asos}/storage/v1/object/public/uploads`;
  assert.equal(ovozFayli(`${yol}/dars_42_1760000000000_a1b2c3d4e5f6.mp3`, asos), 'dars_42_1760000000000_a1b2c3d4e5f6.mp3');
  assert.equal(ovozFayli(`${yol}/svg_1760000000000_a1b2.svg`, asos), '');
  assert.equal(ovozFayli(`${yol}/dars_42/../boshqa.mp3`, asos), '');
  assert.equal(ovozFayli(`https://yomon.example/storage/v1/object/public/uploads/dars_1_2_ab.mp3`, asos), '');
  assert.equal(ovozFayli(`http://abc.supabase.co/storage/v1/object/public/uploads/dars_1_2_ab.mp3`, asos), '');
  assert.equal(ovozFayli('data:audio/mpeg;base64,AAAA', asos), '');
  assert.equal(ovozFayli(null, asos), '');
  assert.equal(ovozFayli(`${yol}/dars_1_2_ab.mp3`, ''), '');
});

test('ogohlantirishlar: toza darsda yo\'q; kesilgan darsda bor', () => {
  const toza = qadamlarniTozala(QADAMLAR).qadamlar;
  assert.deepEqual(darsOgohlari(toza), []);
  assert.deepEqual(darsOgohlari(toza, { harfsiz: true }), []);
  assert.match(darsOgohlari(toza, { kesildi: true })[0], /juda uzun/);
});

test('variant harfi: aralashtiriladigan savolning darsida harf tilga olinsa — ogohlantirish', () => {
  for (const matn of ['Javob: B', 'Javob — B)', 'B varianti', 'demak javob be varianti', "to'g'ri javob — se varianti", 'Ответ: В', 'вариант бэ', 'Answer: C', 'option D']) {
    assert.equal(variantHarfiBormi(matn), true, matn);
  }
  for (const matn of ['Javob: 3', 'Javob: $x = 3$', "to'g'ri javob — uch", 'javob aniq chiqdi', 'ikkita variant bor', 'ответ в сантиметрах', 'Ответ: 3', '$D = b^2 - 4ac$', '']) {
    assert.equal(variantHarfiBormi(matn), false, matn);
  }
  assert.equal(harfsizmi({ type: 'yopiq' }), true);
  assert.equal(harfsizmi({ type: 'juft' }), true);
  assert.equal(harfsizmi({ type: 'yopiq', lockOptions: true }), false);
  assert.equal(harfsizmi({ type: 'raqamli' }), false);
  assert.equal(harfsizmi({ type: 'moslash' }), false);

  const harfli = [{ sarlavha: 'Javob', doska: 'Javob: B', nutq: 'Demak javob uch.' }, { sarlavha: 'Yana', doska: '$3$', nutq: "To'g'ri javob — be varianti." }];
  assert.match(darsOgohlari(harfli, { harfsiz: true })[0], /variant harfi tilga olingan/);
  assert.deepEqual(darsOgohlari(harfli, { harfsiz: false }), []);
});

test('darsTuz: AI harf ishlatib yuborsa — ustozga ogohlantirish chiqadi (aralashtirilmaydigan savolda — yo\'q)', async () => {
  const javob = { qadamlar: [QADAMLAR[0], { sarlavha: 'Javob', doska: 'Javob: B', nutq: 'Javob be varianti.' }] };
  model(javob);
  assert.match((await darsTuz(SAVOL, VARIANTLAR)).ogohlar.join(' '), /variant harfi tilga olingan/);
  model(javob);
  assert.deepEqual((await darsTuz({ ...SAVOL, lockOptions: true }, VARIANTLAR)).ogohlar, []);
});
