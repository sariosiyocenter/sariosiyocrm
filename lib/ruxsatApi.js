// Qaysi API so'rovi qaysi bo'limning qaysi darajasini talab qiladi.
//
// Katalog va daraja ma'nosi — lib/ruxsatlar.js. Bu jadvalni middleware/auth.js
// `authenticate` har bir so'rovda o'qiydi: ruxsat yetmasa so'rov handlerga
// yetmay 403 bilan qaytadi. Jadvalda yo'q yo'l avvalgidek ochiq (masalan,
// /api/init — u o'zi ruxsatga qarab ma'lumotni qisqartiradi).
//
// Qoida shakllari:
//   k: 'modul.bolim'            — shu bo'lim, d darajada
//   k: ['a', 'b']               — ulardan biri yetarli (masalan, to'lovlarni
//                                 o'quvchi balansidan ham, Moliyadan ham ko'radi)
//   admin: true                 — faqat ADMIN (sozlanmaydi)
//   talab: async (req) => [...] — maydonlarga qarab: faqat haqiqatan
//                                 o'zgargan maydon uchun ruxsat so'raladi. Tahrir
//                                 oynalari butun yozuvni qaytarib yuboradi, shuning
//                                 uchun "maydon kelgan" emas, "qiymat o'zgargan"
//                                 muhim — aks holda o'qituvchi ismni tuzatolmay
//                                 qolardi, chunki forma narxni ham qayta jo'natadi.

import prisma from './prisma.js';

const ADMIN = { admin: true };
const T = (k, d = 2) => ({ k, d });

/** Ikki qiymat amalda bir xilmi (null/'' va raqam/satr farqi hisobga olinmaydi). */
function birXil(a, b) {
  const norm = v => (v === undefined || v === null || v === '' ? null : v instanceof Date ? v.toISOString() : v);
  const x = norm(a), y = norm(b);
  if (x === null || y === null) return x === y;
  if (typeof x === 'object' || typeof y === 'object') return JSON.stringify(x) === JSON.stringify(y);
  if (typeof x === 'number' || typeof y === 'number') return Number(x) === Number(y);
  if (typeof x === 'boolean' || typeof y === 'boolean') return String(x) === String(y);
  return String(x) === String(y);
}

function idOf(req, n = 2) {
  const id = parseInt(req.path.split('/').filter(Boolean)[n]);
  return Number.isInteger(id) ? id : null;
}

/**
 * Maydon → bo'lim xaritasi bo'yicha talablar. `joriy` — bazadagi yozuv,
 * `qolgani` — xaritada yo'q, lekin o'zgargan har qanday maydon uchun talab.
 */
function maydonTalablari(body, joriy, xarita, qolgani, etiborsiz = []) {
  const kerak = new Map();
  for (const [kalit, qiymat] of Object.entries(body || {})) {
    if (kalit === 'schoolId' || etiborsiz.includes(kalit)) continue;
    if (joriy && Object.prototype.hasOwnProperty.call(joriy, kalit) && birXil(qiymat, joriy[kalit])) continue;
    const t = Object.prototype.hasOwnProperty.call(xarita, kalit) ? xarita[kalit] : qolgani;
    if (!t) continue;
    kerak.set(JSON.stringify(t), t);
  }
  return [...kerak.values()];
}

// --- Maydonga qarab talab qiladigan yo'llar ---------------------------------

async function oquvchiTahriri(req) {
  const id = idOf(req);
  const joriy = id && await prisma.student.findUnique({
    where: { id },
    select: { balance: true, customPrices: true, payShare: true, groups: { select: { id: true } } },
  });
  const talab = maydonTalablari(req.body, joriy, {
    // Balans hisobdan kelib chiqadi; uni qo'lda yozish faqat adminda.
    balance: ADMIN,
    customPrices: T('oquvchilar.narx'),
    payShare: T('oquvchilar.kursHisobi'),
    groups: null, routeIds: null,
  }, T('oquvchilar.royxat'));
  if (Array.isArray(req.body?.groups) && joriy) {
    const eski = joriy.groups.map(g => g.id).sort((a, b) => a - b);
    const yangi = req.body.groups.map(Number).filter(Number.isInteger).sort((a, b) => a - b);
    if (JSON.stringify(eski) !== JSON.stringify(yangi)) talab.push(T('kurslar.tarkib'));
  }
  return talab;
}

