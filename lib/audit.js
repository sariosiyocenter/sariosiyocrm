// Amallar jurnali — kim, qachon, nimani kiritdi, o'zgartirdi yoki o'chirdi.
//
// Rahbar (2026-09-16): "loglar jurnali. kim nima kiritgan, kim nima o'zgartirgan".
//
// Qanday ishlaydi. Har bir o'zgartiruvchi API so'rovi (POST/PUT/PATCH/DELETE) shu
// middleware'dan o'tadi:
//   1. Handler ishlashidan OLDIN tahrirlanadigan/o'chiriladigan yozuvning joriy
//      holati o'qiladi.
//   2. Handler `res.json()` ni chaqirganda javob darhol ketmaydi: avval yozuvning
//      yangi holati o'qiladi, farq maydonma-maydon hisoblanadi va jurnalga yoziladi,
//      shundan keyin javob yuboriladi. Vercel javob ketishi bilan funksiyani
//      to'xtatadi — keyinga qoldirilgan yozuv yo'qolib qolardi.
//   3. Jurnalga yozib bo'lmasa ham asosiy amal buzilmaydi: xato logga tushadi,
//      javob ko'pi bilan JURNAL_MS kutib, baribir ketadi.
//
// Faqat muvaffaqiyatli (status < 400) amallar yoziladi: tizimga kirgan xodimniki
// yoki onlayn ariza formasi. Parol, kalit va tokenlar qiymati hech qachon yozilmaydi.

import prisma from './prisma.js';
import { tarifMatni } from './transportNarx.js';

const JURNAL_MS = 2500;

// ---------------------------------------------------------------------------
// Bo'limlar. `model` — oldingi/keyingi holatni o'qish uchun Prisma modeli.
// Egasining atamalari: kurs = Group, fan = Course ("guruh" demaymiz).
// ---------------------------------------------------------------------------
export const ENTITIES = {
  student:           { label: "O'quvchi", model: 'student' },
  payment:           { label: "To'lov", model: 'payment' },
  tolovTasdiq:       { label: "To'lov tasdig'i", model: 'tolovTasdiq' },
  attendance:        { label: 'Davomat', model: 'attendance' },
  group:             { label: 'Kurs', model: 'group' },
  course:            { label: 'Fan', model: 'course' },
  user:              { label: 'Xodim', model: 'user' },
  teacher:           { label: "O'qituvchi", model: 'teacher' },
  lead:              { label: 'Lid', model: 'lead' },
  expense:           { label: 'Xarajat', model: 'expense' },
  salaryPayment:     { label: 'Oylik', model: 'salaryPayment' },
  staffAttendance:   { label: 'Xodim davomati', model: 'staffAttendance' },
  teacherAttendance: { label: "O'qituvchi davomati", model: 'teacherAttendance' },
  kassa:             { label: 'Kassa', model: 'cashHandover' },
  score:             { label: 'Baho', model: 'score' },
  exam:              { label: 'Imtihon', model: 'exam' },
  examResult:        { label: 'Imtihon natijasi', model: 'examResult' },
  question:          { label: 'Savol', model: 'question' },
  passage:           { label: 'Savol matni', model: 'passage' },
  topic:             { label: 'Mavzu', model: 'topic' },
  syllabus:          { label: "O'quv reja", model: 'syllabus' },
  room:              { label: 'Xona', model: 'room' },
  direction:         { label: "Yo'nalish", model: 'direction' },
  message:           { label: 'Xabar' },
  messageTemplate:   { label: 'Xabar shabloni', model: 'messageTemplate' },
  autoMessageRule:   { label: 'Avto xabar', model: 'autoMessageRule' },
  transport:         { label: 'Transport', model: 'transport' },
  route:             { label: 'Marshrut', model: 'route' },
  logistics:         { label: 'Logistika' },
  billing:           { label: 'Hisob-kitob' },
  payme:             { label: 'Payme' },
  setting:           { label: 'Sozlamalar', model: 'setting' },
  school:            { label: 'Filial', model: 'school' },
  organization:      { label: 'Tashkilot', model: 'organization' },
  saasLead:          { label: 'SaaS lid', model: 'saaSLead' },
  auth:              { label: 'Hisob' },
  other:             { label: 'Boshqa' },
};

export const ACTIONS = { create: "Qo'shdi", update: "O'zgartirdi", delete: "O'chirdi", action: 'Bajardi' };

// ---------------------------------------------------------------------------
// Maydonlar
// ---------------------------------------------------------------------------
const FIELD_LABELS = {
  name: 'Ism', phone: 'Telefon', birthDate: "Tug'ilgan sana", address: 'Manzil', location: 'Joylashuv',
  status: 'Holat', joinedDate: 'Kelgan sana', balance: 'Balans', photo: 'Rasm', comment: 'Izoh',
  rating: 'Reyting', telegramId: 'Telegram', fatherTelegramId: 'Otasining Telegrami',
  motherTelegramId: 'Onasining Telegrami', fatherName: 'Otasi', fatherPhone: 'Otasining telefoni',
  motherName: 'Onasi', motherPhone: 'Onasining telefoni', privilegeType: 'Imtiyoz',
  certCategory: 'Sertifikat toifasi', certSubject: 'Sertifikat fani', certType: 'Sertifikat turi',
  certScore: 'Sertifikat bali', customPrices: 'Maxsus narx', certificates: 'Sertifikatlar',
  payShare: "To'lov taqsimoti", attendsExam: 'Imtihonga keladi', courseStart: 'Kursga kelgan sana',
  gender: 'Jinsi', leaveReason: 'Ketish sababi', needsTransport: 'Transportda qatnaydi',
  transportId: 'Transport', studentSchool: 'Maktab', orgType: 'Muassasa turi', region: 'Viloyat',
  district: 'Tuman', studyGoal: 'Maqsad', directionId: "Yo'nalish", groups: 'Kurslar',
  email: 'Email', position: 'Lavozim', salary: 'Oylik', role: 'Rol', workDays: 'Ish kunlari',
  kpiPercent: 'KPI foizi', schoolId: 'Filial', password: 'Parol', phone2: 'Ikkinchi telefon', telegramId2: 'Ikkinchi Telegram',
  teacherId: 'Ustoz', courseId: 'Fan', schedule: 'Vaqt', days: 'Kunlar', room: 'Xona',
  syllabusId: "O'quv reja", payType: 'Ustoz haqi turi', payValue: 'Ustoz haqi', students: "O'quvchilar",
  price: 'Narx', amount: 'Summa', type: 'Turi', date: 'Sana', description: 'Izoh', groupId: 'Kurs',
  studentId: "O'quvchi", userId: 'Xodim', category: 'Toifa', method: "To'lov usuli",
  course: 'Kurs', source: 'Manba', preferredTime: 'Qulay vaqt', notes: 'Izoh',
  capacity: "Sig'imi", model: 'Modeli', number: 'Davlat raqami', driverName: 'Haydovchi',
  driverPhone: 'Haydovchi telefoni', driverId: 'Haydovchi', startTime: 'Chiqish vaqti',
  direction: "Yo'nalish", title: 'Nomi', order: 'Tartib', moduleName: 'Modul', hours: 'Soat',
  materials: 'Materiallar', month: 'Oy', baseSalary: 'Asosiy oylik', bonuses: 'Bonus', fines: 'Ushlanma',
  note: 'Izoh', value: 'Baho', topicId: 'Mavzu', caughtUp: "O'zlashtirdi", toWhom: 'Kimga',
  orgName: 'Markaz nomi', logo: 'Logotip', adminPhone: 'Admin telefoni', adminPhone2: "Qo'shimcha raqam", centerLocation: 'Markaz joylashuvi',
  transportNotify: 'Transport xabarlari', transportChannel: 'Transport xabar kanali',
  telegram: 'Telegram bot tokeni', instagram: 'Instagram', workingHours: 'Ish vaqti',
  eskizEmail: 'Eskiz email', eskizPassword: 'Eskiz paroli', eskizFrom: "SMS jo'natuvchi",
  paymeMerchantId: 'Payme kassa ID', paymeKey: 'Payme kaliti', paymeTestKey: 'Payme test kaliti',
  paymeMode: 'Payme rejimi', paymeScheme: 'Payme hisob maydonlari', paymeAllowRefund: 'Payme qaytarish',
  paymeIpCheck: 'Payme IP tekshiruvi', paymeMxik: 'MXIK kodi', paymePackageCode: 'Qadoq kodi',
  paymeVatPercent: 'QQS foizi', subjects: 'Fanlar', text: 'Matn', body: 'Matn', enabled: 'Yoqilgan',
  time: 'Vaqt', channel: 'Kanal', recipientTo: 'Kimga', duration: 'Davomiyligi (daqiqa)',
  score: 'Ball', percentage: 'Foiz', difficulty: 'Qiyinlik', subject: 'Fan', correctAnswer: "To'g'ri javob",
  maxSchools: 'Filiallar chegarasi', expiresAt: 'Obuna muddati', centerName: 'Markaz nomi',
  autoOrder: 'Avto tartib', navbat: 'Navbat', tolqin: "To'lqin", autoTime: 'Yuborish vaqti',
  autoType: 'Avto turi', autoChannel: 'Avto kanal', autoRecipient: 'Avto oluvchi', isAuto: 'Avtomatik',
  lessonFee: 'Dars haqi', sharePercentage: 'Ulush foizi', salaryType: 'Oylik turi', hiredDate: 'Ishga kirgan sana',
  scoring: 'Ball tizimi', branchIds: 'Filiallar', options: 'Variantlar', points: 'Ball', lockOptions: 'Javoblar aralashmaydi',
  section: "Bo'lim", grade: 'Sinf', language: 'Til', solution: 'Yechim', solutionStatus: 'Yechim holati',
  passageId: 'Matn', topic: 'Mavzu', rows: 'Qatorlar', cols: "Qatordagi o'rinlar", blocked: "Band o'rinlar",
  totalQuestions: 'Savollar soni', maxScore: 'Eng yuqori ball', reviewStatus: 'Tekshiruv holati', variantCode: 'Variant',
};

