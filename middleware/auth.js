import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { JWT_SECRET } from '../lib/config.js';
import { rolRuxsati, yetadimi, bolimNomi, toliqRuxsatli } from '../lib/ruxsatlar.js';
import { soroqTalablari } from '../lib/ruxsatApi.js';

// SUPERADMIN oversees every organization; SELLER works the SaaS funnel, not school data.
const CROSS_SCHOOL_ROLES = ['SUPERADMIN', 'SELLER'];

// The schoolId a request wants to act on. Routes take it from the query string,
// the body, or a :schoolId path param depending on the verb.
export function requestedSchoolId(req) {
  const raw = req.query?.schoolId ?? req.body?.schoolId ?? req.params?.schoolId;
  if (raw === undefined || raw === null || raw === '') return null;
  const id = parseInt(raw);
  return isNaN(id) ? null : id;
}

// Filiallar orasida yuradigan rol. Egasi (2026-09-16) "Faqat o'z filiali"ni tanladi:
// filial almashtirish, "To'liq o'quv markazi" va boshqa filial xodimlarini boshqarish
// faqat ADMIN'da. Menejer, resepshn, o'qituvchi faqat o'z filialida ishlaydi — ilgari
// Langar filiali menejeri tanlagichdan asosiy filialning to'lovlarini ham ochardi.
export const ORG_WIDE_ROLES = ['ADMIN'];

export function isOrgWide(user) {
  return ORG_WIDE_ROLES.includes(user?.role);
}

// Which schools this user may touch. An ADMIN may move between branches of their own
// organization (the branch switcher in the UI); everyone else stays in their own branch,
// and nobody ever reaches another customer's data.
//
// Egasi (2026-09-17): ikkala filialda ishlaydigan xodim bor. ADMIN unga HR'da
// galochka bilan qo'shimcha filial beradi (User.branches) — shunda xodim o'sha
// filiallar orasida ham almashadi. Asosiy filial doim birinchi turadi.
// Qo'shimcha filiallar yozishda (POST/PUT /api/users) tashkilot ichida ekani
// tekshiriladi, shuning uchun bu yerda qayta so'rov yo'q.
export async function allowedSchoolIds(user) {
  if (!user?.schoolId) return [];
  if (!isOrgWide(user)) {
    const extra = (user.branchIds || []).filter(id => id !== user.schoolId);
    return [user.schoolId, ...extra];
  }
  return organizationSchoolIds(user);
}

// The branch switcher's "To'liq o'quv markazi" option sends schoolId 0. It is not a
// real branch — it means "every branch I am allowed to see", which is exactly the set
// canAccessSchool already grants. Rejecting it used to answer 403, and the client reads
// a 403 as an expired session and logs the user out.
export const ALL_BRANCHES = 0;

export async function canAccessSchool(user, schoolId) {
  if (CROSS_SCHOOL_ROLES.includes(user?.role)) return true;
  if (schoolId === null) return true;              // request is not school-scoped
  if (schoolId === ALL_BRANCHES) return true;      // "all my branches" — handlers narrow it via allowedSchoolIds
  if (user?.schoolId === schoolId) return true;    // own branch — no lookup needed
  // Filial xodimi faqat o'z filiallarida (asosiy + galochka qo'yilganlari).
  return (await allowedSchoolIds(user)).includes(schoolId);
}

// O'quv dasturi (va uning mavzulari) butun markazniki: egasi "o'quv programmasi
// hamma filial uchun ko'rinsin" dedi. Bitta dastur Sariosiyoda ham, Langarda ham
// ishlatiladi, shuning uchun uni tashkilotning istalgan filiali xodimi ochadi.
// Boshqa tashkilot (boshqa mijoz) esa baribir ko'rmaydi.
export async function sameOrganization(user, schoolId) {
  if (CROSS_SCHOOL_ROLES.includes(user?.role)) return true;
  if (!user?.schoolId || schoolId == null) return false;
  if (user.schoolId === schoolId) return true;
  const rows = await prisma.school.findMany({
    where: { id: { in: [user.schoolId, schoolId] } },
    select: { id: true, organizationId: true }
  });
  const own = rows.find(r => r.id === user.schoolId);
  const other = rows.find(r => r.id === schoolId);
  return !!(own?.organizationId && other && own.organizationId === other.organizationId);
}