async function kursTahriri(req) {
  const id = idOf(req);
  const joriy = id && await prisma.group.findUnique({ where: { id } });
  return maydonTalablari(req.body, joriy, {
    payType: T('kurslar.narx'), payValue: T('kurslar.narx'),
    // Kurs narxi (Course.price) shu so'rov bilan birga keladi.
    price: T('kurslar.narx'), coursePrice: T('kurslar.narx'),
  }, T('kurslar.malumot'), ['studentIds', 'students', 'courseName', 'id', 'createdAt']);
}

async function fanTahriri(req) {
  const id = idOf(req);
  const joriy = id && await prisma.course.findUnique({ where: { id } });
  return maydonTalablari(req.body, joriy, { price: T('kurslar.narx') }, T('kurslar.malumot'), ['id']);
}

async function xodimTahriri(req) {
  const id = idOf(req);
  const joriy = id && await prisma.user.findUnique({
    where: { id },
    select: { name: true, phone: true, photo: true, position: true, salary: true, role: true, email: true, status: true, workDays: true, kpiPercent: true, schoolId: true },
  });
  const talab = maydonTalablari(req.body, joriy, {
    salary: T('xodimlar.maosh'), kpiPercent: T('xodimlar.maosh'),
    workDays: T('xodimlar.davomat'),
    status: T('xodimlar.ochirish'),
    password: req.body?.password ? T('xodimlar.royxat') : null,
  }, T('xodimlar.royxat'), ['id', 'createdAt', 'teacherId', 'branchIds', 'schoolIds']);
  // Admin hisobini va admin/menejer lavozimini berishni faqat admin qiladi.
  const yangiRol = req.body?.role;
  if (joriy?.role === 'ADMIN' || (yangiRol && yangiRol !== joriy?.role && ['ADMIN', 'MANAGER'].includes(yangiRol))) talab.push(ADMIN);
  if (Array.isArray(req.body?.schoolIds)) talab.push(T('xodimlar.royxat'));
  return talab;
}

async function ustozTahriri(req) {
  const id = idOf(req);
  const joriy = id && await prisma.teacher.findUnique({ where: { id } });
  const talab = maydonTalablari(req.body, joriy, {
    salary: T('xodimlar.maosh'), sharePercentage: T('xodimlar.maosh'), lessonFee: T('xodimlar.maosh'), salaryType: T('xodimlar.maosh'),
    status: req.body?.status === 'Arxiv' || joriy?.status === 'Arxiv' ? T('xodimlar.ochirish') : T('xodimlar.royxat'),
  }, T('xodimlar.royxat'), ['id', 'userId', 'groups']);
  return talab;
}

const SOZLAMA_MAYDONLARI = {
  orgName: T('sozlamalar.profil'), logo: T('sozlamalar.profil'), adminPhone: T('sozlamalar.profil'), adminPhone2: T('sozlamalar.profil'),
  address: T('sozlamalar.profil'), centerLocation: T('sozlamalar.profil'), workingHours: T('sozlamalar.profil'),
  telegram: T('sozlamalar.integratsiya'), instagram: T('sozlamalar.integratsiya'),
  eskizEmail: T('sozlamalar.integratsiya'), eskizPassword: T('sozlamalar.integratsiya'), eskizFrom: T('sozlamalar.integratsiya'),
  billingDay: T('sozlamalar.avto'), multiCoursePay: T('sozlamalar.avto'),
  transportNotify: T('sozlamalar.avto'), transportChannel: T('sozlamalar.avto'),
};

