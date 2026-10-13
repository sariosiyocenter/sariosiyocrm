// Video dars yo'llari (routes/imtihonDars.js) — haqiqiy Express, lekin soxta baza, soxta AI va
// soxta Storage bilan: tuzish → saqlash → ovoz → tasdiqlash → o'chirish, ruxsatlar va chekka holatlar.
//   npm test   (modul almashtirish uchun --experimental-test-module-mocks kerak)
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const ASOS = 'https://sinov.supabase.co';
process.env.SUPABASE_URL = ASOS;
delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_API_KEY;

// --- Soxta baza -------------------------------------------------------------

const baza = { savollar: new Map(), darslar: new Map() };
let soat = 0;
const yoz = (id, d) => { const y = { ...d, updatedAt: new Date(++soat) }; baza.darslar.set(id, y); return y; };
const prisma = {
  question: {
    findUnique: async ({ where }) => {
      const q = baza.savollar.get(where.id);
      return q ? { ...q, passage: null, lesson: baza.darslar.get(q.id) ?? null } : null;
    },
  },
  questionLesson: {
    upsert: async ({ where, create, update }) => yoz(where.questionId, baza.darslar.has(where.questionId) ? { ...baza.darslar.get(where.questionId), ...update } : create),
    update: async ({ where, data }) => yoz(where.questionId, { ...baza.darslar.get(where.questionId), ...data }),
    updateMany: async ({ where, data }) => {
      const eski = baza.darslar.get(where.questionId);
      if (!eski || eski.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
      yoz(where.questionId, { ...eski, ...data });
      return { count: 1 };
    },
    findUnique: async ({ where }) => baza.darslar.get(where.questionId) ?? null,
    delete: async ({ where }) => { baza.darslar.delete(where.questionId); },
  },
};

// --- Soxta kirish, kalit va Storage -----------------------------------------

const TAHRIRCHI = { user: { id: 5, schoolId: 1, organizationId: 1 }, ruxsat: { daraja: { 'imtihonlar.savollar': 2 } } };
const holat = { ...TAHRIRCHI, kalit: 'KALIT' };
const yol = (nisbiy) => new URL(nisbiy, import.meta.url).href;
mock.module(yol('../lib/prisma.js'), { defaultExport: prisma, namedExports: { prisma } });
mock.module(yol('../middleware/auth.js'), {
  namedExports: {
    authenticate: (req, _res, next) => { req.user = holat.user; req.ruxsat = holat.ruxsat; next(); },
    sameOrganization: async (user, schoolId) => schoolId === user.schoolId,
  },
});
mock.module(yol('../routes/imtihonAI.js'), { namedExports: { markazKaliti: async () => holat.kalit } });

const fayllar = new Set();
const storage = {
  yuklashXato: false,
  from: () => ({
    upload: async (nom) => { if (storage.yuklashXato) return { error: new Error('Storage ishlamayapti') }; fayllar.add(nom); return { error: null }; },
    getPublicUrl: (nom) => ({ data: { publicUrl: `${ASOS}/storage/v1/object/public/uploads/${nom}` } }),
    remove: async (nomlar) => { nomlar.forEach(n => fayllar.delete(n)); return { error: null }; },
  }),
};

const { soxtaModelniQoy } = await import('../lib/imtihonAI.js');
const { soxtaOvozniQoy, CHASTOTA } = await import('../lib/darsOvoz.js');
const { yechimIzi } = await import('../lib/imtihonDars.js');
const { registerImtihonDarsRoutes } = await import('../routes/imtihonDars.js');

const app = express();
app.use(express.json());
registerImtihonDarsRoutes(app, { storage });
app.use((err, _req, res, _next) => res.status(500).json({ error: String(err?.message || err) }));
const server = app.listen(0);
test.after(() => server.close());

async function soro(method, oxiri, body, id = '42') {
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/questions/${id}${oxiri}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, j: await r.json().catch(() => null) };
}

// --- Sinov ma'lumoti ---------------------------------------------------------

const SAVOL = {
  id: 42, schoolId: 1, type: 'yopiq', language: 'uz', text: '<p>$x^2-5x+6=0$ ning katta ildizi?</p>', options: ['2', '3', '5', '6'],
  correctAnswer: 'B', solution: '<p>$x_1 = 2$, $x_2 = 3$. Katta ildiz 3.</p>', solutionStatus: 'tasdiqlangan',
};
const QADAMLAR = [
  { sarlavha: 'Berilgan', doska: '$x^2-5x+6=0$', nutq: 'Bizga kvadrat tenglama berilgan, katta ildizini topamiz.' },
  { sarlavha: 'Ildizlar', doska: '$x_1 = 2,\\; x_2 = 3$', nutq: 'Tenglamaning ildizlari ikki va uch ekanini topamiz.' },
  { sarlavha: 'Javob', doska: 'Javob: $3$', nutq: 'Ikki ildizdan kattasi uch, demak javob uch.' },
];
/** Sun'iy ovoz: uch bo'lak gap, orasida 0,6 s pauza (jami 10,2 s). */
function uchBolakOvoz() {
  const bolak = (s, gap) => Array.from({ length: Math.round(s * CHASTOTA) }, (_, k) => (gap ? Math.round(9000 * Math.sin((2 * Math.PI * 220 * k) / CHASTOTA)) : 0));
  return { pcm: Int16Array.from([...bolak(3, true), ...bolak(0.6, false), ...bolak(3, true), ...bolak(0.6, false), ...bolak(3, true)]), chastota: CHASTOTA };
}

