import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { JWT_SECRET } from '../lib/config.js';

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

// Which schools this user may touch. Staff may move between branches of their own
// organization (the branch switcher in the UI), but never into another customer's data.
export async function allowedSchoolIds(user) {
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

// The branch switcher's "To'liq o'quv markazi" option sends schoolId 0. It is not a
// real branch — it means "every branch I am allowed to see", which is exactly the set
// canAccessSchool already grants. Rejecting it used to answer 403, and the client reads
// a 403 as an expired session and logs the user out.
export const ALL_BRANCHES = 0;

export async function canAccessSchool(user, schoolId) {
  if (CROSS_SCHOOL_ROLES.includes(user?.role)) return true;
  if (schoolId === null) return true;              // request is not school-scoped
  if (schoolId === ALL_BRANCHES) return true;      // "all my branches", not one branch
  if (user?.schoolId === schoolId) return true;    // own branch — no lookup needed
  return (await allowedSchoolIds(user)).includes(schoolId);
}

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
  return (await canAccessSchool(req.user, record.schoolId)) ? null : 'Bu yozuvga ruxsatingiz yo\'q';
}

// Authenticates the JWT and confirms the caller may act on the school it named.
// Every protected route passes through here, so the tenancy check lives in one place
// instead of being repeated (and forgotten) at each handler.
export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    // Tokens issued before sessions had an expiry never run out on their own.
    // Rejecting them once sends those users back through login for a fresh 90-day token.
    if (!user?.exp) {
      return res.status(401).json({ error: 'Sessiya eskirgan, qaytadan kiring' });
    }

    req.user = user;
    try {
      const wanted = requestedSchoolId(req);
      if (!(await canAccessSchool(user, wanted))) {
        return res.status(403).json({ error: 'Bu filial ma\'lumotlariga ruxsatingiz yo\'q' });
      }
      const recordError = await recordAccessError(req);
      if (recordError) return res.status(403).json({ error: recordError });

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