async function sozlamaTahriri(req) {
  const schoolId = parseInt(req.body?.schoolId);
  const joriy = Number.isInteger(schoolId) ? await prisma.setting.findUnique({ where: { schoolId } }) : null;
  const body = { ...(req.body || {}) };
  // Bo'sh maxfiy maydon "o'zgarmadi" degani (server uni baribir tashlab yuboradi).
  for (const k of ['eskizPassword', 'telegram', 'paymeKey', 'paymeTestKey']) {
    if (body[k] !== undefined && String(body[k]).trim() === '') delete body[k];
  }
  const talab = [];
  for (const [kalit, qiymat] of Object.entries(body)) {
    if (!(kalit in (joriy || {})) && !(kalit in SOZLAMA_MAYDONLARI)) continue; // noma'lum/yordamchi maydon
    if (['id', 'schoolId', 'telegramWebhookSecret', 'paymeEndpointToken', 'createdAt', 'updatedAt'].includes(kalit)) continue;
    if (joriy && birXil(qiymat, joriy[kalit])) continue;
    // Payme va boshqa hamma narsa — faqat admin.
    talab.push(SOZLAMA_MAYDONLARI[kalit] || ADMIN);
  }
  return talab;
}

// --- Jadval -----------------------------------------------------------------

const Q = [];
function r(method, yol, qoida) {
  const re = new RegExp('^' + yol.replace(/:id/g, '\\d+').replace(/:any/g, '[^/]+') + '/?$');
  Q.push({ method, re, qoida });
}

// O'quvchilar
r('GET', '/api/students', { k: ['oquvchilar.royxat', 'kurslar.malumot', 'kunlik.korish', 'bosh.korsatkich'], d: 1 });
r('POST', '/api/students', T('oquvchilar.royxat'));
r('POST', '/api/students/import', T('oquvchilar.royxat'));
r('PUT', '/api/students/:id', { talab: oquvchiTahriri });
r('DELETE', '/api/students/:id', T('oquvchilar.ochirish'));
r('GET', '/api/students/:id/ledger', T('oquvchilar.balans', 1));
r('PUT', '/api/students/:id/transport', T('oquvchilar.royxat'));
r('POST', '/api/students/:id/kurs-hisob', {
  talab: req => [T('oquvchilar.kursHisobi'), ...(req.body?.price !== undefined ? [T('oquvchilar.narx')] : [])],
});
r('POST', '/api/students/:id/transfer', T('oquvchilar.kochirish'));
r('POST', '/api/students/:id/refund', T('oquvchilar.kochirish'));
r('POST', '/api/public/schools/:id/tokens', T('oquvchilar.royxat'));
r('GET', '/api/face-profiles', { k: ['kurslar.davomat', 'oquvchilar.royxat'], d: 1 });
r('POST', '/api/face-profiles', T('oquvchilar.royxat'));
r('DELETE', '/api/face-profiles/:id', T('oquvchilar.royxat'));
r('GET', '/api/scores', { k: ['oquvchilar.ballar', 'kurslar.davomat'], d: 1 });
r('POST', '/api/scores', T('oquvchilar.ballar'));

// Kurslar, fanlar
r('POST', '/api/groups', T('kurslar.malumot'));
r('PUT', '/api/groups/:id', { talab: kursTahriri });
r('DELETE', '/api/groups/:id', T('kurslar.ochirish'));
r('POST', '/api/groups/:id/students', T('kurslar.tarkib'));
r('DELETE', '/api/groups/:id/students/:id', T('kurslar.tarkib'));
r('POST', '/api/groups/:id/charge-quote', { k: ['kurslar.tarkib', 'oquvchilar.kursHisobi'], d: 2 });
r('POST', '/api/courses', T('kurslar.malumot'));
r('PUT', '/api/courses/:id', { talab: fanTahriri });
r('DELETE', '/api/courses/:id', T('kurslar.ochirish'));