/** Tashkilotning barcha filiallari (rolga qaramay) — umumiy o'quv dasturi uchun. */
export async function organizationSchoolIds(user) {
  if (!user?.schoolId) return [];
  const own = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { organizationId: true }
  });
  if (!own?.organizationId) return [user.schoolId];
  const siblings = await prisma.school.findMany({
    where: { organizationId: own.organizationId },
    select: { id: true }
  });
  return siblings.map(s => s.id);
}

// Token 90 kun yashaydi, xodimning filiali, roli va holati esa bu orada o'zgaradi:
// boshqa filialga o'tkaziladi, arxivga olinadi. Filial chegarasi tokendagi eski
// qiymatga emas, bazadagi joriy qiymatga tayanishi kerak — aks holda arxivdagi xodim
// 90 kun ichida bemalol kirib yuraverardi. Har so'rovda bazaga bormaslik uchun qisqa kesh.
const USER_TTL_MS = 30 * 1000;
const userCache = new Map();

/** Xodim yozuvi o'zgarganda (tahrir, arxiv, o'chirish) keshdan olib tashlanadi. */
export function forgetUser(id) {
  userCache.delete(Number(id));
}

async function freshUser(payload) {
  // SUPERADMIN bazada saqlanmaydi (id 0).
  if (payload?.role === 'SUPERADMIN' || !Number.isInteger(payload?.id) || payload.id <= 0) return payload;
  const hit = userCache.get(payload.id);
  let row = hit && Date.now() - hit.at < USER_TTL_MS ? hit.row : undefined;
  if (row === undefined) {
    row = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        role: true, schoolId: true, status: true, name: true, branches: { select: { id: true } },
        school: { select: { organizationId: true } },
      }
    });
    userCache.set(payload.id, { at: Date.now(), row: row || null });
  }
  if (!row || row.status === 'Arxiv') return null;
  return {
    ...payload, role: row.role, schoolId: row.schoolId, name: row.name,
    branchIds: (row.branches || []).map(b => b.id),
    organizationId: row.school?.organizationId ?? null,
  };
}

// --- Lavozim ruxsatlari (lib/ruxsatlar.js) ---------------------------------
// Tashkilotning sozlamasi Organization.permissions da. Har so'rovda bazaga
// bormaslik uchun qisqa kesh; admin saqlaganda darhol tozalanadi.
const ruxsatKeshi = new Map();

/** Admin ruxsatlarni saqlagach chaqiriladi — keyingi so'rov yangisini o'qiydi. */
export function unutRuxsatlar(organizationId) {
  if (organizationId == null) ruxsatKeshi.clear();
  else ruxsatKeshi.delete(Number(organizationId));
  ozKursKeshi.clear();
}

export async function tashkilotSozlamasi(organizationId) {
  if (!organizationId) return null;
  const hit = ruxsatKeshi.get(organizationId);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.sozlama;
  let sozlama = null;
  try {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { permissions: true } });
    sozlama = org?.permissions ?? null;
  } catch (e) {
    // Ustun hali bazada yo'q (deploy'dagi `prisma db push`dan oldin) —
    // standart ruxsatlar bilan ishlaymiz, so'rovni yiqitmaymiz.
    console.error('Ruxsat sozlamasini o\'qib bo\'lmadi:', e.message);
  }
  ruxsatKeshi.set(organizationId, { at: Date.now(), sozlama });
  return sozlama;
}

/** Xodimning amaldagi ruxsati: { daraja, faqatOz, toliq }. */
export async function foydalanuvchiRuxsati(user) {
  if (toliqRuxsatli(user?.role)) return rolRuxsati(null, user.role);
  return rolRuxsati(await tashkilotSozlamasi(user?.organizationId), user?.role);
}

