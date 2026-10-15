// Video yechim yo'llarining ruxsati (lib/ruxsatApi.js). Jadvalda yo'q yo'l HECH QANDAY ruxsat
// talab qilmaydi — shuning uchun beshala yo'l ham ro'yxatda turishi shu yerda qotiriladi.
//   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { soroqTalablari } from '../lib/ruxsatApi.js';

const talab = (method, path) => soroqTalablari({ method, path, body: {} });
const BOLIM = 'imtihonlar.savollar';

test('video yechimni ko\'rish — savollar bo\'limini ko\'ra oladiganga (1-daraja)', async () => {
  assert.deepEqual(await talab('GET', '/api/questions/42/dars'), [{ k: BOLIM, d: 1 }]);
  assert.deepEqual(await talab('HEAD', '/api/questions/42/dars'), [{ k: BOLIM, d: 1 }]);
});

test('video yechimni tuzish, saqlash, ovoz yozdirish va o\'chirish — o\'zgartira oladiganga (2-daraja)', async () => {
  for (const [method, oxiri] of [['POST', '/dars/ai'], ['PUT', '/dars'], ['POST', '/dars/ovoz'], ['DELETE', '/dars']]) {
    assert.deepEqual(await talab(method, `/api/questions/42${oxiri}`), [{ k: BOLIM, d: 2 }], `${method} ${oxiri}`);
    // Oxiridagi slash va "042" kabi id ham shu qoidaga tushadi (handler uni baribir rad etadi).
    assert.deepEqual(await talab(method, `/api/questions/042${oxiri}/`), [{ k: BOLIM, d: 2 }], `${method} 042${oxiri}/`);
  }
});

test('ovozli ko\'rsatmani matnga o\'girish — o\'zgartira oladiganga (2-daraja)', async () => {
  assert.deepEqual(await talab('POST', '/api/ai/ovozdan-matn'), [{ k: BOLIM, d: 2 }]);
});