// Qiymati hech qachon jurnalga tushmaydi — faqat "o'zgartirildi".
const SECRET_FIELDS = new Set([
  'password', 'eskizPassword', 'telegram', 'paymeKey', 'paymeTestKey',
  'telegramWebhookSecret', 'paymeEndpointToken',
]);
// Rasmlar — URL emas, "yangilandi".
const IMAGE_FIELDS = new Set(['photo', 'logo', 'imageUrl']);
// Tizimning o'zi yuritadigan yoki juda katta maydonlar.
const OMIT_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'statusChangedAt', 'studentIds', 'descriptor', 'blocks', 'variants', 'tgXabarlar',
  'answers', 'blockScores', 'account', 'organizationId', 'lastRunDate', 'autoPlanned',
  'eskizStatus', 'eskizTemplateId', 'teacherProfile', 'routeStops', 'scannedAt', 'askedAt',
  'answeredAt', 'expenseId', 'paidAt', 'markedAt', 'markedById', 'createdById', 'closedById',
  // Imtihon: katta JSON va tizim yuritadigan maydonlar.
  'settings', 'seed', 'lockedAt', 'publishedAt', 'publishedById', 'raw', 'flags', 'manual', 'pages', 'detail',
  'reviewedAt', 'reviewedById', 'notifiedAt', 'notifyStatus', 'rank', 'rankBranch', 'rankGroup', 'usedCount',
  'lastUsedAt', 'shownAt', 'pCorrect', 'discrimination', 'session', 'seatId',
]);
const MONEY_FIELDS = new Set([
  'amount', 'balance', 'salary', 'price', 'payValue', 'baseSalary', 'bonuses', 'fines',
  'expected', 'counted', 'lessonFee',
]);
// Boshqa jadvalga havola — raqam o'rniga nomi ko'rsatiladi.
const REFS = {
  teacherId: 'teacher', courseId: 'course', groupId: 'group', studentId: 'student', room: 'room',
  directionId: 'direction', transportId: 'transport', schoolId: 'school', userId: 'user',
  driverId: 'user', syllabusId: 'syllabus', topicId: 'topic',
};
const LIST_REFS = { groups: 'group', students: 'student' };

const ROLE_LABELS = {
  ADMIN: 'Admin', MANAGER: 'Menejer', TEACHER: "O'qituvchi", SUPPORT_TEACHER: "Yordamchi o'qituvchi",
  RECEPTIONIST: 'Resepshn', DRIVER: 'Haydovchi', TECH_STAFF: 'Texnik xodim', SELLER: 'Sotuvchi',
  SUPERADMIN: 'Super admin',
};
const DAY_LABELS = { TOQ: 'Toq kunlar', JUFT: 'Juft kunlar', HAR_KUNI: 'Har kuni', Belgilanmagan: 'Belgilanmagan' };

// Yozuvni o'qiganda qo'shiladigan bog'lanishlar (ro'yxat maydonlari).
const INCLUDES = {
  student: { groups: { select: { id: true } } },
  group: { students: { select: { id: true } } },
};

export const money = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\s/g, ' ');
const cut = (s, n) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const bor = (v) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));

// ---------------------------------------------------------------------------
// Yozuvlarni o'qish va nomlash
// ---------------------------------------------------------------------------
async function loadRecord(entity, id) {
  const model = ENTITIES[entity]?.model;
  if (!model || !Number.isInteger(id) || id <= 0) return null;
  const include = INCLUDES[entity];
  const row = await prisma[model].findUnique({ where: { id }, ...(include ? { include } : {}) });
  return normalize(row);
}

function normalize(row) {
  if (!row) return null;
  const out = { ...row };
  delete out.password;
  if (Array.isArray(row.groups)) out.groups = row.groups.map(g => g.id).sort((a, b) => a - b);
  if (Array.isArray(row.students)) out.students = row.students.map(s => s.id).sort((a, b) => a - b);
  return out;
}

const NAME_FIELD = { topic: 'title' };

/** Bir nechta modelning id → nom xaritasi, har model uchun bitta so'rov. */
async function loadNames(wanted) {
  const names = new Map();
  await Promise.all([...wanted.entries()].map(async ([model, ids]) => {
    const list = [...ids].filter(id => Number.isInteger(id) && id > 0);
    const map = new Map();
    names.set(model, map);
    if (!list.length) return;
    const field = NAME_FIELD[model] || 'name';
    const rows = await prisma[model].findMany({ where: { id: { in: list } }, select: { id: true, [field]: true } });
    rows.forEach(r => map.set(r.id, r[field]));
  }));
  return names;
}

function titleOf(entity, r) {
  if (!r) return null;
  if (entity === 'topic') return r.title;
  if (entity === 'question') return cut(r.text, 80);
  if (entity === 'setting') return 'Sozlamalar';
  if (entity === 'expense') return r.category + (r.description ? ` — ${cut(r.description, 60)}` : '');
  if (entity === 'kassa') return r.toWhom ? `Inkassatsiya: ${r.toWhom}` : 'Kassa';
  return r.name ?? r.title ?? null;
}

function linkOf(entity, r) {
  if (!r?.id) return null;
  if (entity === 'student') return `/students/${r.id}`;
  if (entity === 'group') return `/courses/${r.id}`;
  if (entity === 'user') return `/hr/${r.id}`;
  if (entity === 'teacher') return r.userId ? `/hr/${r.userId}` : `/teachers/${r.id}`;
  if (entity === 'exam') return `/exams/${r.id}`;
  return null;
}

