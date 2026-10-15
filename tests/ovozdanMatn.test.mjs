// Ustozning ovozli ko'rsatmasi → matn (lib/ovozdanMatn.js) — soxta model bilan, haqiqiy AI siz.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { aiBilan } from '../lib/imtihonAI.js';
import { AUDIO_MAX, audioQismi, matnniTozala, ovozdanMatn, soxtaOvozdanMatnniQoy } from '../lib/ovozdanMatn.js';
import { elementniTozala } from '../lib/darsChizma.js';
import { darsSorovi } from '../lib/imtihonDars.js';

const audio = (tur, bayt = 2000) => `data:${tur};base64,${Buffer.alloc(bayt, 7).toString('base64')}`;

test('brauzer formatlari Gemini tushunadigan nomga o\'giriladi', () => {
  assert.equal(audioQismi(audio('audio/webm;codecs=opus')).inlineData.mimeType, 'audio/webm');
  assert.equal(audioQismi(audio('audio/ogg;codecs=opus')).inlineData.mimeType, 'audio/ogg');
  // Safari mp4 yozadi — Gemini ro'yxatida bu m4a.
  assert.equal(audioQismi(audio('audio/mp4')).inlineData.mimeType, 'audio/m4a');
  assert.equal(audioQismi(audio('audio/webm')).inlineData.data, Buffer.alloc(2000, 7).toString('base64'));
});

test('noto\'g\'ri format, juda katta yoki juda qisqa audio — 400/413', () => {
  assert.throws(() => audioQismi(audio('video/webm')), { status: 400 });
  assert.throws(() => audioQismi(audio('image/png')), { status: 400 });
  assert.throws(() => audioQismi('data:audio/webm;base64,<script>'), { status: 400 });
  assert.throws(() => audioQismi('salom'), { status: 400 });
  assert.throws(() => audioQismi(undefined), { status: 400 });
  assert.throws(() => audioQismi(audio('audio/webm', 100)), /juda qisqa/);
  assert.throws(() => audioQismi(audio('audio/webm', AUDIO_MAX + 10)), { status: 413 });
});

test('matn tozalanadi: Markdown va boshqaruv belgilarisiz, chegaralangan', () => {
  assert.equal(matnniTozala('  **Qisqaroq** qiling,\n\n\nchizma bilan.  '), 'Qisqaroq qiling,\nchizma bilan.');
  assert.equal(matnniTozala('a'.repeat(5000)).length, 1200);
  assert.equal(matnniTozala(null), '');
});

test('ovozdanMatn: soxta model matni qaytadi; kalitsiz — 503', async (t) => {
  t.after(() => soxtaOvozdanMatnniQoy(null));
  let kelgan = null;
  soxtaOvozdanMatnniQoy(async ({ qism }) => { kelgan = qism; return ' Soddaroq tilda tushuntiring. '; });
  assert.equal(await ovozdanMatn(audio('audio/webm')), 'Soddaroq tilda tushuntiring.');
  assert.equal(kelgan.inlineData.mimeType, 'audio/webm');
  soxtaOvozdanMatnniQoy(null);
  const eski = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY];
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  t.after(() => { if (eski[0]) process.env.GEMINI_API_KEY = eski[0]; if (eski[1]) process.env.GOOGLE_API_KEY = eski[1]; });
  await assert.rejects(aiBilan('', () => ovozdanMatn(audio('audio/webm'))), { status: 503 });
});

test('burchak belgisi: uchi va ikki tomoni kerak; to\'g\'ri burchak belgisi saqlanadi', () => {
  assert.deepEqual(elementniTozala({ tur: 'burchak', x: 0, y: 0, x1: 3, y1: 0, x2: 0, y2: 4, togri: true, nom: 'C' }),
    { tur: 'burchak', rang: 'asosiy', nom: 'C', x: 0, y: 0, x1: 3, y1: 0, x2: 0, y2: 4, togri: true });
  assert.equal(elementniTozala({ tur: 'burchak', x: 0, y: 0, x1: 3, y1: 0 }), null);
});

test('so\'rov: rasm bo\'lmasa ham masalaning o\'zini chizish qoidasi bor', () => {
  const matn = darsSorovi({ type: 'raqamli', language: 'uz', text: 'Uchburchakda AB = 5', correctAnswer: '5', solution: '<p>Javob: 5</p>' }, []);
  assert.match(matn, /MASALANING O'ZINI CHIZING/);
  assert.match(matn, /burchak: x, y \(uchi\)/);
});
