// Video yechim ovozi (lib/darsOvoz.js) — haqiqiy TTS siz: sun'iy ovoz (ton + jimlik) va soxta tarmoq.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { aiBilan } from '../lib/imtihonAI.js';
import { CHASTOTA, audioniTop, chegaralarniTop, mp3ga, nutqniOvozga, ovozSora, ovozTayyormi, pauzalar, soxtaOvozniQoy, wavdanPcm } from '../lib/darsOvoz.js';

/** Sun'iy ovoz: [soniya, 'gap' | 'jim'] bo'laklaridan PCM (gap — 220 Hz ton). */
function ovoz(bolaklar, chastota = CHASTOTA) {
  const jami = bolaklar.reduce((a, [s]) => a + Math.round(s * chastota), 0);
  const pcm = new Int16Array(jami);
  let i = 0;
  for (const [s, tur] of bolaklar) {
    const soni = Math.round(s * chastota);
    for (let k = 0; k < soni; k++, i++) pcm[i] = tur === 'gap' ? Math.round(9000 * Math.sin((2 * Math.PI * 220 * k) / chastota)) : 0;
  }
  return pcm;
}

/** PCM → WAV (RIFF) baytlari. */
function wav(pcm, chastota = CHASTOTA, { ortiqcha = false } = {}) {
  const malumot = Buffer.alloc(pcm.length * 2);
  pcm.forEach((v, i) => malumot.writeInt16LE(v, i * 2));
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'latin1'); fmt.writeUInt32LE(16, 4); fmt.writeUInt16LE(1, 8); fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(chastota, 12); fmt.writeUInt32LE(chastota * 2, 16); fmt.writeUInt16LE(2, 20); fmt.writeUInt16LE(16, 22);
  // Ba'zi kodlovchilar `data` dan oldin boshqa bo'lak (LIST) qo'shadi — o'tkazib yuborilishi kerak.
  const list = ortiqcha ? Buffer.concat([Buffer.from('LIST', 'latin1'), Buffer.from([3, 0, 0, 0]), Buffer.from('abc\0', 'latin1')]) : Buffer.alloc(0);
  const dataBosh = Buffer.alloc(8);
  dataBosh.write('data', 0, 'latin1'); dataBosh.writeUInt32LE(malumot.length, 4);
  const tana = Buffer.concat([Buffer.from('WAVE', 'latin1'), fmt, list, dataBosh, malumot]);
  const bosh = Buffer.alloc(8);
  bosh.write('RIFF', 0, 'latin1'); bosh.writeUInt32LE(tana.length, 4);
  return Buffer.concat([bosh, tana]);
}

const soxtaJavob = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

test('WAV o\'qiladi: chastota sarlavhadan, ortiqcha bo\'laklar o\'tkazib yuboriladi', () => {
  const pcm = ovoz([[0.2, 'gap'], [0.1, 'jim']], 16000);
  const r = wavdanPcm(wav(pcm, 16000, { ortiqcha: true }));
  assert.equal(r.chastota, 16000);
  assert.deepEqual(r.pcm, pcm);
});