// ---------------------------------------------------------------------------
// Farq
// ---------------------------------------------------------------------------
function same(a, b) {
  const n = (v) => (v === undefined || v === null || v === '' ? null : v);
  a = n(a); b = n(b);
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

function skipField(entity, key) {
  if (OMIT_FIELDS.has(key)) return true;
  // Filial faqat xodim uchun o'zgaradigan narsa (boshqa filialga o'tkazish).
  if (key === 'schoolId' && entity !== 'user') return true;
  return false;
}

/** Yangi yoki o'chirilgan yozuvning to'ldirilgan maydonlari. */
function snapshotFields(entity, row, side) {
  if (!row) return [];
  return Object.keys(row)
    .filter(k => !skipField(entity, k) && bor(row[k]) && row[k] !== false)
    .map(k => (side === 'to' ? { field: k, a: undefined, b: row[k] } : { field: k, a: row[k], b: undefined }));
}

function diffFields(entity, before, after) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const k of keys) {
    if (skipField(entity, k)) continue;
    // Javobda qaytmagan maydon o'zgarmagan hisoblanadi.
    if (!(k in after)) continue;
    if (!same(before[k], after[k])) out.push({ field: k, a: before[k], b: after[k] });
  }
  return out;
}

/** Xom farqlarni ko'rsatishga tayyor [{ field, label, from, to }] ga aylantiradi. */
async function present(raw) {
  if (!raw.length) return [];
  const wanted = new Map();
  const want = (model, id) => {
    const n = Number(id);
    if (!Number.isInteger(n)) return;
    if (!wanted.has(model)) wanted.set(model, new Set());
    wanted.get(model).add(n);
  };
  for (const r of raw) {
    if (REFS[r.field]) { want(REFS[r.field], r.a); want(REFS[r.field], r.b); }
    if (LIST_REFS[r.field]) [...(r.a || []), ...(r.b || [])].forEach(id => want(LIST_REFS[r.field], id));
    if (r.field === 'customPrices') [r.a, r.b].forEach(o => o && typeof o === 'object' && Object.keys(o).forEach(id => want('group', id)));
  }
  const names = await loadNames(wanted);
  const nameOf = (model, id) => names.get(model)?.get(Number(id)) ?? `#${id}`;

  const fmt = (field, v) => {
    if (!bor(v)) return '—';
    if (REFS[field]) return nameOf(REFS[field], v);
    if (MONEY_FIELDS.has(field)) return money(v);
    if (typeof v === 'boolean') return v ? 'Ha' : "Yo'q";
    if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ');
    if (field === 'role') return ROLE_LABELS[v] || v;
    if (field === 'days') return DAY_LABELS[v] || v;
    if (field === 'customPrices' && typeof v === 'object') {
      const parts = Object.entries(v).map(([gid, p]) => `${nameOf('group', gid)}: ${money(p)}`);
      return parts.length ? cut(parts.join(', '), 300) : '—';
    }
    if (typeof v === 'object') return cut(JSON.stringify(v), 200);
    return cut(v, 300);
  };

  return raw.map(({ field, a, b }) => {
    const label = FIELD_LABELS[field] || field;
    if (SECRET_FIELDS.has(field)) return { field, label, from: bor(a) ? '•••' : '—', to: bor(b) ? "o'zgartirildi" : '—' };
    if (IMAGE_FIELDS.has(field)) return { field, label, from: bor(a) ? 'bor edi' : '—', to: bor(b) ? (bor(a) ? 'yangilandi' : "qo'yildi") : "olib tashlandi" };
    if (LIST_REFS[field]) {
      const oldIds = (a || []).map(Number), newIds = (b || []).map(Number);
      const model = LIST_REFS[field];
      if (oldIds.length <= 6 && newIds.length <= 6) {
        return { field, label, from: oldIds.map(id => nameOf(model, id)).join(', ') || '—', to: newIds.map(id => nameOf(model, id)).join(', ') || '—' };
      }
      const added = newIds.filter(id => !oldIds.includes(id)).map(id => nameOf(model, id));
      const removed = oldIds.filter(id => !newIds.includes(id)).map(id => nameOf(model, id));
      const extra = [added.length ? `+ ${added.join(', ')}` : '', removed.length ? `− ${removed.join(', ')}` : ''].filter(Boolean).join('; ');
      return { field, label, from: `${oldIds.length} ta`, to: cut(`${newIds.length} ta${extra ? ' (' + extra + ')' : ''}`, 300) };
    }
    return { field, label, from: fmt(field, a), to: fmt(field, b) };
  });
}

// ---------------------------------------------------------------------------
// Marshrutlar
// ---------------------------------------------------------------------------
const ATT_SHORT = { Keldi: 'keldi', Kelmapdi: 'kelmadi', Sababli: 'sababli', Kechikdi: 'kechikdi', ErtaKetdi: 'erta ketdi', "Dars bo'lmadi": "dars bo'lmadi" };

async function nameOfRecord(model, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const field = NAME_FIELD[model] || 'name';
  const row = await prisma[model].findUnique({ where: { id: n }, select: { [field]: true } }).catch(() => null);
  return row ? row[field] : null;
}

/** Imtihon o'rnidagi qatnashchi ismi (o'quvchi yoki tashqi qatnashchi). */
async function orinEgasi(seatId) {
  const n = Number(seatId);
  if (!Number.isInteger(n) || n <= 0) return null;
  const o = await prisma.examSeat.findUnique({ where: { id: n }, select: { guestName: true, student: { select: { name: true } } } }).catch(() => null);
  return o ? o.student?.name || o.guestName || null : null;
}

const crud = (base, entity, { create = true, update = true, remove = true } = {}) => [
  ...(create ? [{ method: 'POST', path: base, entity, action: 'create' }] : []),
  ...(update ? [{ method: 'PUT', path: `${base}/:id`, entity, action: 'update' }] : []),
  ...(remove ? [{ method: 'DELETE', path: `${base}/:id`, entity, action: 'delete' }] : []),
];