// Davomat
r('GET', '/api/attendances', { k: ['kurslar.davomat', 'kunlik.korish', 'oquvchilar.royxat'], d: 1 });
r('POST', '/api/attendances', T('kurslar.davomat'));
r('PUT', '/api/attendances/:id', T('kurslar.davomat'));
r('PATCH', '/api/attendances/topic', T('kurslar.davomat'));
r('POST', '/api/attendances/batch', T('kurslar.davomat'));
r('DELETE', '/api/attendances/batch', T('kurslar.davomat'));
r('POST', '/api/attendances/notify', T('kurslar.davomat'));

// O'quv reja
r('POST', '/api/syllabuses', T('dastur.royxat'));
r('PUT', '/api/syllabuses/:id', T('dastur.royxat'));
r('DELETE', '/api/syllabuses/:id', T('dastur.ochirish'));
r('POST', '/api/topics', T('dastur.royxat'));
r('PUT', '/api/topics/:id', T('dastur.royxat'));
r('DELETE', '/api/topics/:id', T('dastur.ochirish'));

// Lidlar
r('GET', '/api/leads', { k: ['lidlar.royxat', 'bosh.hisobot'], d: 1 });
r('POST', '/api/leads', T('lidlar.royxat'));
r('PUT', '/api/leads/:id', T('lidlar.royxat'));
r('DELETE', '/api/leads/:id', T('lidlar.ochirish'));

// To'lovlar va moliya
r('GET', '/api/payments', { k: ['oquvchilar.balans', 'moliya.tolovlar', 'moliya.hisobot', 'bosh.pul'], d: 1 });
r('POST', '/api/payments', {
  // Chegirma — to'lov emas, narxni kamaytirish.
  talab: req => [req.body?.type === 'Chegirma' ? T('oquvchilar.narx') : T('oquvchilar.tolov')],
});
r('PUT', '/api/payments/:id', T('oquvchilar.tolovTuzatish'));
// O'chirish — tahrirlash bilan bir xil ruxsat va 10 daqiqa qoidasi (handlerda).
r('DELETE', '/api/payments/:id', T('oquvchilar.tolovTuzatish'));
// Klik to'lovi: xodim yuboradi, administrator tasdiqlaydi (handler ham tekshiradi).
r('GET', '/api/tolov-tasdiq', { k: ['oquvchilar.tolov', 'oquvchilar.balans', 'moliya.tolovlar'], d: 1 });
r('POST', '/api/tolov-tasdiq', T('oquvchilar.tolov'));
r('POST', '/api/tolov-tasdiq/:id/tasdiqlash', ADMIN);
r('POST', '/api/tolov-tasdiq/:id/rad', ADMIN);
r('GET', '/api/payme/orders', { k: ['oquvchilar.tolov', 'oquvchilar.balans'], d: 1 });
r('POST', '/api/payme/orders', T('oquvchilar.tolov'));
r('POST', '/api/payme/orders/:any/send', T('oquvchilar.tolov'));
r('POST', '/api/payme/orders/:any/cancel', T('oquvchilar.tolov'));
r('GET', '/api/payme/transactions', ADMIN);
r('GET', '/api/expenses', { k: ['moliya.xarajat', 'moliya.hisobot', 'bosh.pul'], d: 1 });
r('POST', '/api/expenses', T('moliya.xarajat'));
r('DELETE', '/api/expenses/:id', T('moliya.xarajat'));
r('GET', '/api/kassa', T('moliya.kassa', 1));
r('POST', '/api/kassa/handover', T('moliya.kassa'));
r('DELETE', '/api/kassa/handover/:id', T('moliya.kassa'));
r('POST', '/api/kassa/close', T('moliya.kassa'));
r('GET', '/api/billing/status', T('moliya.oylik', 1));
r('POST', '/api/billing/notify-debtors', T('moliya.oylik'));
r('POST', '/api/billing/process-month', ADMIN);
r('POST', '/api/billing/recalculate-month', ADMIN);