test('sarlavhasiz ovoz xom 24 kHz PCM deb olinadi; buzilgan WAV — xato', () => {
  const pcm = ovoz([[0.05, 'gap']]);
  const xom = Buffer.alloc(pcm.length * 2);
  pcm.forEach((v, i) => xom.writeInt16LE(v, i * 2));
  assert.deepEqual(wavdanPcm(xom), { pcm, chastota: CHASTOTA });
  assert.throws(() => wavdanPcm(Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVE', 'latin1'), Buffer.alloc(4)])), /buzilgan/);
  const stereo = wav(pcm);
  stereo.writeUInt16LE(2, 22);
  assert.throws(() => wavdanPcm(stereo), /mono 16-bit PCM emas/);
  // Chastotasi nol bo'lgan sarlavha vaqtlarni cheksiz qilib yuborardi.
  assert.throws(() => wavdanPcm(wav(pcm, 0)), /chastotasi noto'g'ri/);
});

test('pauzalar: qisqa jimlik (so\'z ichi) va chetdagi jimlik pauza emas', () => {
  const pcm = ovoz([[0.3, 'jim'], [1, 'gap'], [0.08, 'jim'], [1, 'gap'], [0.5, 'jim'], [1, 'gap'], [0.4, 'jim']]);
  const r = pauzalar(pcm, CHASTOTA);
  assert.equal(r.length, 1);
  assert.ok(Math.abs(r[0].boshi - 2.38) < 0.03 && Math.abs(r[0].oxiri - 2.88) < 0.03);
});

test('chegaralar pauzaga suriladi: gap ichidagi qisqa pauza emas, qadamlar orasidagi uzuni tanlanadi', () => {
  // 3 qadam: 4 s, 6 s (o'rtasida qisqa pauza), 3 s; orada 0,6 s dan pauza. Vaznlar sal noaniq (nutq tezligi bir xil emas).
  const pcm = ovoz([[4, 'gap'], [0.6, 'jim'], [3, 'gap'], [0.25, 'jim'], [2.75, 'gap'], [0.6, 'jim'], [3, 'gap']]);
  const ch = chegaralarniTop(pcm, CHASTOTA, [46, 58, 36]);
  assert.equal(ch.length, 4);
  assert.equal(ch[0], 0);
  assert.ok(Math.abs(ch[1] - 4.54) < 0.05, `1-chegara ${ch[1]}`);
  assert.ok(Math.abs(ch[2] - 11.14) < 0.05, `2-chegara ${ch[2]}`);
  assert.ok(Math.abs(ch[3] - 14.2) < 0.01);
});

test('pauzasiz ovozda chegaralar vazn bo\'yicha taxmin bo\'lib qoladi va o\'sib boradi', () => {
  const pcm = ovoz([[10, 'gap']]);
  const ch = chegaralarniTop(pcm, CHASTOTA, [10, 30, 10]);
  assert.deepEqual(ch.map(x => Math.round(x * 10) / 10), [0, 2, 8, 10]);
  assert.deepEqual(chegaralarniTop(pcm, CHASTOTA, [5]), [0, 10]);
});

test('MP3: kadr sarlavhasi bilan boshlanadi, hajmi bitreytga mos', async () => {
  const mp3 = await mp3ga(ovoz([[2, 'gap']]), CHASTOTA);
  assert.equal(mp3[0], 0xff);
  assert.equal(mp3[1] & 0xe0, 0xe0);
  // 48 kbit/s × 2 s = 12 000 bayt (kodlovchi bir-ikki kadr qo'shadi).
  assert.ok(mp3.length > 11000 && mp3.length < 13500, `hajm ${mp3.length}`);
});

test('javobdan ovoz topiladi: SDK ko\'rinishi va qadamlar ichidagi ko\'rinish', () => {
  assert.deepEqual(audioniTop({ output_audio: { data: 'QUJD', mime_type: 'audio/WAV' } }), { data: 'QUJD', tur: 'audio/wav', chastota: 0, kanal: 0 });
  assert.deepEqual(
    audioniTop({ steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: 'x' }, { type: 'audio', data: 'REVG', mime_type: 'audio/l16', sample_rate: 24000, channels: 1 }] }] }),
    { data: 'REVG', tur: 'audio/l16', chastota: 24000, kanal: 1 },
  );
  assert.equal(audioniTop({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: '' }] }] }), null);
  assert.equal(audioniTop({ status: 'in_progress' }), null);
  assert.equal(audioniTop(null), null);
});