const SPECS = [
  // Jurnalga kirmaydigan yo'llar: kirish, tashqi webhook'lar, fayl yuklash va
  // Face ID belgisi (profil rasmidan avtomatik hisoblanadi).
  { method: 'POST', path: '/api/auth/login', skip: true },
  { method: 'POST', path: '/api/upload', skip: true },
  { method: 'POST', path: '/api/groups/:id/charge-quote', skip: true },   // faqat hisoblab ko'rsatadi
  { method: 'POST', path: '/api/utils/remove-bg', skip: true },
  { method: 'POST', path: '/api/face-profiles', skip: true },
  { method: 'DELETE', path: '/api/face-profiles/:studentId', skip: true },
  { method: 'POST', path: '/api/public/schools/:schoolId/tokens', skip: true },
  { method: 'POST', path: '/api/sms/eskiz-callback/:kalit', skip: true },   // Eskiz SMS yetkazish natijasi

  {
    method: 'POST', path: '/api/auth/change-password', entity: 'auth', action: 'action',
    describe: async ({ req }) => ({ title: req.user?.name, summary: "Parolini o'zgartirdi", link: req.user?.id > 0 ? `/hr/${req.user.id}` : null }),
  },

  // Xodimlar
  ...crud('/api/users', 'user'),
  {
    method: 'POST', path: '/api/staff-attendance', entity: 'staffAttendance', action: 'update',
    describe: async ({ req }) => ({
      title: await nameOfRecord('user', req.body?.userId),
      summary: `${req.body?.date} · ${req.body?.status}`,
      link: `/hr/${parseInt(req.body?.userId)}`,
    }),
  },
  {
    method: 'DELETE', path: '/api/staff-attendance', entity: 'staffAttendance', action: 'delete',
    describe: async ({ req }) => ({
      title: await nameOfRecord('user', req.query?.userId),
      summary: `${req.query?.date} · belgi olib tashlandi`,
      link: `/hr/${parseInt(req.query?.userId)}`,
    }),
  },
  {
    method: 'POST', path: '/api/salary-payments', entity: 'salaryPayment', action: 'create',
    describe: async ({ after }) => ({
      title: await nameOfRecord('user', after?.userId),
      summary: `${after?.month} · ${money(after?.amount)} so'm`,
      link: after?.userId ? `/hr/${after.userId}` : null,
    }),
  },
  {
    method: 'PUT', path: '/api/salary-payments/:id', entity: 'salaryPayment', action: 'update',
    describe: async ({ after }) => ({ title: await nameOfRecord('user', after?.userId), summary: after?.month, link: after?.userId ? `/hr/${after.userId}` : null }),
  },
  {
    method: 'DELETE', path: '/api/salary-payments/:id', entity: 'salaryPayment', action: 'delete',
    describe: async ({ before }) => ({ title: await nameOfRecord('user', before?.userId), summary: `${before?.month} · ${money(before?.amount)} so'm` }),
  },
  { method: 'POST', path: '/api/admin/sync-teachers', entity: 'teacher', action: 'action', describe: async () => ({ title: "Ustoz va xodim yozuvlarini moslash" }) },
  ...crud('/api/teachers', 'teacher'),

  // O'quvchilar
  ...crud('/api/students', 'student'),
  {
    method: 'POST', path: '/api/students/import', entity: 'student', action: 'create',
    describe: async ({ body }) => ({ title: 'Excel import', summary: `${body?.count ?? 0} ta o'quvchi qo'shildi, ${body?.skippedCount ?? 0} ta o'tkazib yuborildi`, changes: [] }),
  },
  { method: 'PUT', path: '/api/students/:id/transport', entity: 'student', action: 'update' },
  {
    method: 'POST', path: '/api/students/:id/transfer', entity: 'student', action: 'update', recordId: 'id',
    describe: async ({ req, before }) => {
      const [from, to] = await Promise.all([nameOfRecord('group', req.body?.fromGroupId), nameOfRecord('group', req.body?.toGroupId)]);
      return { title: before?.name, summary: `Kursga ko'chirildi: ${from || '—'} → ${to || '—'} (${req.body?.date})`, changes: [] };
    },
  },
  {
    method: 'POST', path: '/api/students/:id/kurs-hisob', entity: 'student', action: 'update', recordId: 'id',
    describe: async ({ req, before, body }) => {
      const kurs = (await nameOfRecord('group', req.body?.groupId)) || '—';
      const d = String(req.body?.startDate || '');
      const qism = [`kelgan sana ${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`];
      if (req.body?.price !== undefined) qism.push(req.body.price === null || req.body.price === '' ? 'standart narx' : `oylik ${money(req.body.price)} so'm`);
      if (req.body?.firstMonthDue !== undefined && req.body?.firstMonthDue !== null && req.body?.firstMonthDue !== '') qism.push(`birinchi oy ${money(req.body.firstMonthDue)} so'm`);
      if (body?.balanceDelta) qism.push(`hisob ${money(body.balanceDelta)} so'm`);
      return { title: before?.name, summary: `Kurs hisobi: ${kurs} · ${qism.join(' · ')}`, changes: [] };
    },
  },
  {
    method: 'POST', path: '/api/students/:id/refund', entity: 'student', action: 'action', recordId: 'id',
    describe: async ({ req, before }) => ({
      title: before?.name,
      summary: `Pul qaytarish (${req.body?.mode === 'cash' ? 'naqd' : 'balansga'}) · ${req.body?.date}`,
    }),
  },

  // Kurslar
  ...crud('/api/groups', 'group'),
  {
    method: 'POST', path: '/api/groups/:id/students', entity: 'group', action: 'update', recordId: 'id',
    describe: async ({ req, before, body }) => {
      const student = await nameOfRecord('student', req.body?.studentId);
      const extra = body?.charge ? ` · hisoblandi ${money(body.charge)} so'm` : '';
      return { title: before?.name, summary: `O'quvchi qo'shildi: ${student || '—'}${extra}`, changes: [] };
    },
  },
  {
    method: 'DELETE', path: '/api/groups/:id/students/:studentId', entity: 'group', action: 'update', recordId: 'id',
    describe: async ({ req, before }) => ({ title: before?.name, summary: `O'quvchi chiqarildi: ${(await nameOfRecord('student', req.params.studentId)) || '—'}`, changes: [] }),
  },
  ...crud('/api/courses', 'course'),
  ...crud('/api/directions', 'direction'),
  ...crud('/api/rooms', 'room'),

  // Lidlar va onlayn ariza
  ...crud('/api/leads', 'lead'),
  { method: 'POST', path: '/api/public/leads', entity: 'lead', action: 'create', public: true },
  {
    method: 'POST', path: '/api/public/schools/:schoolId/leads', entity: 'student', action: 'create', public: true,
    describe: async ({ after }) => ({
      summary: (after?.status === 'Faol' ? "Onlayn ariza orqali faol o'quvchi" : "Onlayn ariza orqali sinov o'quvchisi")
        + (after?.phone ? ` · ${after.phone}` : ''),
    }),
  },

  // Pul
  {
    method: 'POST', path: '/api/payments', entity: 'payment', action: 'create',
    describe: async ({ after }) => {
      const [student, group] = await Promise.all([nameOfRecord('student', after?.studentId), nameOfRecord('group', after?.groupId)]);
      return {
        title: student,
        summary: [`${money(after?.amount)} so'm`, after?.type, group, after?.description].filter(Boolean).map(s => cut(s, 80)).join(' · '),
        link: after?.studentId ? `/students/${after.studentId}` : null,
      };
    },
  },
  {
    method: 'PUT', path: '/api/payments/:id', entity: 'payment', action: 'update',
    describe: async ({ before, after }) => {
      const student = await nameOfRecord('student', (after || before)?.studentId);
      const parts = [];
      if (before?.amount !== after?.amount) parts.push(`summa ${money(before?.amount)} → ${money(after?.amount)} so'm`);
      if (before?.type !== after?.type) parts.push(`usul ${before?.type} → ${after?.type}`);
      if (before?.date !== after?.date) parts.push(`sana ${before?.date} → ${after?.date}`);
      return {
        title: student,
        summary: "To'lov tahrirlandi · " + (parts.join(' · ') || `${money(after?.amount)} so'm`),
        link: after?.studentId ? `/students/${after.studentId}` : null,
      };
    },
  },
  {
    method: 'DELETE', path: '/api/payments/:id', entity: 'payment', action: 'delete',
    describe: async ({ before }) => ({
      title: await nameOfRecord('student', before?.studentId),
      summary: `To'lov o'chirildi · ${money(before?.amount)} so'm · ${before?.type || ''} · ${before?.date || ''}`,
      link: before?.studentId ? `/students/${before.studentId}` : null,
    }),
  },
  {
    method: 'POST', path: '/api/tolov-tasdiq', entity: 'tolovTasdiq', action: 'create',
    describe: async ({ after }) => ({
      title: await nameOfRecord('student', after?.studentId),
      summary: `${after?.type || 'Klik'} · ${money(after?.amount)} so'm · chek ${String(after?.paidAt || '').replace('T', ' ')} · tasdiq kutilmoqda`,
      link: after?.studentId ? `/students/${after.studentId}` : null,
    }),
  },
  {
    method: 'POST', path: '/api/tolov-tasdiq/:id/tasdiqlash', entity: 'tolovTasdiq', action: 'action', recordId: 'id',
    describe: async ({ before }) => ({
      title: await nameOfRecord('student', before?.studentId),
      summary: `${before?.type || 'Klik'} to'lovi tasdiqlandi · ${money(before?.amount)} so'm · balansga tushdi`,
      link: before?.studentId ? `/students/${before.studentId}` : null,
    }),
  },
  {
    method: 'POST', path: '/api/tolov-tasdiq/:id/rad', entity: 'tolovTasdiq', action: 'action', recordId: 'id',
    describe: async ({ before, req }) => ({
      title: await nameOfRecord('student', before?.studentId),
      summary: `${before?.type || 'Klik'} to'lovi rad etildi · ${money(before?.amount)} so'm · ${cut(req.body?.reason || '', 120)}`,
      link: before?.studentId ? `/students/${before.studentId}` : null,
    }),
  },
  ...crud('/api/expenses', 'expense', { update: false }).map(s => ({
    ...s,
    describe: async ({ before, after }) => {
      const r = after || before;
      return { summary: `${money(r?.amount)} so'm · ${r?.method || ''} · ${r?.date || ''}` };
    },
  })),
  {
    method: 'POST', path: '/api/kassa/handover', entity: 'kassa', action: 'create',
    describe: async ({ after }) => ({ summary: `${money(after?.amount)} so'm · ${after?.date}` }),
  },
  {
    method: 'DELETE', path: '/api/kassa/handover/:id', entity: 'kassa', action: 'delete',
    describe: async ({ before }) => ({ summary: `${money(before?.amount)} so'm · ${before?.date}` }),
  },
  {
    method: 'POST', path: '/api/kassa/close', entity: 'kassa', action: 'action',
    describe: async ({ body }) => ({
      title: `Kunni yopish: ${body?.date || ''}`,
      summary: `Kutilgan ${money(body?.expected)} · sanaldi ${money(body?.counted)} · farq ${money(body?.diff)} so'm`,
    }),
  },
  { method: 'POST', path: '/api/billing/process-month', entity: 'billing', action: 'action', describe: async ({ req }) => ({ title: 'Oylik hisobni yuritish', summary: req.body?.month }) },
  { method: 'POST', path: '/api/billing/recalculate-month', entity: 'billing', action: 'action', describe: async ({ req }) => ({ title: 'Oylik hisobni qayta hisoblash', summary: req.body?.month }) },
  { method: 'POST', path: '/api/billing/notify-debtors', entity: 'billing', action: 'action', describe: async ({ req, body }) => ({ title: 'Qarzdorlarga xabar', summary: [req.body?.month, body?.sent != null ? `${body.sent} ta yuborildi` : ''].filter(Boolean).join(' · ') }) },

  // Davomat va baholar. `link` — kurs sahifasi.
  {
    // Javob — yozilgan davomat qatori (yangi yoki yangilangan).
    method: 'POST', path: '/api/attendances', entity: 'attendance', action: 'update',
    describe: async ({ body }) => {
      const [student, group] = await Promise.all([nameOfRecord('student', body?.studentId), nameOfRecord('group', body?.groupId)]);
      return { title: student, summary: `${group || ''} · ${body?.date} · ${ATT_SHORT[body?.status] || body?.status}`, link: body?.groupId ? `/courses/${body.groupId}` : null, changes: [] };
    },
  },
  {
    method: 'PUT', path: '/api/attendances/:id', entity: 'attendance', action: 'update',
    describe: async ({ after }) => {
      const [student, group] = await Promise.all([nameOfRecord('student', after?.studentId), nameOfRecord('group', after?.groupId)]);
      return { title: student, summary: `${group || ''} · ${after?.date}`, link: after?.groupId ? `/courses/${after.groupId}` : null };
    },
  },
  {
    method: 'POST', path: '/api/attendances/batch', entity: 'attendance', action: 'update',
    describe: async ({ req }) => {
      const counts = {};
      for (const r of req.body?.records || []) counts[r.status] = (counts[r.status] || 0) + 1;
      const parts = Object.entries(counts).map(([s, n]) => `${n} ${ATT_SHORT[s] || s}`);
      const gid = parseInt(req.body?.groupId);
      return { title: await nameOfRecord('group', gid), summary: `${req.body?.date} · ${parts.join(', ') || "bo'sh"}`, link: gid ? `/courses/${gid}` : null };
    },
  },
  {
    method: 'DELETE', path: '/api/attendances/batch', entity: 'attendance', action: 'delete',
    describe: async ({ req }) => ({ title: await nameOfRecord('group', req.query?.groupId), summary: `${req.query?.date} kungi davomat o'chirildi`, link: `/courses/${parseInt(req.query?.groupId)}` }),
  },
  {
    method: 'PATCH', path: '/api/attendances/topic', entity: 'attendance', action: 'update',
    describe: async ({ req }) => ({
      title: await nameOfRecord('group', req.body?.groupId),
      summary: `${req.body?.date} · mavzu: ${(await nameOfRecord('topic', req.body?.topicId)) || "olib tashlandi"}`,
      link: `/courses/${parseInt(req.body?.groupId)}`,
    }),
  },
  {
    method: 'POST', path: '/api/attendances/notify', entity: 'message', action: 'action',
    describe: async ({ req, body }) => ({ title: await nameOfRecord('group', req.body?.groupId), summary: `${req.body?.date} davomati ota-onalarga yuborildi (${body?.yuborildi ?? 0} ta${body?.xato || body?.aloqasiz ? `, ${(body?.xato || 0) + (body?.aloqasiz || 0)} tasi yetib bormadi` : ''})`, link: `/courses/${parseInt(req.body?.groupId)}` }),
  },
  {
    method: 'PUT', path: '/api/davomat-xabari', entity: 'message', action: 'update',
    describe: async ({ body }) => ({ title: 'Davomat xabari sozlamasi', summary: `Kanal: ${body?.sozlama?.kanal || '—'} · shablonlar: ${Object.keys(body?.sozlama?.shablon || {}).length} ta holat`, link: '/messaging' }),
  },
  {
    method: 'PUT', path: '/api/tolov-xabari', entity: 'message', action: 'update',
    describe: async ({ body }) => ({
      title: "To'lov xabari sozlamasi",
      summary: `${body?.sozlama?.yoqilgan ? 'Yoqilgan' : "O'chirilgan"} · kanal: ${body?.sozlama?.kanal || '—'} · kimga: ${body?.sozlama?.kimga || '—'} · shablon: ${(await nameOfRecord('messageTemplate', body?.sozlama?.shablonId)) || '—'}`,
      link: '/messaging', changes: [],
    }),
  },
  {
    method: 'POST', path: '/api/tolov-xabari/:id/qayta', entity: 'message', action: 'action',
    describe: async ({ body }) => ({ title: await nameOfRecord('student', body?.studentId), summary: `To'lov SMS i qayta yuborildi · ${body?.holat || ''}${body?.sabab ? ` · ${body.sabab}` : ''}`, link: '/messaging', changes: [] }),
  },
  {
    method: 'POST', path: '/api/tolov-xabari/sinov', entity: 'message', action: 'action',
    describe: async ({ req }) => ({ title: "To'lov xabari — sinov SMS", summary: `Raqam: ${String(req.body?.telefon || '').slice(0, 20)}`, link: '/messaging', changes: [] }),
  },
  { method: 'POST', path: '/api/teacher-attendances', entity: 'teacherAttendance', action: 'update', describe: async ({ req }) => ({ title: await nameOfRecord('teacher', req.body?.teacherId), summary: `${req.body?.date} · ${req.body?.status}` }) },
  { method: 'POST', path: '/api/teacher-attendances/notify', entity: 'message', action: 'action', describe: async ({ req }) => ({ title: "O'qituvchi davomati xabari", summary: req.body?.date }) },
  {
    method: 'POST', path: '/api/scores', entity: 'score', action: 'create',
    describe: async ({ after }) => ({
      title: await nameOfRecord('student', after?.studentId),
      summary: `${after?.value} · ${(await nameOfRecord('group', after?.groupId)) || ''} · ${after?.date}`,
      link: after?.studentId ? `/students/${after.studentId}` : null,
    }),
  },

  // O'quv jarayoni
  ...crud('/api/topics', 'topic'),
  ...crud('/api/syllabuses', 'syllabus'),
  ...crud('/api/questions', 'question'),
  // AI: import, yechim va baho bazaga yozmaydi (natija keyin odam saqlaganda jurnalga tushadi).
  { method: 'POST', path: '/api/questions/ai/import', skip: true },
  { method: 'POST', path: '/api/questions/:id/ai/yechim', skip: true },
  { method: 'POST', path: '/api/exam-results/:id/ai/baho', skip: true },
  { method: 'POST', path: '/api/questions/:id/ai/klon', entity: 'question', action: 'create', describe: async ({ req, body }) => ({ title: 'AI klon', summary: `#${parseInt(req.params.id)} savoldan ${body?.yaratildi?.length ?? 0} ta qoralama klon (${(body?.yaratildi || []).filter(k => k.tekshirildi).length} tasi tekshiruvdan o'tdi)`, changes: [] }) },
  { method: 'POST', path: '/api/questions/:id/ai/tarjima', entity: 'question', action: 'create', describe: async ({ req, body }) => ({ title: 'AI tarjima', summary: `#${parseInt(req.params.id)} savol ${({ uz: "o'zbekchaga", ru: 'ruschaga', en: 'inglizchaga' })[req.body?.til] || ''} tarjima qilindi → #${body?.id ?? '?'} (qoralama)`, entityId: body?.id ?? null, changes: [] }) },
  { method: 'POST', path: '/api/questions/bulk', entity: 'question', action: 'create', describe: async ({ req }) => ({ title: "Savollar to'plami", summary: `${(req.body?.questions || []).length} ta savol`, changes: [] }) },
  ...crud('/api/passages', 'passage'),
  ...crud('/api/exams', 'exam'),
  { method: 'POST', path: '/api/exams/:id/copy', entity: 'exam', action: 'create', describe: async ({ body }) => ({ title: body?.name, summary: 'Imtihondan nusxa olindi', link: body?.id ? `/exams/${body.id}` : null }) },
  {
    method: 'POST', path: '/api/exams/:id/assignments', entity: 'exam', action: 'update', recordId: 'id',
    describe: async ({ before, req }) => {
      const ids = (Array.isArray(req.body?.groupIds) ? req.body.groupIds : []).slice(0, 10);
      const nomlar = await Promise.all(ids.map(id => nameOfRecord('group', id)));
      return { title: before?.name, summary: `Kursga biriktirildi: ${nomlar.filter(Boolean).join(', ') || '—'}`, changes: [] };
    },
  },
  { method: 'DELETE', path: '/api/exams/:id/assignments/:groupId', entity: 'exam', action: 'update', recordId: 'id', describe: async ({ before, req }) => ({ title: before?.name, summary: `Kursdan olindi: ${(await nameOfRecord('group', req.params.groupId)) || '—'}`, changes: [] }) },
  { method: 'POST', path: '/api/exams/:id/lock', entity: 'exam', action: 'action', recordId: 'id', describe: async ({ before, body }) => ({ title: before?.name, summary: `Savollar qulflandi · ${body?.variantlar ?? 0} ta variant`, link: `/exams/${before?.id}` }) },
  { method: 'POST', path: '/api/exams/:id/unlock', entity: 'exam', action: 'action', recordId: 'id', describe: async ({ before }) => ({ title: before?.name, summary: 'Savollar qulfi ochildi, variantlar o\'chirildi', link: `/exams/${before?.id}` }) },
  {
    method: 'PUT', path: '/api/exams/:id/key', entity: 'exam', action: 'update', recordId: 'id',
    describe: async ({ before, body }) => ({
      title: before?.name,
      summary: `Kalit: ${Object.keys(body?.keyFix || {}).length} ta tuzatish, ${Object.keys(body?.cancelled || {}).length} ta bekor qilingan savol · ${body?.qaytaHisoblandi ?? 0} ta natija qayta hisoblandi`,
      link: `/exams/${before?.id}`, changes: [],
    }),
  },
  {
    method: 'PUT', path: '/api/exams/:id/manual-key', entity: 'exam', action: 'update', recordId: 'id',
    describe: async ({ before, body, req }) => ({
      title: before?.name,
      summary: `Kitobcha kaliti (qo'lda): ${(body?.kalitlar || []).map(k => `${k.code} ${k.toldirilgan}/${k.jami}`).join(', ')}${req?.body?.topics ? ' · savol mavzulari' : ''}${body?.qaytaHisoblandi ? ` · ${body.qaytaHisoblandi} ta natija qayta hisoblandi` : ''}`,
      link: `/exams/${before?.id}`, changes: [],
    }),
  },
  { method: 'POST', path: '/api/exams/:id/seating', entity: 'exam', action: 'action', recordId: 'id', describe: async ({ before, body }) => ({ title: before?.name, summary: `O'rinlashtirildi: ${body?.joylashdi ?? 0} ta o'rin${body?.sigmadi?.length ? `, ${body.sigmadi.length} ta sig'madi` : ''}`, link: `/exams/${before?.id}` }) },
  { method: 'POST', path: '/api/exams/:id/guests', entity: 'exam', action: 'update', recordId: 'id', describe: async ({ before, body }) => ({ title: before?.name, summary: `${body?.qoshildi ?? 0} ta tashqi qatnashchi qo'shildi`, changes: [] }) },
  {
    method: 'PUT', path: '/api/exams/:id/seats/:seatId', entity: 'exam', action: 'update', recordId: 'id',
    describe: async ({ before, req }) => ({
      title: before?.name,
      summary: req.body?.status
        ? `Qatnashchi: ${{ keldi: 'keldi', kelmadi: 'kelmadi', rejada: 'belgisi olindi' }[req.body.status] || req.body.status}`
        : `${(await orinEgasi(req.params.seatId)) || 'Qatnashchi'}: ${req.body?.almashtir ? "boshqa qatnashchi bilan o'rni almashtirildi" : "o'rni o'zgartirildi"}${req.body?.row != null ? ` (${Number(req.body.row) + 1}-qator, ${Number(req.body.col) + 1}-o'rin)` : ''}`,
      changes: [],
    }),
  },
  { method: 'DELETE', path: '/api/exams/:id/seats/:seatId', entity: 'exam', action: 'update', recordId: 'id', describe: async ({ before }) => ({ title: before?.name, summary: "Qatnashchi ro'yxatdan olindi", changes: [] }) },
  {
    method: 'POST', path: '/api/exams/:id/scans', entity: 'examResult', action: 'action',
    describe: async ({ body, req }) => ({
      title: body?.name || null,
      summary: `${(await nameOfRecord('exam', req.params.id)) || ''} · ${req.body?.page || 1}-sahifa · ${body?.score ?? 0} ball${body?.shubhalar ? ` · ${body.shubhalar} ta shubhali` : ''}`,
      link: `/exams/${parseInt(req.params.id)}`, entityId: body?.id ?? null, changes: [],
    }),
  },
  {
    method: 'PUT', path: '/api/exam-results/:id/review', entity: 'examResult', action: 'update',
    describe: async ({ before, req, body }) => ({
      title: (await nameOfRecord('student', before?.studentId)) || null,
      summary: `${(await nameOfRecord('exam', before?.examId)) || ''} · qo'lda: ${Object.keys(req.body?.manual || {}).length} ta javob · ${body?.score ?? 0} ball`,
      link: before?.examId ? `/exams/${before.examId}` : null,
    }),
  },
  { method: 'POST', path: '/api/exams/:id/recalculate', entity: 'exam', action: 'action', recordId: 'id', describe: async ({ before, body }) => ({ title: before?.name, summary: `${body?.qaytaHisoblandi ?? 0} ta natija qayta hisoblandi` }) },
  { method: 'POST', path: '/api/exams/:id/publish', entity: 'exam', action: 'action', recordId: 'id', describe: async ({ before, body }) => ({ title: before?.name, summary: `Natijalar e'lon qilindi · ${body?.xulosa?.skanerlangan ?? 0} ta natija`, link: `/exams/${before?.id}` }) },
  { method: 'POST', path: '/api/exams/:id/guests/leads', entity: 'lead', action: 'create', describe: async ({ req, body }) => ({ title: (await nameOfRecord('exam', req.params.id)) || 'Imtihon', summary: `Tashqi qatnashchilardan lid: ${body?.yaratildi ?? 0} ta yangi, ${body?.bor ?? 0} tasi oldin bor edi${body?.telefonsiz ? `, ${body.telefonsiz} tasida telefon yo'q` : ''}`, link: '/leads', changes: [] }) },
  { method: 'POST', path: '/api/exams/:id/admit-cards', entity: 'message', action: 'action', describe: async ({ req, body }) => ({ title: (await nameOfRecord('exam', req.params.id)) || 'Imtihon', summary: `Ruxsatnoma${req.body?.qayta ? ' (qaytadan)' : ''}: ${body?.yuborildi ?? 0} ta yuborildi, ${body?.xato ?? 0} ta yetmadi`, link: `/exams/${parseInt(req.params.id)}` }) },
  { method: 'POST', path: '/api/exams/:id/notify', entity: 'message', action: 'action', describe: async ({ req, body }) => ({ title: (await nameOfRecord('exam', req.params.id)) || 'Imtihon', summary: `Natija xabari: ${body?.yuborildi ?? 0} ta yuborildi, ${body?.xato ?? 0} ta yetmadi`, link: `/exams/${parseInt(req.params.id)}` }) },
  { method: 'DELETE', path: '/api/exam-results/:id', entity: 'examResult', action: 'delete', describe: async ({ before }) => ({ title: await nameOfRecord('student', before?.studentId), summary: `${(await nameOfRecord('exam', before?.examId)) || ''} · ${before?.score} ball` }) },

  // Xabarlar
  { method: 'POST', path: '/api/sms/send', entity: 'message', action: 'action', describe: async ({ req }) => ({ title: `SMS: ${req.body?.phone || ''}`, summary: cut(req.body?.message, 120) }) },
  { method: 'POST', path: '/api/sms/resend-failed', entity: 'message', action: 'action', describe: async () => ({ title: 'Yetib bormagan SMSlarni qayta yuborish' }) },
  {
    method: 'POST', path: '/api/messaging/send-batch', entity: 'message', action: 'action',
    describe: async ({ req }) => {
      const n = (Array.isArray(req.body?.sendList) && req.body.sendList.length) || (req.body?.studentIds || []).length;
      return { title: 'Ommaviy xabar', summary: `${req.body?.channel || 'SMS'} · ${n} ta oluvchi · ${cut(req.body?.message, 100)}` };
    },
  },
  ...crud('/api/messaging/templates', 'messageTemplate'),
  { method: 'POST', path: '/api/messaging/templates/:id/eskiz', entity: 'messageTemplate', action: 'action', recordId: 'id', describe: async ({ before, body }) => ({ title: before?.name, summary: `Eskizga qayta yuborildi · ${body?.eskizStatus || ''}`, changes: [] }) },
  ...crud('/api/messaging/auto-rules', 'autoMessageRule'),

  // Logistika
  ...crud('/api/transports', 'transport'),
  ...crud('/api/routes', 'route'),
  { method: 'POST', path: '/api/logistics/ask-drivers', entity: 'logistics', action: 'action', describe: async () => ({ title: "Haydovchilardan so'raldi" }) },
  {
    method: 'PUT', path: '/api/logistics/tarif', entity: 'logistics', action: 'update',
    describe: async ({ body }) => ({
      title: "Yo'l haqi tarifi (hamma haydovchi uchun)",
      summary: body?.tarif ? tarifMatni(body.tarif) : "Yo'l haqi tarifi olib tashlandi",
      link: '/logistics', changes: [],
    }),
  },
  {
    method: 'POST', path: '/api/logistics/daily-plan', entity: 'logistics', action: 'action',
    // apply bo'lmasa — faqat oldindan ko'rish, bazaga hech narsa yozilmaydi.
    skipIf: (req) => req.body?.apply !== true,
    describe: async ({ req }) => ({ title: 'Kunlik reja tuzildi', summary: [req.body?.date, req.body?.endTime].filter(Boolean).join(' · ') }),
  },
  {
    method: 'POST', path: '/api/logistics/plans', entity: 'logistics', action: 'create',
    describe: async ({ req }) => {
      const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
      const n = plans.reduce((s, p) => s + (Array.isArray(p?.studentIds) ? p.studentIds.length : 0), 0);
      return { title: 'Transport rejasi tuzildi', summary: `${req.body?.date} · ${n} ta o'quvchi · ${plans.length} ta haydovchi`, link: '/logistics' };
    },
  },
  {
    method: 'PUT', path: '/api/logistics/day', entity: 'logistics', action: 'update',
    describe: async ({ req, body }) => {
      const cars = Array.isArray(req.body?.cars) ? req.body.cars.filter(c => Array.isArray(c?.studentIds) && c.studentIds.length) : [];
      const n = cars.reduce((s, c) => s + c.studentIds.length, 0);
      const y = Array.isArray(body?.yuborish) ? body.yuborish : [];
      const soni = (tur) => y.filter(x => x.tur === tur).length;
      const qismlar = [soni('yangi') && `${soni('yangi')} yangi`, soni('ozgardi') && `${soni('ozgardi')} o'zgardi`, soni('bekor') && `${soni('bekor')} bekor`].filter(Boolean);
      return { title: 'Transport rejasi saqlandi', summary: `${req.body?.date} · ${n} ta o'quvchi · ${cars.length} ta reys${qismlar.length ? ' · ' + qismlar.join(', ') : ''}`, link: '/logistics', changes: [] };
    },
  },
  {
    method: 'POST', path: '/api/logistics/plans/:id/holat', entity: 'logistics', action: 'action',
    describe: async ({ req }) => ({
      title: await nameOfRecord('student', req.body?.studentId),
      summary: `${await nameOfRecord('route', req.params.id)}: ${req.body?.status || 'belgi olib tashlandi'} (xodim belgiladi)`,
      link: '/logistics',
    }),
  },
  {
    method: 'POST', path: '/api/logistics/plans/:id/accept', entity: 'logistics', action: 'action',
    describe: async ({ req }) => ({ title: await nameOfRecord('route', req.params.id), summary: "Qabul qildim (xodim belgiladi)", link: '/logistics' }),
  },
  {
    method: 'POST', path: '/api/logistics/plans/:id/deliver', entity: 'logistics', action: 'action',
    describe: async ({ req }) => ({ title: await nameOfRecord('route', req.params.id), summary: "Yetkazdim (xodim belgiladi)", link: '/logistics' }),
  },
  {
    method: 'POST', path: '/api/logistics/plans/:id/send', entity: 'logistics', action: 'action',
    describe: async ({ req }) => ({ title: await nameOfRecord('route', req.params.id), summary: 'Reja haydovchiga qayta yuborildi', link: '/logistics' }),
  },
  { method: 'DELETE', path: '/api/logistics/plans/:id', entity: 'route', action: 'delete' },
  {
    method: 'POST', path: '/api/delivery-logs', entity: 'logistics', action: 'update',
    describe: async ({ req }) => ({ title: await nameOfRecord('student', req.body?.studentId), summary: `${req.body?.date} · ${req.body?.status}`, link: `/students/${parseInt(req.body?.studentId)}` }),
  },

  // Payme
  {
    method: 'POST', path: '/api/payme/orders', entity: 'payme', action: 'create',
    describe: async ({ req, body }) => ({
      title: await nameOfRecord('student', req.body?.studentId),
      summary: `To'lov havolasi: ${money(body?.order?.amount ?? req.body?.amount)} so'm`,
      link: `/students/${parseInt(req.body?.studentId)}`,
      changes: [],
    }),
  },
  { method: 'POST', path: '/api/payme/orders/:id/send', entity: 'payme', action: 'action', describe: async ({ req }) => ({ title: "To'lov havolasi Telegramga yuborildi", summary: req.params.id }) },
  { method: 'POST', path: '/api/payme/orders/:id/cancel', entity: 'payme', action: 'action', describe: async ({ req }) => ({ title: "To'lov havolasi bekor qilindi", summary: req.params.id }) },
  { method: 'POST', path: '/api/payme/rotate-endpoint', entity: 'payme', action: 'action', describe: async () => ({ title: 'Payme webhook manzili yangilandi' }) },

  // Sozlamalar va tashkilot
  { method: 'PUT', path: '/api/settings', entity: 'setting', action: 'update', settings: true },
  {
    method: 'PUT', path: '/api/permissions', entity: 'organization', action: 'action',
    describe: async ({ body }) => {
      const list = Array.isArray(body?.ozgarishlar) ? body.ozgarishlar : [];
      return {
        title: 'Lavozim ruxsatlari',
        summary: list.length
          ? cut(list.slice(0, 6).join('; ') + (list.length > 6 ? ` va yana ${list.length - 6} ta` : ''), 600)
          : "O'zgarish yo'q",
        link: '/settings?bolim=ruxsatlar',
        changes: [],
      };
    },
  },
  ...crud('/api/schools', 'school'),
  ...crud('/api/organizations', 'organization', { update: false }),
  { method: 'PUT', path: '/api/organizations/:id/subscription', entity: 'organization', action: 'update' },
  ...crud('/api/saas-leads', 'saasLead'),
  { method: 'POST', path: '/api/sellers', entity: 'user', action: 'create' },
].map(spec => {
  const keys = [];
  const re = new RegExp('^' + spec.path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { ...spec, re, keys };
});

export function matchSpec(method, path) {
  for (const spec of SPECS) {
    if (spec.method !== method) continue;
    const m = spec.re.exec(path);
    if (!m) continue;
    const params = {};
    spec.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { spec, params };
  }
  return null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise(resolve => { timer = setTimeout(resolve, ms); }),
  ]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Yozish
// ---------------------------------------------------------------------------
async function buildAndWrite({ req, spec, params, before, body }) {
  const entity = spec.entity || 'other';
  const recordId = parseInt(params[spec.recordId || 'id']);
  let after = null;

  if (spec.settings) {
    const sid = parseInt(req.body?.schoolId);
    after = Number.isInteger(sid) ? normalize(await prisma.setting.findUnique({ where: { schoolId: sid } })) : null;
  } else if (spec.action === 'create') {
    const createdId = parseInt(body?.id);
    after = (await loadRecord(entity, createdId)) || (body && typeof body === 'object' && !Array.isArray(body) ? normalize(body) : null);
  } else if (spec.action === 'update' && !spec.recordId) {
    after = await loadRecord(entity, recordId);
  }

  // Tavsif: avval umumiy qoida, keyin marshrutning o'z tavsifi ustidan yozadi.
  let raw = [];
  if (spec.action === 'create') raw = snapshotFields(entity, after, 'to');
  else if (spec.action === 'delete') raw = snapshotFields(entity, before, 'from');
  else if (spec.action === 'update') raw = diffFields(entity, before, after);

  // Parol javobda qaytmaydi — so'rovda bo'lsa o'zgargan deb yoziladi.
  if (entity === 'user' && spec.action === 'update' && req.body?.password) raw.push({ field: 'password', a: 'x', b: 'x' });

  const record = after || before;
  const out = {
    title: titleOf(entity, record),
    summary: null,
    link: spec.action === 'delete' ? null : linkOf(entity, record),
    entityId: Number.isInteger(record?.id) ? record.id : (Number.isInteger(recordId) ? recordId : null),
  };

  if (spec.describe) {
    const custom = await spec.describe({ req, params, before, after, body });
    Object.assign(out, Object.fromEntries(Object.entries(custom || {}).filter(([, v]) => v !== undefined)));
    if (Array.isArray(custom?.changes)) raw = custom.changes;
  }

  // Hech narsa o'zgarmagan tahrir (masalan forma o'zgartirishsiz saqlandi) — shovqin.
  if (spec.action === 'update' && !spec.describe && raw.length === 0) return;

  const changes = await present(raw);
  if (!out.summary && spec.action === 'update' && changes.length) {
    out.summary = cut(changes.map(c => c.label).join(', '), 200);
  }

  const bodySchool = parseInt(req.body?.schoolId ?? req.query?.schoolId ?? req.params?.schoolId);
  const schoolId = entity === 'school'
    ? (record?.id ?? null)
    : (record?.schoolId ?? (bodySchool > 0 ? bodySchool : null) ?? req.schoolScope ?? req.user?.schoolId ?? null);

  await prisma.auditLog.create({
    data: {
      schoolId: Number.isInteger(schoolId) ? schoolId : null,
      userId: req.user?.id > 0 ? req.user.id : null,
      userName: req.user ? (req.user.name || (req.user.role === 'SUPERADMIN' ? 'Super admin' : req.user.email) || null) : 'Onlayn ariza',
      userRole: req.user?.role || null,
      action: spec.action || 'action',
      entity,
      entityId: out.entityId,
      title: out.title ? cut(out.title, 200) : null,
      summary: out.summary ? cut(out.summary, 500) : null,
      link: out.link || null,
      changes: changes.length ? changes : undefined,
      method: req.method,
      path: cut(req.path, 200),
    },
  });
}

/**
 * Express middleware. `express.json()` dan keyin, marshrutlardan oldin ulanadi.
 */
export function auditMiddleware(req, res, next) {
  if (!MUTATING.has(req.method) || !req.path.startsWith('/api/')) return next();

  const found = matchSpec(req.method, req.path);
  let spec, params;
  if (found) {
    ({ spec, params } = found);
    if (spec.skip) return next();
  } else {
    // Ro'yxatda yo'q yo'l: tashqi webhook'lar (Telegram, Payme) yozilmaydi; qolgani
    // umumiy "Boshqa" amali sifatida — hech bir xodim amali jurnaldan chetda qolmasin.
    if (req.path.startsWith('/api/telegram-webhook') || req.path.startsWith('/api/payme/') || req.path.startsWith('/api/public/')) return next();
    spec = { entity: 'other', action: 'action', describe: async ({ req: r }) => ({ title: `${r.method} ${r.path}` }) };
    params = {};
  }

  // Oldindan ko'rish (preview) bazaga hech narsa yozmaydi.
  if (req.body?.preview === true) return next();

  const authed = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
  if (!authed && !spec.public) return next();

  // Tahrir va o'chirishda yozuvning handlergacha bo'lgan holati.
  const needsBefore = spec.settings || spec.action === 'delete' || spec.action === 'update' || spec.recordId;
  const beforePromise = (async () => {
    if (!needsBefore) return null;
    try {
      if (spec.settings) {
        const sid = parseInt(req.body?.schoolId);
        return Number.isInteger(sid) ? normalize(await prisma.setting.findUnique({ where: { schoolId: sid } })) : null;
      }
      return await loadRecord(spec.entity, parseInt(params[spec.recordId || 'id']));
    } catch (e) {
      console.error('[Jurnal] oldingi holat:', e.message);
      return null;
    }
  })();

  beforePromise.then((before) => {
    const originalJson = res.json.bind(res);
    let handled = false;
    res.json = (body) => {
      if (handled) return originalJson(body);
      handled = true;
      const ok = res.statusCode < 400 && (req.user || spec.public) && !(spec.skipIf && spec.skipIf(req));
      if (!ok) return originalJson(body);
      const work = buildAndWrite({ req, spec, params, before, body })
        .catch(e => console.error('[Jurnal] yozib bo\'lmadi:', req.method, req.path, e.message));
      withTimeout(work, JURNAL_MS).then(() => {
        if (res.headersSent) return;
        try { originalJson(body); } catch (e) { console.error('[Jurnal] javob:', e.message); }
      });
      return res;
    };
    next();
  });
}