// Imtihonlar
r('GET', '/api/questions', T('imtihonlar.savollar', 1));
r('POST', '/api/questions', T('imtihonlar.savollar'));
r('POST', '/api/questions/bulk', T('imtihonlar.savollar'));
r('PUT', '/api/questions/:id', T('imtihonlar.savollar'));
r('DELETE', '/api/questions/:id', T('imtihonlar.ochirish'));
r('GET', '/api/exams', { k: ['imtihonlar.imtihon', 'imtihonlar.natija'], d: 1 });
r('POST', '/api/exams', T('imtihonlar.imtihon'));
r('PUT', '/api/exams/:id', T('imtihonlar.imtihon'));
r('DELETE', '/api/exams/:id', T('imtihonlar.ochirish'));
r('GET', '/api/exams/:id/assignments', { k: ['imtihonlar.imtihon', 'imtihonlar.natija'], d: 1 });
r('POST', '/api/exams/:id/assignments', T('imtihonlar.imtihon'));
r('DELETE', '/api/exams/:id/assignments/:id', T('imtihonlar.imtihon'));
r('GET', '/api/exam-results', { k: ['imtihonlar.natija', 'oquvchilar.ballar'], d: 1 });
r('POST', '/api/exam-results', T('imtihonlar.natija'));
r('DELETE', '/api/exam-results/:id', T('imtihonlar.ochirish'));

// Xodimlar
r('GET', '/api/users', { k: ['xodimlar.royxat', 'moliya.xarajat'], d: 1 });
r('POST', '/api/users', {
  talab: req => [T('xodimlar.royxat'), ...(['ADMIN', 'MANAGER'].includes(req.body?.role) ? [ADMIN] : [])],
});
r('PUT', '/api/users/:id', { talab: xodimTahriri });
r('DELETE', '/api/users/:id', T('xodimlar.ochirish'));
r('POST', '/api/teachers', T('xodimlar.royxat'));
r('PUT', '/api/teachers/:id', { talab: ustozTahriri });
r('DELETE', '/api/teachers/:id', T('xodimlar.ochirish'));
r('GET', '/api/staff-attendance', T('xodimlar.davomat', 1));
r('POST', '/api/staff-attendance', T('xodimlar.davomat'));
r('DELETE', '/api/staff-attendance', T('xodimlar.davomat'));
r('GET', '/api/teacher-attendances', T('xodimlar.davomat', 1));
r('POST', '/api/teacher-attendances', T('xodimlar.davomat'));
r('POST', '/api/teacher-attendances/notify', T('xodimlar.davomat'));
r('GET', '/api/salary-payments', T('xodimlar.maosh', 1));
r('POST', '/api/salary-payments', T('xodimlar.maosh'));
r('PUT', '/api/salary-payments/:id', T('xodimlar.maosh'));
r('DELETE', '/api/salary-payments/:id', T('xodimlar.maosh'));
r('GET', '/api/kpi-calculation', T('xodimlar.maosh', 1));
r('POST', '/api/admin/sync-teachers', ADMIN);

// Logistika
r('POST', '/api/transports', T('logistika.reja'));
r('PUT', '/api/transports/:id', T('logistika.reja'));
r('DELETE', '/api/transports/:id', T('logistika.reja'));
r('POST', '/api/routes', T('logistika.reja'));
r('PUT', '/api/routes/:id', T('logistika.reja'));
r('DELETE', '/api/routes/:id', T('logistika.reja'));
r('GET', '/api/logistics/waves', T('logistika.reja', 1));
r('GET', '/api/logistics/day', T('logistika.reja', 1));
r('PUT', '/api/logistics/drivers/:id/tarif', T('logistika.reja'));
r('POST', '/api/logistics/ask-drivers', T('logistika.reja'));
r('POST', '/api/logistics/daily-plan', T('logistika.reja'));
r('POST', '/api/logistics/plans', T('logistika.reja'));
r('POST', '/api/logistics/plans/:id/send', T('logistika.reja'));
r('POST', '/api/logistics/plans/:id/accept', T('logistika.reja'));
r('POST', '/api/logistics/plans/:id/deliver', T('logistika.reja'));
r('DELETE', '/api/logistics/plans/:id', T('logistika.reja'));
r('GET', '/api/route-runs', { k: ['logistika.reja', 'logistika.tarix'], d: 1 });
r('GET', '/api/logistics/stats', T('logistika.tarix', 1));
r('GET', '/api/delivery-logs', { k: ['logistika.reja', 'logistika.tarix'], d: 1 });
r('POST', '/api/delivery-logs', T('logistika.reja'));