test.beforeEach(() => {
  baza.savollar.clear(); baza.darslar.clear(); fayllar.clear();
  baza.savollar.set(42, { ...SAVOL });
  Object.assign(holat, TAHRIRCHI, { kalit: 'KALIT' });
  storage.yuklashXato = false;
  soxtaModelniQoy(async () => ({ qadamlar: QADAMLAR }));
  soxtaOvozniQoy(async () => uchBolakOvoz());
});

test('to\'liq yo\'l: tuzish → saqlash → ovoz → tasdiqlash → qayta saqlash → o\'chirish', async () => {
  assert.deepEqual((await soro('GET', '/dars')).j, { dars: null, yechimBor: true, yechimTasdiqlangan: true });

  // AI tuzgani bazaga yozilmaydi.
  const taklif = await soro('POST', '/dars/ai', { korsatma: 'Qisqaroq' });
  assert.equal(taklif.status, 200);
  assert.equal(taklif.j.qadamlar.length, 3);
  assert.deepEqual(taklif.j.ogohlar, []);
  assert.equal(baza.darslar.size, 0);

  // Saqlash: qoralama, ovozsiz, vaqtlari taxminiy.
  const saqlandi = await soro('PUT', '/dars', { qadamlar: taklif.j.qadamlar, korsatma: 'Qisqaroq' });
  assert.equal(saqlandi.status, 200);
  assert.equal(saqlandi.j.dars.status, 'qoralama');
  assert.equal(saqlandi.j.dars.ovoz, null);
  assert.equal(saqlandi.j.dars.eskirgan, false);
  assert.equal(baza.darslar.get(42).yechimIzi, yechimIzi(SAVOL));
  assert.equal(baza.darslar.get(42).createdById, 5);

  // Ovoz: fayl Storage'da, qadamlar ovozdagi haqiqiy vaqtga o'tadi.
  const ovozli = await soro('POST', '/dars/ovoz');
  assert.equal(ovozli.status, 200);
  assert.match(ovozli.j.dars.ovoz, /\/uploads\/dars_42_\d+_[0-9a-f]{12}\.mp3$/);
  assert.equal(fayllar.size, 1);
  assert.ok(Math.abs(ovozli.j.dars.davomiylik - 10.2) < 0.01);
  assert.ok(Math.abs(ovozli.j.dars.qadamlar[1].boshi - 3.54) < 0.06 && Math.abs(ovozli.j.dars.qadamlar[2].boshi - 7.14) < 0.06);
  const birinchiFayl = [...fayllar][0];

  // Tasdiqlash va tasdiqni olish.
  assert.equal((await soro('PUT', '/dars', { status: 'tasdiqlangan' })).j.dars.status, 'tasdiqlangan');
  assert.equal((await soro('PUT', '/dars', { status: 'qoralama' })).j.dars.status, 'qoralama');
  assert.equal((await soro('GET', '/dars')).j.dars.ovoz, ovozli.j.dars.ovoz);

  // Yangi ssenariy: eski ovoz unga mos emas — havolasi ham, fayli ham ketadi; dars yana qoralama.
  await soro('PUT', '/dars', { status: 'tasdiqlangan' });
  const qayta = await soro('PUT', '/dars', { qadamlar: QADAMLAR.slice(0, 2) });
  assert.equal(qayta.j.dars.ovoz, null);
  assert.equal(qayta.j.dars.status, 'qoralama');
  assert.equal(qayta.j.dars.qadamlar.length, 2);
  assert.equal(fayllar.has(birinchiFayl), false);

  // O'chirish: yozuv ham, ovoz fayli ham.
  await soro('POST', '/dars/ovoz');
  assert.equal(fayllar.size, 1);
  assert.deepEqual((await soro('DELETE', '/dars')).j, { dars: null, yechimBor: true, yechimTasdiqlangan: true });
  assert.equal(baza.darslar.size, 0);
  assert.equal(fayllar.size, 0);
  assert.equal((await soro('DELETE', '/dars')).status, 200);
});

test('ruxsat: ko\'ra oladigan xodim o\'qiydi, lekin o\'zgartira olmaydi; ruxsatsizi ko\'rmaydi ham', async () => {
  holat.ruxsat = { daraja: { 'imtihonlar.savollar': 1 } };
  assert.equal((await soro('GET', '/dars')).status, 200);
  for (const [method, oxiri, body] of [['POST', '/dars/ai', {}], ['PUT', '/dars', { qadamlar: QADAMLAR }], ['POST', '/dars/ovoz'], ['DELETE', '/dars']]) {
    const r = await soro(method, oxiri, body);
    assert.equal(r.status, 403, `${method} ${oxiri}`);
    assert.equal(r.j.ruxsat, true);
  }
  assert.equal(baza.darslar.size, 0);
  holat.ruxsat = { daraja: {} };
  assert.equal((await soro('GET', '/dars')).status, 403);
});

