// Safari (MacBook) ovoz yozuvi → WAV (lib/wavKodla.js) va uni server qabul qilishi (lib/ovozdanMatn.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pastlat, wavYasa, WAV_CHASTOTA } from '../lib/wavKodla.js';
import { audioQismi, AUDIO_MAX } from '../lib/ovozdanMatn.js';

test('48 kHz → 16 kHz: uzunlik uchdan bir, o\'rtacha qiymat saqlanadi', () => {
  const bolaklar = [new Float32Array(4800).fill(0.5), new Float32Array(4800).fill(0.5)];
  const r = pastlat(bolaklar, 48000);
  assert.equal(r.length, 3200);
  assert.ok(r.every(x => Math.abs(x - 0.5) < 1e-6));
});

test('44,1 kHz (butun bo\'linmaydigan nisbat) ham to\'g\'ri uzunlikda', () => {
  const r = pastlat([new Float32Array(44100)], 44100);
  assert.equal(r.length, 16000);
});

test('WAV sarlavhasi: RIFF/WAVE, PCM, mono, 16 kHz, 16 bit, ma\'lumot uzunligi', () => {
  const b = wavYasa(new Float32Array([0, 1, -1, 2]));
  const v = new DataView(b.buffer);
  const matn = (joy) => String.fromCharCode(...b.slice(joy, joy + 4));
  assert.equal(matn(0), 'RIFF');
  assert.equal(matn(8), 'WAVE');
  assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), WAV_CHASTOTA);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), 8);
  assert.equal(b.length, 52);
  // Chegaradan oshgan namuna kesiladi.
  assert.deepEqual([1, 2, 3].map(i => v.getInt16(44 + i * 2, true)), [32767, -32768, 32767]);
});

test('server WAV ni qabul qiladi; 60 soniyalik yozuv hajm chegarasiga sig\'adi', () => {
  const ikkiSoniya = wavYasa(new Float32Array(2 * WAV_CHASTOTA).map((_, i) => Math.sin(i / 10) * 0.3));
  const q = audioQismi(`data:audio/wav;base64,${Buffer.from(ikkiSoniya).toString('base64')}`);
  assert.equal(q.inlineData.mimeType, 'audio/wav');
  assert.ok(44 + 60 * WAV_CHASTOTA * 2 <= AUDIO_MAX);
});
