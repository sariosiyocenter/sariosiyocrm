// Values shared by the server entry point and the modules split out of it.

// A missing secret in production would silently sign tokens with a public string,
// letting anyone forge an admin session — so fail loudly instead.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET muhit o\'zgaruvchisi o\'rnatilmagan — server ishga tushmaydi.');
}

export const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret';

// Sessions last three months. Tokens used to be signed with no expiry at all, which
// meant a leaked one — or a former employee's — stayed valid forever.
export const TOKEN_TTL = '90d';

// How far back /api/init carries attendance. Only the marking screen needs same-day data
// on arrival; the group matrix, the calendar and a student's profile all fetch their own
// history from /api/attendances, so this stays deliberately small — with a full year
// imported, every extra week here costs roughly 100 KB on every app load.
export const ATTENDANCE_WINDOW_DAYS = 14;

export function attendanceWindowStart() {
  const d = new Date();
  d.setDate(d.getDate() - ATTENDANCE_WINDOW_DAYS);
  return d.toISOString().split('T')[0];
}

// Never write credentials to the log file — a stack trace is not worth a plaintext password.
const SENSITIVE_KEYS = ['password', 'eskizPassword', 'telegram', 'token', 'newPassword', 'oldPassword'];

export function redactBody(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = {};
  for (const [k, v] of Object.entries(body)) {
    clone[k] = SENSITIVE_KEYS.includes(k) ? '[REDACTED]' : v;
  }
  return clone;
}

export function isAdmin(user) {
  return user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
}

// Settings rows hold SMS/Telegram credentials. Only an admin has a reason to see them,
// so everyone else gets a boolean flag instead of the secret itself.
export function stripSettingSecrets(settings) {
  if (!settings) return settings;
  const { eskizPassword, telegram, ...safe } = settings;
  return { ...safe, eskizPasswordSet: !!eskizPassword, telegramSet: !!telegram };
}