test('boshqa markaz savoli, yo\'q savol va noaniq id — «topilmadi»', async () => {
  baza.savollar.set(7, { ...SAVOL, id: 7, schoolId: 99 });
  for (const id of ['7', '1000', '042', '42abc']) {
    assert.equal((await soro('GET', '/dars', undefined, id)).status, 404, id);
    assert.equal((await soro('PUT', '/dars', { qadamlar: QADAMLAR }, id)).status, 404, id);
    assert.equal((await soro('POST', '/dars/ovoz', undefined, id)).status, 404, id);
    assert.equal((await soro('DELETE', '/dars', undefined, id)).status, 404, id);
  }
  assert.equal(baza.darslar.size, 0);
});

test('yechimsiz savolga dars tuzilmaydi va saqlanmaydi; noto\'g\'ri so\'rov — 400', async () => {
  baza.savollar.set(42, { ...SAVOL, solution: null, solutionStatus: 'yoq' });
  assert.match((await soro('POST', '/dars/ai', {})).j.error, /avval yechim/);
  const r = await soro('PUT', '/dars', { qadamlar: QADAMLAR });
  assert.equal(r.status, 400);
  assert.match(r.j.error, /avval yechim/);

  baza.savollar.set(42, { ...SAVOL });
  assert.match((await soro('PUT', '/dars', {})).j.error, /kerak/);
  assert.match((await soro('PUT', '/dars', { status: 'tasdiqlangan' })).j.error, /avval dars tuzdiring/);
  assert.match((await soro('PUT', '/dars', { qadamlar: [QADAMLAR[0]] })).j.error, /kamida 2 ta qadam/);
  assert.match((await soro('POST', '/dars/ovoz')).j.error, /avval dars tuzdiring/);
  assert.equal(baza.darslar.size, 0);
});

test('mijoz ovoz havolasini o\'zi qo\'ya olmaydi', async () => {
  const r = await soro('PUT', '/dars', { qadamlar: QADAMLAR, ovozUrl: 'https://yomon.example/x.mp3', ovoz: 'https://yomon.example/x.mp3', yechimIzi: 'soxta' });
  assert.equal(r.j.dars.ovoz, null);
  assert.equal(baza.darslar.get(42).ovozUrl, null);
  assert.equal(baza.darslar.get(42).yechimIzi, yechimIzi(SAVOL));
});

test('yechim yoki to\'g\'ri javob o\'zgarsa dars eskiradi va tasdiqlab bo\'lmaydi', async () => {
  await soro('PUT', '/dars', { qadamlar: QADAMLAR });
  baza.savollar.set(42, { ...SAVOL, correctAnswer: 'C' });
  assert.equal((await soro('GET', '/dars')).j.dars.eskirgan, true);
  const r = await soro('PUT', '/dars', { status: 'tasdiqlangan' });
  assert.equal(r.status, 400);
  assert.match(r.j.error, /qayta tuzdiring/);
  assert.equal(baza.darslar.get(42).status, 'qoralama');
  // Qayta saqlansa — yangi yechimga bog'lanadi va tasdiqlasa bo'ladi.
  await soro('PUT', '/dars', { qadamlar: QADAMLAR });
  assert.equal((await soro('PUT', '/dars', { status: 'tasdiqlangan' })).status, 200);
});

test('ovoz yozilayotganda dars o\'zgarsa — 409 va yangi fayl yetim qolmaydi', async () => {
  await soro('PUT', '/dars', { qadamlar: QADAMLAR });
  soxtaOvozniQoy(async () => {
    // Shu orada boshqa oynada dars qayta saqlandi.
    yoz(42, { ...baza.darslar.get(42), korsatma: 'boshqa' });
    return uchBolakOvoz();
  });
  const r = await soro('POST', '/dars/ovoz');
  assert.equal(r.status, 409);
  assert.match(r.j.error, /qayta yozdiring/);
  assert.equal(fayllar.size, 0);
  assert.equal(baza.darslar.get(42).ovozUrl, null);
});

test('Storage ishlamasa yoki AI kaliti bo\'lmasa — dars o\'zgarmaydi, xato tushunarli', async () => {
  await soro('PUT', '/dars', { qadamlar: QADAMLAR });
  storage.yuklashXato = true;
  const r = await soro('POST', '/dars/ovoz');
  assert.equal(r.status, 502);
  assert.match(r.j.error, /saqlanmadi/);
  assert.equal(baza.darslar.get(42).ovozUrl, null);

  storage.yuklashXato = false;
  soxtaOvozniQoy(null);
  soxtaModelniQoy(null);
  holat.kalit = '';
  assert.equal((await soro('POST', '/dars/ovoz')).status, 503);
  assert.equal((await soro('POST', '/dars/ai', {})).status, 503);
  assert.equal(fayllar.size, 0);
});
