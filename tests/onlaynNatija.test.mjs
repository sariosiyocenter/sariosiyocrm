// Onlayn natija sahifasi (Addmen «Online result», 2026-11-02): o'quvchi ID + telefon oxiri yoki
// varaq kodi bilan o'z natijasini topadi; sahifadagi eng yaxshilar ro'yxati — qisqa ism bilan.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  qisqaIsm, telefonOxiri, qidiruvKirishi, telefonMos, onlaynReyting, sozlamaniTozala, ruxsatnomaMatni, QULFDAN_KEYIN_OZGARADI,
} from '../lib/imtihon.js';

test("qisqaIsm: familiya va ismning bosh harfi, to'liq ism chiqmaydi", () => {
  assert.equal(qisqaIsm('Aliyev Vali Karimovich'), 'Aliyev V.');
  assert.equal(qisqaIsm('  Aliyev   vali '), 'Aliyev V.');
  assert.equal(qisqaIsm('Shoxrux'), 'Shoxrux');
  assert.equal(qisqaIsm(''), '');
  assert.equal(qisqaIsm(null), '');
});

test('qidiruvKirishi: varaq kodi yoki ID + 4 raqam; noto\'g\'risi null', () => {
  assert.deepEqual(qidiruvKirishi({ kod: ' k7q-2xz9 ' }), { kod: 'K7Q2XZ9' });
  assert.equal(qidiruvKirishi({ kod: 'AB' }), null);
  assert.equal(qidiruvKirishi({ kod: "1' OR 1=1" }), null);
  assert.deepEqual(qidiruvKirishi({ id: '1024', tel: '45-67' }), { id: 1024, tel: '4567' });
  assert.equal(qidiruvKirishi({ id: '1024', tel: '567' }), null);
  assert.equal(qidiruvKirishi({ id: '', tel: '4567' }), null);
  assert.equal(qidiruvKirishi({ id: '0', tel: '4567' }), null);
  assert.equal(qidiruvKirishi({}), null);
});

test("telefonMos: o'quvchi yoki ota-ona telefonining oxiri", () => {
  assert.equal(telefonOxiri('+998 (90) 123-45-67'), '4567');
  assert.equal(telefonMos('4567', [null, '+998901234567']), true);
  assert.equal(telefonMos('4567', ['+998901234500', '']), false);
  // Qisqa (buzilgan) raqam mos kelmaydi — «567» oxiri «4567» ga teng emas.
  assert.equal(telefonMos('4567', ['567']), false);
  assert.equal(telefonMos('4567', []), false);
});

test("onlaynReyting: o'chiq, reyting «yo'q» — null; topN gacha, o'rin tartibida, qisqa ism", () => {
  const natijalar = [
    { rank: 2, score: 80, percentage: 80, ism: 'Karimov Bobur' },
    { rank: 1, score: 95, percentage: 95, ism: 'Aliyev Vali' },
    { rank: 3, score: 70, percentage: 70, ism: 'Soliyeva Dilnoza' },
    { rank: null, score: 10, percentage: 10, ism: 'Hisoblanmagan' },
  ];
  const s = (o) => ({ ranking: 'hammasi', topN: 2, onlaynNatija: { yoqilgan: true, reyting: true }, ...o });
  assert.deepEqual(onlaynReyting(natijalar, s()), [
    { orin: 1, ism: 'Aliyev V.', ball: 95, foiz: 95 },
    { orin: 2, ism: 'Karimov B.', ball: 80, foiz: 80 },
  ]);
  assert.equal(onlaynReyting(natijalar, s({ ranking: 'yoq' })), null);
  assert.equal(onlaynReyting(natijalar, s({ onlaynNatija: { yoqilgan: true, reyting: false } })), null);
  // Teng o'rin (ikkita 1-o'rin) — ikkalasi ham chiqadi.
  const teng = onlaynReyting([{ rank: 1, score: 9, percentage: 90, ism: 'A B' }, { rank: 1, score: 9, percentage: 90, ism: 'C D' }, { rank: 3, score: 5, percentage: 50, ism: 'E F' }], s());
  assert.deepEqual(teng.map(x => x.orin), [1, 1]);
});

test("sozlama: onlaynNatija standart o'chiq, qulfdan keyin ham o'zgaradi", () => {
  assert.deepEqual(sozlamaniTozala({}).onlaynNatija, { yoqilgan: false, reyting: false });
  assert.deepEqual(sozlamaniTozala({ onlaynNatija: { yoqilgan: true, reyting: 'ha' } }).onlaynNatija, { yoqilgan: true, reyting: false });
  assert.ok(QULFDAN_KEYIN_OZGARADI.includes('onlaynNatija'));
});

test('ruxsatnoma: {varaq_kodi} qo\'yiladi, bo\'sh bo\'lsa qatori tushib qoladi', () => {
  const shablon = 'Salom {ism}\nVaraq kodi: {varaq_kodi}';
  assert.equal(ruxsatnomaMatni(shablon, { ism: 'Vali', varaq_kodi: 'K7Q2XZ9' }), 'Salom Vali\nVaraq kodi: K7Q2XZ9');
  assert.equal(ruxsatnomaMatni(shablon, { ism: 'Vali' }), 'Salom Vali');
});