test('siqilgan ovoz (MP3, Ogg) PCM deb o\'qilmaydi; xom PCM chastotasi MIME dan olinadi', () => {
  const pcm = ovoz([[0.05, 'gap']]);
  const xom = Buffer.alloc(pcm.length * 2);
  pcm.forEach((v, i) => xom.writeInt16LE(v, i * 2));
  assert.equal(wavdanPcm(xom, { tur: 'audio/l16;rate=16000' }).chastota, 16000);
  assert.equal(wavdanPcm(xom, { tur: 'audio/l16' }).chastota, CHASTOTA);
  // Javobda chastota alohida aytilgan bo'lsa — o'sha ustun.
  assert.equal(wavdanPcm(xom, { tur: 'audio/l16;rate=16000', chastota: 22050 }).chastota, 22050);
  assert.throws(() => wavdanPcm(xom, { tur: 'audio/mpeg' }), /kutilmagan \(audio\/mpeg\)/);
  assert.throws(() => wavdanPcm(Buffer.concat([Buffer.from('ID3'), xom])), /PCM yoki WAV kerak/);
  assert.throws(() => wavdanPcm(Buffer.concat([Buffer.from('OggS'), xom])), /PCM yoki WAV kerak/);
  assert.throws(() => wavdanPcm(xom, { tur: 'audio/l16;rate=96000' }), /chastotasi noto'g'ri/);
  assert.throws(() => wavdanPcm(xom, { tur: 'audio/l16', kanal: 2 }), /mono 16-bit PCM emas/);
  // WAV sarlavhasi bor bo'lsa — javob nima desa ham sarlavhaga ishoniladi.
  assert.equal(wavdanPcm(wav(pcm, 16000), { tur: 'audio/mpeg', chastota: 8000, kanal: 2 }).chastota, 16000);
});

test('ovozSora: so\'rov shakli, kalit sarlavhada; model topilmasa — zaxiradagisi', async () => {
  const sorovlar = [];
  const olib = async (manzil, s) => {
    sorovlar.push({ manzil, ...s, body: JSON.parse(s.body) });
    return sorovlar.length === 1
      ? { ok: false, status: 404, json: async () => ({ error: { message: 'models/x is not found' } }) }
      : { ok: true, status: 200, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: Buffer.from('salom').toString('base64') }] }] }) };
  };
  const r = await ovozSora('KALIT', 'Birinchi gap.\n\nIkkinchi gap.', { olib });
  assert.equal(r.bufer.toString(), 'salom');
  assert.equal(r.tur, 'audio/wav');
  assert.deepEqual(sorovlar.map(s => s.body.model), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  const s = sorovlar[0];
  assert.equal(s.manzil, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(s.headers['x-goog-api-key'], 'KALIT');
  assert.equal(s.body.input[0].content[0].text, 'Birinchi gap.\n\nIkkinchi gap.');
  assert.equal(s.body.input[0].content[0].annotations[0].type, 'speech_metadata');
  assert.deepEqual(s.body.response_format, { type: 'audio' });
  assert.equal(typeof s.body.generation_config.speech_config[0].voice, 'string');
});

test('ovozSora: xatolar tushunarli matnga aylanadi', async () => {
  const xato = (status, message) => ovozSora('K', 'matn', { olib: soxtaJavob(status, { error: { message } }) });
  await assert.rejects(xato(403, 'PERMISSION_DENIED'), { status: 503, message: /kaliti ovoz yozishga ruxsat bermadi/ });
  await assert.rejects(xato(429, 'RESOURCE_EXHAUSTED'), { status: 429, message: /limiti tugadi/ });
  await assert.rejects(xato(503, 'overloaded'), { status: 503, message: /hozir band/ });
  await assert.rejects(xato(404, 'model not found'), { status: 503, message: /Ovoz modeli topilmadi/ });
  await assert.rejects(xato(400, 'User location is not supported'), { status: 503, message: /hududda/ });
  await assert.rejects(xato(400, 'bad request body'), /javob bermadi: bad request body/);
  await assert.rejects(ovozSora('K', 'matn', { olib: soxtaJavob(200, { steps: [] }) }), /ovoz qaytarmadi/);
  await assert.rejects(ovozSora('K', 'matn', { olib: async () => { throw new TypeError('fetch failed'); } }), /ulanib bo'lmadi/);
  await assert.rejects(ovozSora('K', 'matn', { olib: async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } }), { status: 504 });
  // Kutish vaqti javob tanasi o'qilayotganda tugasa ham — 504 (ovoz yo'q deb emas).
  const tanadaUzildi = async () => ({ ok: true, status: 200, json: async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } });
  await assert.rejects(ovozSora('K', 'matn', { olib: tanadaUzildi }), { status: 504 });
  // JSON bo'lmagan xato tanasi: HTTP holati bo'yicha tasniflanadi.
  const htmlXato = async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  await assert.rejects(ovozSora('K', 'matn', { olib: htmlXato }), { status: 503, message: /hozir band/ });
});