/** So'rovga ruxsat yetmasa — sababi, yetsa null. */
export async function ruxsatXatosi(req) {
  const ruxsat = req.ruxsat;
  if (ruxsat?.toliq) return null;
  const talablar = await soroqTalablari(req);
  for (const t of talablar) {
    if (t.admin) {
      if (!toliqRuxsatli(req.user?.role)) return "Bu amal faqat administratorga ruxsat etilgan";
      continue;
    }
    const kalitlar = Array.isArray(t.k) ? t.k : [t.k];
    if (!kalitlar.some(k => yetadimi(ruxsat, k, t.d))) {
      const amal = t.d >= 2 ? "o'zgartirishga" : "ko'rishga";
      return `«${bolimNomi(kalitlar[0])}» bo'limini ${amal} ruxsatingiz yo'q. Administratorga murojaat qiling.`;
    }
  }
  return null;
}

// "Faqat o'z kurslari": ustoz o'zi dars beradigan kurslar va shu kurslardagi
// o'quvchilar bilan cheklanadi. Ro'yxat — Teacher.userId orqali.
const ozKursKeshi = new Map();

export async function ozKurslari(user) {
  const hit = ozKursKeshi.get(user.id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.val;
  const guruhlar = await prisma.group.findMany({
    where: { teacher: { userId: user.id } },
    select: { id: true, students: { select: { id: true } } },
  });
  const val = {
    groupIds: new Set(guruhlar.map(g => g.id)),
    studentIds: new Set(guruhlar.flatMap(g => g.students.map(s => s.id))),
  };
  ozKursKeshi.set(user.id, { at: Date.now(), val });
  return val;
}

const BEGONA_KURS = 'Bu kurs sizga biriktirilmagan';
const BEGONA_OQUVCHI = "Bu o'quvchi sizning kurslaringizda emas";

async function ozKursXatosi(req) {
  if (!req.ruxsat?.faqatOz) return null;
  const parts = req.path.split('/').filter(Boolean);
  const resurs = parts[1];
  const id = parseInt(parts[2]);
  const oz = await ozKurslari(req.user);
  if (resurs === 'groups' && Number.isInteger(id) && !oz.groupIds.has(id)) return BEGONA_KURS;
  if (resurs === 'students' && Number.isInteger(id) && !oz.studentIds.has(id)) return BEGONA_OQUVCHI;
  if (resurs === 'attendances' && Number.isInteger(id)) {
    const a = await prisma.attendance.findUnique({ where: { id }, select: { groupId: true } });
    if (a && !oz.groupIds.has(a.groupId)) return BEGONA_KURS;
  }
  const gid = parseInt(req.body?.groupId ?? req.query?.groupId);
  if (Number.isInteger(gid) && !oz.groupIds.has(gid)) return BEGONA_KURS;
  const sid = parseInt(req.body?.studentId ?? req.query?.studentId);
  if (Number.isInteger(sid) && !oz.studentIds.has(sid)) return BEGONA_OQUVCHI;
  return null;
}

// Tashkilot bo'ylab umumiy yozuvlar: ruxsat filial emas, tashkilot bo'yicha.
const ORG_SHARED_RESOURCES = new Set(['syllabuses', 'topics']);

// Routes addressed by record id (/api/students/42) carry no schoolId, so the tenancy
// check has to come from the record itself. Anything not in this map is left alone.
const OWNED_RESOURCES = {
  students: 'student', teachers: 'teacher', groups: 'group', leads: 'lead',
  payments: 'payment', expenses: 'expense', transports: 'transport', courses: 'course',
  topics: 'topic', syllabuses: 'syllabus', rooms: 'room', exams: 'exam',
  questions: 'question', scores: 'score', attendances: 'attendance', routes: 'route',
  'salary-payments': 'salaryPayment', 'delivery-logs': 'deliveryLog',
  'exam-results': 'examResult', 'staff-attendance': 'staffAttendance', users: 'user',
};

// Returns an error message when the addressed record belongs to another customer.
export async function recordAccessError(req) {
  const parts = req.path.split('/').filter(Boolean);   // ['api','students','42', ...]
  if (parts[0] !== 'api' || parts.length < 3) return null;

  const id = parseInt(parts[2]);
  if (isNaN(id) || String(id) !== parts[2]) return null;

  // A school id addresses the tenant directly rather than a row inside one.
  if (parts[1] === 'schools') {
    return (await canAccessSchool(req.user, id)) ? null : 'Bu filialga ruxsatingiz yo\'q';
  }

  const model = OWNED_RESOURCES[parts[1]];
  if (!model) return null;

  const record = await prisma[model].findUnique({ where: { id }, select: { schoolId: true } });
  if (!record) return null;                    // let the handler answer 404 in its own words
  if (record.schoolId === null) return null;   // rows not bound to a school (e.g. superadmin users)
  if (ORG_SHARED_RESOURCES.has(parts[1])) {
    return (await sameOrganization(req.user, record.schoolId)) ? null : 'Bu yozuvga ruxsatingiz yo\'q';
  }
  return (await canAccessSchool(req.user, record.schoolId)) ? null : 'Bu yozuvga ruxsatingiz yo\'q';
}

// Authenticates the JWT and confirms the caller may act on the school it named.
// Every protected route passes through here, so the tenancy check lives in one place
// instead of being repeated (and forgotten) at each handler.
export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    // Tokens issued before sessions had an expiry never run out on their own.
    // Rejecting them once sends those users back through login for a fresh 90-day token.
    if (!payload?.exp) {
      return res.status(401).json({ error: 'Sessiya eskirgan, qaytadan kiring' });
    }

    try {
      // O'chirilgan yoki arxivga olingan xodimning tokeni endi ishlamaydi.
      const user = await freshUser(payload);
      if (!user) {
        return res.status(401).json({ error: 'Hisobingiz faol emas, administrator bilan bog\'laning' });
      }

      // Haydovchi uchun web CRM yopiq (u faqat Telegram botda ishlaydi).
      // Login ham rad etadi; bu — ilgari berilgan token bilan kirishning oldini
      // oladi.
      if (user.role === 'DRIVER') {
        return res.status(403).json({ error: "Haydovchilar Telegram bot orqali ishlaydi" });
      }
      // Texnik xodimga login berilmaydi (HR'da faqat maosh va davomat uchun).
      if (user.role === 'TECH_STAFF') {
        return res.status(403).json({ error: "Texnik xodimlar CRM ga kirmaydi" });
      }

      req.user = user;
      const wanted = requestedSchoolId(req);
      if (!(await canAccessSchool(user, wanted))) {
        return res.status(403).json({ error: 'Bu filial ma\'lumotlariga ruxsatingiz yo\'q' });
      }
      const recordError = await recordAccessError(req);
      if (recordError) return res.status(403).json({ error: recordError });

      // Lavozim ruxsati: bo'lim yopiq bo'lsa so'rov handlerga yetmaydi.
      // `ruxsat: true` — mijoz buni sessiya tugagani deb o'ylamasin.
      req.ruxsat = await foydalanuvchiRuxsati(user);
      const ruxsatError = await ruxsatXatosi(req);
      if (ruxsatError) return res.status(403).json({ error: ruxsatError, ruxsat: true });
      const ozError = await ozKursXatosi(req);
      if (ozError) return res.status(403).json({ error: ozError, ruxsat: true });

      // 0 is the "all branches" marker, not a branch a handler could scope a write to.
      req.schoolScope = (wanted === null || wanted === ALL_BRANCHES)
        ? (user.schoolId ?? null)
        : wanted;
      next();
    } catch (e) { next(e); }
  });
};

// Route-level role gate. SUPERADMIN passes everywhere by definition.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user?.role === 'SUPERADMIN' || roles.includes(req.user?.role)) return next();
    return res.status(403).json({ error: 'Bu amal uchun ruxsatingiz yo\'q' });
  };
}

export const STAFF_MANAGERS = ['ADMIN', 'MANAGER'];