// Xabarlar
r('POST', '/api/sms/send', T('xabarlar.yuborish'));
r('POST', '/api/sms/attendance', T('xabarlar.yuborish'));
r('POST', '/api/messaging/send-batch', T('xabarlar.yuborish'));
r('GET', '/api/sms/logs', T('xabarlar.tarix', 1));
r('GET', '/api/sms/check-status/:any', T('xabarlar.tarix', 1));
r('POST', '/api/sms/resend-failed', T('xabarlar.tarix'));
r('GET', '/api/sms/test-connection', T('sozlamalar.integratsiya', 1));
r('GET', '/api/messaging/campaigns', T('xabarlar.tarix', 1));
r('GET', '/api/messaging/templates', { k: ['xabarlar.shablon', 'xabarlar.yuborish'], d: 1 });
r('POST', '/api/messaging/templates', T('xabarlar.shablon'));
r('PUT', '/api/messaging/templates/:id', T('xabarlar.shablon'));
r('DELETE', '/api/messaging/templates/:id', T('xabarlar.shablon'));
r('GET', '/api/messaging/auto-rules', { k: ['xabarlar.avto', 'sozlamalar.avto'], d: 1 });
r('POST', '/api/messaging/auto-rules', T('xabarlar.avto'));
r('PUT', '/api/messaging/auto-rules/:id', T('xabarlar.avto'));
r('DELETE', '/api/messaging/auto-rules/:id', T('xabarlar.avto'));

// Sozlamalar
r('PUT', '/api/settings', { talab: sozlamaTahriri });
r('POST', '/api/rooms', T('sozlamalar.xonalar'));
r('PUT', '/api/rooms/:id', T('sozlamalar.xonalar'));
r('DELETE', '/api/rooms/:id', T('sozlamalar.xonalar'));
r('POST', '/api/directions', T('sozlamalar.xonalar'));
r('PUT', '/api/directions/:id', T('sozlamalar.xonalar'));
r('DELETE', '/api/directions/:id', T('sozlamalar.xonalar'));
r('POST', '/api/schools', ADMIN);
r('PUT', '/api/schools/:id', ADMIN);
r('DELETE', '/api/schools/:id', ADMIN);
r('POST', '/api/payme/rotate-endpoint', ADMIN);
r('GET', '/api/payme/logs', ADMIN);
r('GET', '/api/telegram-setup', ADMIN);

// Jurnal va ruxsatlarning o'zi
r('GET', '/api/audit-logs', T('jurnal.korish', 1));
r('GET', '/api/permissions', ADMIN);
r('PUT', '/api/permissions', ADMIN);

/** Test va hujjat uchun: jadvaldagi hamma qoida. */
export const API_QOIDALARI = Q;

/**
 * So'rov uchun talablar ro'yxati: [{k, d} | {admin: true}], har biri bajarilishi
 * kerak (`k` massiv bo'lsa — birortasi). Jadvalda yo'q so'rov uchun [].
 */
export async function soroqTalablari(req) {
  const qoida = Q.find(x => x.method === req.method && x.re.test(req.path))?.qoida;
  if (!qoida) return [];
  if (qoida.talab) return (await qoida.talab(req)) || [];
  return [qoida];
}