test('nutqniOvozga: bitta so\'rov, MP3 va har qadamga chegara', async (t) => {
  t.after(() => soxtaOvozniQoy(null));
  let kelgan = null;
  soxtaOvozniQoy(async (s) => { kelgan = s; return { pcm: ovoz([[3, 'gap'], [0.6, 'jim'], [5, 'gap'], [0.6, 'jim'], [2, 'gap']]), chastota: CHASTOTA }; });
  assert.equal(ovozTayyormi(), true);
  const r = await nutqniOvozga([{ nutq: 'a'.repeat(40) }, { nutq: 'b'.repeat(66) }, { nutq: 'c'.repeat(27) }]);
  assert.equal(kelgan.nutqlar.length, 3);
  assert.equal(kelgan.matn.split('\n\n').length, 3);
  assert.equal(r.chegaralar.length, 4);
  assert.ok(Math.abs(r.chegaralar[1] - 3.54) < 0.05 && Math.abs(r.chegaralar[2] - 9.14) < 0.05);
  assert.ok(Math.abs(r.davomiylik - 11.2) < 0.01);
  assert.equal(r.mp3[0], 0xff);
});

test('nutqniOvozga: nutqsiz qadam, juda qisqa ovoz va kalitsiz holat — xato', async (t) => {
  t.after(() => soxtaOvozniQoy(null));
  soxtaOvozniQoy(async () => ({ pcm: ovoz([[0.1, 'gap']]), chastota: CHASTOTA }));
  await assert.rejects(nutqniOvozga([{ nutq: 'Bor.' }, { nutq: ' ' }]), { status: 400 });
  await assert.rejects(nutqniOvozga([]), { status: 400 });
  await assert.rejects(nutqniOvozga([{ nutq: 'Bor.' }]), /juda qisqa/);
  // Uzunligi matnga mos kelmaydigan ovoz (yarmida uzilgan yoki noto'g'ri o'qilgan) saqlanmaydi.
  const uzunMatn = [{ nutq: 'so\'z '.repeat(80) }, { nutq: 'gap '.repeat(80) }];
  soxtaOvozniQoy(async () => ({ pcm: ovoz([[4, 'gap']]), chastota: CHASTOTA }));
  await assert.rejects(nutqniOvozga(uzunMatn), /uzunligi matnga mos kelmadi/);
  soxtaOvozniQoy(async () => ({ pcm: ovoz([[40, 'gap']]), chastota: CHASTOTA }));
  await assert.rejects(nutqniOvozga([{ nutq: 'Qisqa gap.' }, { nutq: 'Yana biri.' }]), /uzunligi matnga mos kelmadi/);
  soxtaOvozniQoy(null);
  const eski = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY];
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  t.after(() => { if (eski[0]) process.env.GEMINI_API_KEY = eski[0]; if (eski[1]) process.env.GOOGLE_API_KEY = eski[1]; });
  assert.equal(aiBilan('', ovozTayyormi), false);
  await assert.rejects(aiBilan('', () => nutqniOvozga([{ nutq: 'Bor.' }])), { status: 503, message: /AI yoqilmagan/ });
});
