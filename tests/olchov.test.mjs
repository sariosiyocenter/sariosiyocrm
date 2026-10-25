// Ish o'lchovi (routes/olchov.js, lib/olchov.js): brauzer yuborgan vaqtlar bitta yozuvga yig'iladi,
// boshqa xodimning yozuvi yangilanmaydi, ruxsatsiz joy va katta yozuv qabul qilinmaydi.
//   npm test   (modul almashtirish uchun --experimental-test-module-mocks kerak)
import test, { mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const baza = new Map();
const prisma = {
  ishOlchovi: {
    findUnique: async ({ where }) => baza.get(where.sessiya) ?? null,
    upsert: async ({ where, create, update }) => { baza.set(where.sessiya, baza.has(where.sessiya) ? { ...baza.get(where.sessiya), ...update } : create); },
    deleteMany: async () => ({ count: 0 }),
  },
};
const holat = { user: { id: 5, schoolId: 1 } };
const yol = (nisbiy) => new URL(nisbiy, import.meta.url).href;
mock.module(yol('../lib/prisma.js'), { defaultExport: prisma, namedExports: { prisma } });
mock.module(yol('../middleware/auth.js'), { namedExports: { authenticate: (req, _res, next) => { req.user = holat.user; next(); } } });

const { registerOlchovRoutes } = await import('../routes/olchov.js');
const { olchovniTekshir } = await import('../lib/olchov.js');
const app = express();
app.use(express.json({ limit: '3mb' }));
registerOlchovRoutes(app);
const server = app.listen(0);
after(() => server.close());

const yubor = (tana) => fetch(`http://127.0.0.1:${server.address().port}/api/olchov`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tana) });
const OLCHOV = (q = {}) => ({
  sessiya: 'abc12345-sinov', joy: 'fayldan-yuklash', sabab: 'oraliq', davom: 5000,
  xulosa: { engUzunQotish: 3200, qotishlar: 1, jamiQotish: 3200, bosqichlar: [{ nom: "AI o'qimoqda", davom: 40000 }] },
  bosqichlar: [{ nom: "Word hujjati o'qilmoqda", boshi: 10, davom: 900 }], qotishlar: [{ boshi: 500, davom: 3200, bosqich: "Word hujjati o'qilmoqda" }],
  hodisalar: [{ t: 1, nom: 'fayllar', tafsil: { fayllar: [{ tur: 'docx', kb: 812 }] } }], kontekst: { savollar: 40 }, ...q,
});

test('birinchi yuborish yozuv ochadi, keyingisi o\'shani yangilaydi', async () => {
  assert.equal((await yubor(OLCHOV())).status, 204);
  assert.equal(baza.get('abc12345-sinov').userId, 5);
  assert.equal((await yubor(OLCHOV({ sabab: 'yopildi', davom: 9000 }))).status, 204);
  assert.equal(baza.size, 1);
  assert.equal(baza.get('abc12345-sinov').malumot.sabab, 'yopildi');
  assert.equal(baza.get('abc12345-sinov').malumot.qotishlar[0].davom, 3200);
});

test('boshqa xodim birovning yozuvini yangilay olmaydi', async () => {
  holat.user = { id: 9, schoolId: 1 };
  try {
    assert.equal((await yubor(OLCHOV({ sabab: 'buzish' }))).status, 403);
    assert.equal(baza.get('abc12345-sinov').malumot.sabab, 'yopildi');
  } finally { holat.user = { id: 5, schoolId: 1 }; }
});

test('noto\'g\'ri joy yoki sessiya — 400', async () => {
  assert.equal((await yubor(OLCHOV({ joy: 'boshqa' }))).status, 400);
  assert.equal((await yubor(OLCHOV({ sessiya: '../x' }))).status, 400);
});

test('faqat kerakli maydonlar saqlanadi; ro\'yxatlar va hajm cheklangan', () => {
  const t = olchovniTekshir({ ...OLCHOV(), begona: 'x', bosqichlar: Array.from({ length: 500 }, (_, i) => ({ nom: 'b', boshi: i, davom: 1 })) });
  assert.equal(t.malumot.begona, undefined);
  assert.equal(t.malumot.bosqichlar.length, 300);
  assert.ok(olchovniTekshir({ ...OLCHOV(), kontekst: { katta: 'x'.repeat(70_000) } }).xato);
});
