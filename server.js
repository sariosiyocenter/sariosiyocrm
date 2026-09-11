import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from './lib/prisma.js';
import { JWT_SECRET, TOKEN_TTL, attendanceWindowStart, redactBody, isAdmin, stripSettingSecrets, hidePaymeSecrets, cronRequestRejected } from './lib/config.js';
import { registerPaymeRoutes } from './routes/payme.js';
import { MODES as PAYME_MODES, generateEndpointToken as generatePaymeEndpointToken } from './services/payme.js';
import { authenticate, requireRole, STAFF_MANAGERS, canAccessSchool, allowedSchoolIds, ALL_BRANCHES } from './middleware/auth.js';
import { encryptSecret, decryptSecret } from './lib/secrets.js';
import { claimBillingRun, releaseBillingRun, processMonthlyBilling } from './services/billing.js';
import jwt from 'jsonwebtoken';
import bot, { startBot, notifyAdmins, getTelegramBot } from './src/bot/bot.js';
import { transferStudent, refundStudent, enrollStudent, unenrollStudent, syncGroupMembers, activateStudent, syncStudentGroups } from './services/enrollment.js';
import { studentLedger, receivedForGroups, monthCoverage } from './services/ledger.js';
import { holatniYozish, marshrutniTartiblash } from './services/logistics.js';
import { kunlikTolqinlar, haydovchilardanSorash, kunlikRejaniTuzish, avtoJarayon } from './services/kunlikReja.js';
import { toDateStr } from './lib/lessons.js';
import { smsYuboruvchiniUlash } from './services/transportNotify.js';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// import { scheduleAttendanceNotifications } from './src/utils/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

if (process.env.TELEGRAM_BOT_TOKEN && !process.env.VERCEL) {
  startBot();
} else if (process.env.VERCEL) {
  console.log('Vercel serverless environment detected. Telegram Bot polling disabled.');
} else {
  console.warn('TELEGRAM_BOT_TOKEN mavjud emas. Bot ishga tushmadi.');
}

const app = express();
const PORT = process.env.PORT || 3000;
// Vercel terminates TLS upstream; without this the rate limiter sees one shared IP.
app.set('trust proxy', 1);

// Content Security Policy.
//
// Scripts are restricted to this origin plus the two CDNs index.html loads with SRI
// hashes, so an injected <script src> to anywhere else is blocked. Styles still need
// 'unsafe-inline': the SPA renders inline <style> blocks for print layouts and the
// theme picker injects a <style> element at runtime. Images allow the Supabase bucket
// that stores photos, and data: for the ones still held inline.
const SUPABASE_ORIGIN = (() => {
  try { return new URL(process.env.SUPABASE_URL).origin; } catch { return ''; }
})();

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', SUPABASE_ORIGIN, 'https://unpkg.com', 'https://*.tile.openstreetmap.org'].filter(Boolean),
      // The settings screen verifies the Telegram bot token straight from the browser.
      // jsDelivr is where face-api.js downloads its model weights from: without it
      // Face ID failed at "Modellar yuklanmoqda..." on every attempt, because the
      // weights are fetch() calls and connect-src did not allow the CDN.
      connectSrc: ["'self'", SUPABASE_ORIGIN, 'https://api.telegram.org', 'https://cdn.jsdelivr.net'].filter(Boolean),
      mediaSrc: ["'self'", 'blob:', 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ limit: '3mb', extended: true }));

// Brute-force guard: the login route was previously unlimited.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.' },
});

// Public forms have no captcha yet; this keeps a script from flooding the leads table.
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p ariza yuborildi. Birozdan keyin qayta urinib ko\'ring.' },
});

// Lazy Cron background execution for automatic message rules (throttled to once every 10 minutes)
let lastLazyCronRun = 0;
app.use((req, res, next) => {
  // Payme webhook'i istisno: u tez va bir xil javob berishi kerak, orqa fon
  // ishi unga kechikish qo'shmasin.
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/payme/') && Date.now() - lastLazyCronRun > 10 * 60 * 1000) {
    lastLazyCronRun = Date.now();
    (async () => {
      try {
        console.log('[Lazy Cron] Triggering background auto-process check...');
        await runAutoProcessJobs();
      } catch (err) {
        console.error('[Lazy Cron Error]:', err);
      }
    })();
  }
  next();
});

// Basic API to verify backend status
app.get('/api/status', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// --- Telegram Bot Webhook & Setup ---
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    if (process.env.TELEGRAM_BOT_TOKEN) {
      await bot.handleUpdate(req.body, res);
    } else {
      res.status(500).json({ error: 'Telegram Bot Token not configured' });
    }
  } catch (error) {
    console.error('Telegram Webhook error:', error);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

app.post('/api/telegram-webhook/:schoolId', async (req, res) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    const schoolBot = await getTelegramBot(schoolId);
    if (schoolBot) {
      await schoolBot.handleUpdate(req.body, res);
    } else {
      res.status(404).json({ error: `Telegram Bot not configured for school ${schoolId}` });
    }
  } catch (error) {
    console.error(`Telegram Webhook error for school ${req.params.schoolId}:`, error);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

app.get('/api/telegram-setup', async (req, res) => {
  try {
    const { schoolId } = req.query;
    const sId = schoolId ? parseInt(schoolId) : 1;
    const schoolBot = await getTelegramBot(sId);
    if (!schoolBot) {
      return res.status(400).json({ success: false, error: `Telegram Bot not configured for school ${sId}` });
    }
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    
    const webhookUrl = sId === 1 
      ? `${protocol}://${host}/api/telegram-webhook`
      : `${protocol}://${host}/api/telegram-webhook/${sId}`;
    
    await schoolBot.telegram.setWebhook(webhookUrl);
    res.json({ success: true, message: `Telegram Webhook set to: ${webhookUrl}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Auth Routes ---
app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email va parol kiritilishi shart' });

    // ── SUPERADMIN: .env dan tekshiriladi, DB ga murojaat qilinmaydi ──
    const saEmail = process.env.SUPERADMIN_EMAIL;
    const saPass  = process.env.SUPERADMIN_PASSWORD;
    if (saEmail && saPass && email === saEmail && password === saPass) {
      const token = jwt.sign(
        { id: 0, email: saEmail, role: 'SUPERADMIN', schoolId: null },
        JWT_SECRET,
        { expiresIn: TOKEN_TTL }
      );
      return res.json({
        token,
        user: { id: 0, email: saEmail, name: 'Super Admin', role: 'SUPERADMIN', schoolId: null }
      });
    }

    // ── Oddiy foydalanuvchilar ──
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        school: {
          include: {
            organization: true
          }
        }
      }
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email yoki parol xato' });
    }

    // Haydovchi CRM ga kirmaydi: uning butun ishi Telegram botda —
    // bugungi reyslar, navigatsiya va belgilash. Web'da unga ko'rsatadigan
    // narsa yo'q, ochiq qoldirilsa esa ortiqcha ma'lumot ko'rinib qolardi.
    if (user.role === 'DRIVER') {
      return res.status(403).json({
        error: "Haydovchilar CRM ga kirmaydi. Telegram botni oching va kontaktingizni ulashing — bugungi reyslar o'sha yerda.",
      });
    }

    if (user.school && user.school.organization) {
      const org = user.school.organization;
      if (org.status === 'Muzlatilgan') {
        return res.status(403).json({ error: 'Tashkilotingiz obunasi muzlatilgan. Administrator bilan bog\'laning.' });
      }
      if (org.expiresAt && new Date(org.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Tashkilotingiz obuna muddati tugagan. Iltimos, to\'lov qiling.' });
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId } });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    // SUPERADMIN DB da saqlanmaydi
    if (req.user.role === 'SUPERADMIN') {
      return res.json({ id: 0, email: req.user.email, name: 'Super Admin', role: 'SUPERADMIN', schoolId: null });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId });
  } catch (error) { next(error); }
});

// Har bir xodim o'z parolini o'zgartira oladi. /api/users/:id faqat ADMIN/MANAGER
// uchun ochiq, shuning uchun bu alohida yo'l — eski parolni tekshirib almashtiradi.
app.post('/api/auth/change-password', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'SUPERADMIN') {
      return res.status(400).json({ error: 'Super admin paroli bazada saqlanmaydi' });
    }
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Eski va yangi parol kerak' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: "Yangi parol kamida 6 ta belgidan iborat bo'lsin" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return res.status(400).json({ error: "Eski parol noto'g'ri" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 10) }
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Ustoz <-> xodim bog'lanishi -------------------------------------------
//
// Bazada bir odam ikki joyda turadi: Teacher (guruh, davomat, dars haqi) va
// User (kirish, oylik, ish grafigi). Ilgari ular faqat ISM bo'yicha
// topishardi. Natijada Teacher yozuvi bor, User yozuvi yo'q "eski" ustozlar
// paydo bo'lgan: ularga alohida, qashshoq profil ochilardi — oylik berish
// tugmasi ham, davomat ham, Telegram xabari ham yo'q edi. Rahbar aynan shuni
// ko'rgan: "nimaga bir xil interfeys emas".
//
// Endi bog'lanish Teacher.userId da. Ismga qarab qidirish faqat hali
// bog'lanmagan eski yozuvlar uchun qoladi.
const USTOZ_ROLLAR = ['TEACHER', 'SUPPORT_TEACHER'];

/**
 * Ustoz yozuvidagi maosh maydonlarini xodim kartasiga moslaydi.
 *
 * Teacher.salary / sharePercentage / salaryType eskirgan: oylik xodim
 * kartasidagi salary va kpiPercent dan hisoblanadi. Ustunlarni o'chirib
 * tashlash o'rniga (eski kod va Telegram bot ularni o'qiydi) ular shu yerda
 * nusxa qilib turiladi — shunda ikki xil raqam paydo bo'lmaydi.
 */
function ustozMaoshi(user, ustoz) {
  const maosh = Math.round(Number(user.salary) || 0);
  const foiz = Math.round(Number(user.kpiPercent) || 0);
  const turi = maosh > 0 && foiz > 0 ? 'FIXED_KPI' : foiz > 0 ? 'KPI' : 'FIXED';
  const data = {};
  if (!ustoz || Math.round(Number(ustoz.salary) || 0) !== maosh) data.salary = maosh;
  if (!ustoz || Math.round(Number(ustoz.sharePercentage) || 0) !== foiz) data.sharePercentage = foiz;
  if (!ustoz || ustoz.salaryType !== turi) data.salaryType = turi;
  return data;
}

/** Xodim yozuviga tegishli ustoz yozuvi. */
async function ustozniTop(user, db = prisma) {
  if (!user) return null;
  const bogliq = await db.teacher.findFirst({ where: { userId: user.id } });
  if (bogliq) return bogliq;
  if (user.schoolId == null) return null;
  return await db.teacher.findFirst({
    where: { name: user.name, schoolId: user.schoolId, userId: null }
  });
}

/** Ustoz yozuviga tegishli xodim yozuvi. */
async function xodimniTop(teacher, db = prisma) {
  if (!teacher) return null;
  if (teacher.userId) return await db.user.findUnique({ where: { id: teacher.userId } });
  return await db.user.findFirst({
    where: { name: teacher.name, schoolId: teacher.schoolId, teacherProfile: { is: null } }
  });
}

/**
 * Ustozga xodim hisobi ochadi. Email va parol o'ylab topiladi: ustoz tizimga
 * kirmasligi mumkin, lekin oylik, davomat va Telegram xabari uchun User yozuvi
 * shart. Parolni keyin rahbar HR bo'limidan o'zgartiradi.
 */
async function ustozgaXodimYarat(teacher, db = prisma) {
  const belgi = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const user = await db.user.create({
    data: {
      email: 'ustoz_' + teacher.id + '_' + belgi + '@internal.local',
      password: await bcrypt.hash(Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), 10),
      name: teacher.name,
      phone: teacher.phone || null,
      photo: teacher.photo || null,
      position: "O'qituvchi",
      salary: Math.round(Number(teacher.salary) || 0),
      kpiPercent: Math.round(Number(teacher.sharePercentage) || 0),
      role: 'TEACHER',
      status: teacher.status === 'Arxiv' ? 'Arxiv' : 'Faol',
      schoolId: teacher.schoolId,
      telegramId: null
    }
  });
  // Bog'lashni faqat userId hali bo'sh bo'lsa bajaramiz. Sahifa ochilganda
  // /api/init va /api/teachers deyarli bir vaqtda keladi va ikkalasi ham shu
  // yerga tushardi: natijada bitta ustozga ikkita xodim yozuvi yaratilib
  // qolgan edi. Yutqazgan urinish o'zi yaratgan yozuvni olib tashlaydi.
  const natija = await db.teacher.updateMany({
    where: { id: teacher.id, userId: null },
    data: { userId: user.id }
  });
  if (natija.count === 0) {
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
    return null;
  }
  return user;
}

/**
 * Bog'lanmagan ustozlarni xodim yozuvi bilan bog'laydi, mos xodim topilmasa
 * yangisini ochadi. Har safar chaqirilavermaydi: chaqiruvchi avval
 * `userId === null` ustoz borligini tekshiradi, shuning uchun bir marta
 * tuzalgandan keyin bu kod umuman ishlamaydi.
 */
// Bir vaqtning o'zida bittadan ortiq tuzatish ishlamasin: sahifa ochilganda
// /api/init va /api/teachers deyarli bir paytda keladi.
let boglashJarayoni = null;
function ustozlarniXodimgaBogla(schoolIds) {
  if (boglashJarayoni) return boglashJarayoni;
  boglashJarayoni = ustozlarniXodimgaBoglaIchki(schoolIds)
    .finally(() => { boglashJarayoni = null; });
  return boglashJarayoni;
}

async function ustozlarniXodimgaBoglaIchki(schoolIds) {
  const bogsizlar = await prisma.teacher.findMany({
    where: { userId: null, ...(schoolIds && schoolIds.length ? { schoolId: { in: schoolIds } } : {}) }
  });
  if (bogsizlar.length === 0) return 0;

  let ozgardi = 0;
  for (const ustoz of bogsizlar) {
    try {
      const mavjud = await prisma.user.findFirst({
        where: {
          name: ustoz.name,
          schoolId: ustoz.schoolId,
          teacherProfile: { is: null }
        }
      });
      if (mavjud) {
        await prisma.teacher.updateMany({
          where: { id: ustoz.id, userId: null },
          data: { userId: mavjud.id }
        });
      } else {
        await ustozgaXodimYarat(ustoz);
      }
      ozgardi++;
    } catch (e) {
      console.error("[Ustozni bog'lash]", ustoz.id, e.message);
    }
  }
  return ozgardi;
}

// --- User Management (Admin only) ---
app.get('/api/users', authenticate, async (req, res, next) => {
  try {
    // SUPERADMIN xodim qo'sha va o'chira olardi, lekin ro'yxatni ko'ra
    // olmasdi. Markaz administratori yo'qolgan holatda uni tiklash uchun
    // aynan shu ro'yxat kerak.
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Ruhsat yo' });
    }

    const { schoolId } = req.query;
    let where = {};

    if (req.user.role === 'MANAGER') {
      where = { schoolId: req.user.schoolId, role: { not: 'ADMIN' } };
    } else if (schoolId && !isNaN(parseInt(schoolId))) {
      where = { schoolId: parseInt(schoolId) };
    }

    // teacherProfile ham qaytadi: HR ro'yxatidagi "Guruh" va "Haftalik yuklama"
    // ustunlari ustoz yozuvining raqamiga tayanadi. Ilgari bu maydon javobda
    // yo'q edi va ustozlarning guruhlari ro'yxatda hech qachon ko'rinmasdi.
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, phone: true, photo: true, position: true,
        salary: true, workDays: true, kpiPercent: true, role: true, createdAt: true,
        schoolId: true, status: true, telegramId: true,
        teacherProfile: { select: { id: true } }
      }
    });
    res.json(users.map(u => {
      const { teacherProfile, ...qolgan } = u;
      return { ...qolgan, teacherId: teacherProfile?.id ?? null };
    }));
  } catch (error) { next(error); }
});

app.post('/api/users', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruhsat yo' });

    let { email, password, name, phone, photo, position, salary, role, schoolId, kpiPercent } = req.body;
    photo = await rasmQiymatiniTozala(photo, 'user');

    if (req.user.role === 'MANAGER' && (role === 'ADMIN' || role === 'MANAGER')) {
      return res.status(403).json({ error: 'Menejer faqat o\'qituvchi va resepshn qo\'sha oladi' });
    }

    // TECH_STAFF doesn't need a real login — auto-generate credentials
    if (role === 'TECH_STAFF') {
      email = email || `tech_${Date.now()}_${Math.random().toString(36).slice(2)}@internal.local`;
      password = password || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }

    if (!email) return res.status(400).json({ error: 'Email majburiy' });
    if (!password) return res.status(400).json({ error: 'Parol majburiy' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const targetSchoolId = req.user.role === 'MANAGER' ? req.user.schoolId : (schoolId ? parseInt(schoolId) : null);

    if (isNaN(targetSchoolId) && targetSchoolId !== null) return res.status(400).json({ error: 'Invalid schoolId' });

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone: phone || null,
          photo: photo || null,
          position: position || null,
          salary: salary ? parseInt(salary) : 0,
          kpiPercent: kpiPercent ? parseInt(kpiPercent) : 0,
          role,
          schoolId: targetSchoolId
        }
      });
    } catch (createErr) {
      if (createErr.code === 'P2002') {
        return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
      }
      throw createErr;
    }

    // Ustoz roli uchun Teacher yozuvi ham ochiladi va darhol shu xodimga
    // bog'lanadi (userId). Ilgari bog'lanish yo'q edi — ism o'zgarishi bilan
    // ikkovi bir-birini "yo'qotardi".
    if (USTOZ_ROLLAR.includes(role) && targetSchoolId) {
      try {
        const mavjud = await prisma.teacher.findFirst({
          where: { name: user.name, schoolId: targetSchoolId, userId: null }
        });
        if (mavjud) {
          await prisma.teacher.update({ where: { id: mavjud.id }, data: { userId: user.id } });
        } else {
          await prisma.teacher.create({
            data: {
              name: user.name,
              phone: user.phone || '',
              salary: user.salary || 0,
              sharePercentage: user.kpiPercent || 0,
              lessonFee: 0,
              birthDate: '',
              hiredDate: new Date().toISOString().split('T')[0],
              status: 'Faol',
              schoolId: targetSchoolId,
              userId: user.id
            }
          });
        }
      } catch (teacherError) {
        console.error('Failed to auto-create teacher profile:', teacherError);
      }
    }

    res.json({ ...user, password: undefined });
  } catch (error) { next(error); }
});

// Xodim ustida amal qilishdan oldingi umumiy tekshiruvlar.
// Xato bo'lsa {status, error} qaytaradi, hammasi joyida bo'lsa null.
async function xodimAmaliTekshir(req, targetId) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { status: 404, error: 'Xodim topilmadi' };

  const isSuper = req.user.role === 'SUPERADMIN';

  // Filial chegarasi. Ilgari bu yo'q edi: bir filial admini boshqa
  // filialning xodimini ham tahrirlay va o'chira olardi.
  if (!isSuper && target.schoolId !== req.user.schoolId) {
    return { status: 403, error: 'Bu xodim boshqa filialga tegishli' };
  }

  // Menejer ADMIN ustida hech qanday amal qila olmaydi.
  if (req.user.role === 'MANAGER' && target.role === 'ADMIN') {
    return { status: 403, error: 'Menejer administratorni o\'zgartira olmaydi' };
  }

  return { target, isSuper };
}

// Markazda boshqa ADMIN qoladimi? Oxirgisini o'chirish yoki lavozimini
// tushirish markazni boshsiz qoldiradi.
async function oxirgiAdminmi(target) {
  if (target.role !== 'ADMIN') return false;
  const soni = await prisma.user.count({
    where: { schoolId: target.schoolId, role: 'ADMIN' }
  });
  return soni <= 1;
}

app.put('/api/users/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Faqat ADMIN/MANAGER tahrirlay oladi' });
    }
    const { id } = req.params;
    const targetId = parseInt(id);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Xodim raqami noto\'g\'ri' });

    const tekshir = await xodimAmaliTekshir(req, targetId);
    if (tekshir.error) return res.status(tekshir.status).json({ error: tekshir.error });
    const { target } = tekshir;

    let { email, name, phone, photo, position, salary, role, password, workDays, kpiPercent, status } = req.body;
    photo = await rasmQiymatiniTozala(photo, 'user');

    if (role !== undefined && role !== target.role) {
      // Menejer o'zini yoki boshqani ADMIN/MANAGER qilib ko'tara olmaydi.
      // Xodim qo'shishda bu taqiqlangan edi, tahrirlashda unutilgan.
      if (req.user.role === 'MANAGER' && (role === 'ADMIN' || role === 'MANAGER')) {
        return res.status(403).json({ error: 'Menejer bu lavozimni bera olmaydi' });
      }
      // O'z lavozimini o'zi o'zgartira olmaydi.
      if (target.id === req.user.id) {
        return res.status(400).json({ error: 'O\'z lavozimingizni o\'zingiz o\'zgartira olmaysiz' });
      }
      // Oxirgi administratorni tushirish markazni boshsiz qoldiradi.
      if (await oxirgiAdminmi(target)) {
        return res.status(400).json({ error: 'Bu markazdagi yagona administrator. Avval boshqa administrator tayinlang' });
      }
    }

    const data = {};
    if (email !== undefined) data.email = email;
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (photo !== undefined) data.photo = photo;
    if (position !== undefined) data.position = position;
    if (salary !== undefined) data.salary = salary ? parseInt(salary) : 0;
    if (role !== undefined) data.role = role;
    if (workDays !== undefined) data.workDays = workDays;
    if (kpiPercent !== undefined) data.kpiPercent = parseInt(kpiPercent) || 0;
    // Arxivga olish: davomat yoki oylik yozuvi bor xodimni o'chirib bo'lmaydi,
    // shuning uchun uni ro'yxatdan olib qo'yamiz.
    if (status !== undefined) {
      if (!['Faol', 'Arxiv'].includes(status)) {
        return res.status(400).json({ error: "Holat faqat 'Faol' yoki 'Arxiv' bo'lishi mumkin" });
      }
      // Yagona administratorni arxivga olish markazni boshsiz qoldiradi.
      if (status === 'Arxiv' && await oxirgiAdminmi(target)) {
        return res.status(400).json({ error: 'Bu markazdagi yagona administrator. Avval boshqa administrator tayinlang' });
      }
      if (status === 'Arxiv' && target.id === req.user.id) {
        return res.status(400).json({ error: "O'z hisobingizni o'zingiz arxivga ola olmaysiz" });
      }
      data.status = status;
    }
    if (password) data.password = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await prisma.user.update({
        where: { id: parseInt(id) },
        data,
        select: { id: true, email: true, name: true, phone: true, photo: true, position: true, salary: true, workDays: true, kpiPercent: true, role: true, createdAt: true, schoolId: true, status: true }
      });
    } catch (updateErr) {
      if (updateErr.code === 'P2002') return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
      throw updateErr;
    }

    // Ustoz yozuvi xodim yozuvidan ortda qolmasin: ism guruh kartochkalarida,
    // telefon va surat esa dars jadvalida ko'rinadi. Ilgari xodimning ismi
    // o'zgartirilsa, ustoz yozuvi eski ism bilan qolib ketardi va ikkovining
    // bog'lanishi (o'shanda ism bo'yicha edi) butunlay uzilardi.
    try {
      const ustoz = await ustozniTop(user);
      if (ustoz) {
        const ustozData = {};
        if (name !== undefined && name !== ustoz.name) ustozData.name = name;
        if (phone !== undefined && (phone || '') !== ustoz.phone) ustozData.phone = phone || '';
        if (photo !== undefined && photo !== ustoz.photo) ustozData.photo = photo || null;
        if (data.status === 'Arxiv' && ustoz.status !== 'Arxiv') ustozData.status = 'Arxiv';
        if (data.status === 'Faol' && ustoz.status === 'Arxiv') ustozData.status = 'Faol';
        if (!ustoz.userId) ustozData.userId = user.id;
        // Maosh raqamlari ikki jadvalda yotardi va bir-biriga mos kelmasdi:
        // CRM User.salary/kpiPercent dan hisoblar, Telegram bot esa
        // Teacher.salary/sharePercentage ni ko'rsatar edi. Endi yagona manba
        // xodim kartasi, ustoz yozuvi esa undan nusxa oladi.
        Object.assign(ustozData, ustozMaoshi(user, ustoz));
        if (Object.keys(ustozData).length) {
          await prisma.teacher.update({ where: { id: ustoz.id }, data: ustozData });
        }
      } else if (USTOZ_ROLLAR.includes(user.role) && user.schoolId) {
        // Lavozimi o'qituvchiga o'zgartirilgan xodimga ustoz yozuvi ochiladi,
        // aks holda unga guruh biriktirib bo'lmaydi.
        await prisma.teacher.create({
          data: {
            name: user.name,
            phone: user.phone || '',
            salary: user.salary || 0,
            sharePercentage: user.kpiPercent || 0,
            lessonFee: 0,
            birthDate: '',
            hiredDate: new Date().toISOString().split('T')[0],
            status: user.status === 'Arxiv' ? 'Arxiv' : 'Faol',
            schoolId: user.schoolId,
            userId: user.id
          }
        });
      }
    } catch (e) {
      console.error('[Ustoz yozuvini moslash]', e.message);
    }

    res.json(user);
  } catch (error) { next(error); }
});

app.delete('/api/users/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Faqat ADMIN o\'chira oladi' });
    }
    const { id } = req.params;
    const targetId = parseInt(id);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Xodim raqami noto\'g\'ri' });

    const tekshir = await xodimAmaliTekshir(req, targetId);
    if (tekshir.error) return res.status(tekshir.status).json({ error: tekshir.error });
    const { target } = tekshir;

    // O'zini o'zi o'chirish. Aynan shu holat sodir bo'lgan: markaz rahbari
    // HR bo'limidan o'z hisobini o'chirib yuborgan va markaz boshsiz qolgan.
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'O\'z hisobingizni o\'zingiz o\'chira olmaysiz' });
    }

    // Markazning yagona administratori.
    if (await oxirgiAdminmi(target)) {
      return res.status(400).json({ error: 'Bu markazdagi yagona administrator. Avval boshqa administrator tayinlang' });
    }

    // Davomat va oylik yozuvlari xodimni o'chirishga to'sqinlik qiladi (ikkala
    // bog'lanish ham Restrict). Ilgari bu Prisma xatosi bo'lib chiqar, sabab esa
    // ekranda ko'rinmasdi. Endi oldindan sanaymiz va nima qilish kerakligini
    // aytamiz — bunday xodim arxivga olinadi.
    const [davomatSoni, oylikSoni] = await Promise.all([
      prisma.staffAttendance.count({ where: { userId: targetId } }),
      prisma.salaryPayment.count({ where: { userId: targetId } })
    ]);
    // Rahbar baribir butunlay o'chirishni tanlasa (force), bog'langan yozuvlarni
    // ham olib tashlaymiz. Oylik yozuvi Moliyadagi xarajat bilan bog'langan —
    // u ham ketadi, aks holda kassada egasiz xarajat qolib ketadi.
    const majburiy = String(req.query.force || '') === '1' || req.body?.force === true;

    if ((davomatSoni > 0 || oylikSoni > 0) && majburiy) {
      const oyliklar = await prisma.salaryPayment.findMany({
        where: { userId: targetId },
        select: { expenseId: true }
      });
      const xarajatIds = oyliklar.map(o => o.expenseId).filter(Boolean);
      await prisma.$transaction(async (tx) => {
        await tx.staffAttendance.deleteMany({ where: { userId: targetId } });
        await tx.salaryPayment.deleteMany({ where: { userId: targetId } });
        if (xarajatIds.length) await tx.expense.deleteMany({ where: { id: { in: xarajatIds } } });
      });
    } else if (davomatSoni > 0 || oylikSoni > 0) {
      const qismlar = [];
      if (davomatSoni > 0) qismlar.push(davomatSoni + ' ta davomat');
      if (oylikSoni > 0) qismlar.push(oylikSoni + ' ta oylik');
      return res.status(400).json({
        error: 'Bu xodimda ' + qismlar.join(' va ') + ' yozuvi bor. Arxivga olsangiz ro\'yxatdan yo\'qoladi, tarix saqlanadi. Butunlay o\'chirsangiz shu yozuvlar ham, Moliyadagi oylik xarajati bilan birga, o\'chib ketadi.',
        canArchive: true,
        canForce: true
      });
    }

    // TEACHER roli uchun avtomatik yaratilgan Teacher yozuvi ham ketsin, aks
    // holda u HR ro'yxatida "eski" qator bo'lib qaytib chiqadi. Ikkalasi ism
    // bo'yicha bog'langan, shuning uchun qidiruv ham ism bo'yicha.
    if (USTOZ_ROLLAR.includes(target.role)) {
      try {
        const teacher = await ustozniTop(target);
        if (teacher) {
          const guruhSoni = await prisma.group.count({ where: { teacherId: teacher.id } });
          const tDavomat = await prisma.teacherAttendance.count({ where: { teacherId: teacher.id } });
          if (guruhSoni === 0 && (tDavomat === 0 || majburiy)) {
            if (tDavomat > 0) await prisma.teacherAttendance.deleteMany({ where: { teacherId: teacher.id } });
            await prisma.teacher.delete({ where: { id: teacher.id } });
          } else {
            // Guruhi bor ustozni o'chirib bo'lmaydi — arxivga olamiz.
            await prisma.teacher.update({ where: { id: teacher.id }, data: { status: 'Arxiv' } });
          }
        }
      } catch (e) {
        console.error('Teacher tozalashda xato:', e.message);
      }
    }

    try {
      await prisma.user.delete({ where: { id: targetId } });
    } catch (delErr) {
      if (delErr.code === 'P2003' || delErr.code === 'P2014') {
        return res.status(400).json({
          error: 'Bu xodimga bog\'langan yozuvlar bor, shuning uchun o\'chirib bo\'lmaydi. Uni arxivga oling.',
          canArchive: true
        });
      }
      throw delErr;
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get('/api/staff-attendance', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId, month } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const where = { userId: parseInt(userId) };
    if (month) where.date = { startsWith: String(month) };
    const records = await prisma.staffAttendance.findMany({ where, orderBy: { date: 'asc' } });
    res.json(records);
  } catch (error) { next(error); }
});

app.post('/api/staff-attendance', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId, date, status } = req.body;
    const schoolId = req.user.schoolId;
    const record = await prisma.staffAttendance.upsert({
      where: { userId_date: { userId: parseInt(userId), date } },
      update: { status },
      create: { userId: parseInt(userId), date, status, schoolId }
    });
    res.json(record);
  } catch (error) { next(error); }
});

app.delete('/api/staff-attendance', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId, date } = req.query;
    await prisma.staffAttendance.deleteMany({ where: { userId: parseInt(userId), date: String(date) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});


// Oylik to'lovlari. SUPERADMIN ham ko'ra oladi: ilgari u 403 olardi, klient esa
// javobni tekshirmasdan bo'sh massiv qilib qo'yardi va hamma oy "to'lanmagan"
// bo'lib ko'rinardi.
app.get('/api/salary-payments', authenticate, async (req, res, next) => {
  try {
    if (!['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Bu ma'lumotni ko'rishga ruxsatingiz yo'q" });
    }
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const payments = await prisma.salaryPayment.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { month: 'desc' }
    });
    res.json(payments);
  } catch (error) { next(error); }
});

/**
 * Oylik haqida xodimning o'ziga Telegram xabari.
 *
 * Telegram id ikki joyda bo'lishi mumkin: xodim yozuvida (User) yoki unga
 * bog'langan ustoz yozuvida (Teacher) — bot ustozni aynan o'sha yerga
 * bog'laydi. Xabar yuborilmasa oylik baribir berilgan bo'ladi, shuning uchun
 * bu yerdagi xato butun amalni to'xtatmaydi.
 */
async function oylikXabariniYubor(userId, schoolId, matn) {
  try {
    const xodim = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, telegramId: true, schoolId: true }
    });
    if (!xodim) return { sent: false, reason: 'xodim topilmadi' };

    let chatId = xodim.telegramId;
    if (!chatId) {
      const ustoz = await ustozniTop({ id: userId, name: xodim.name, schoolId: xodim.schoolId || schoolId });
      chatId = ustoz?.telegramId || null;
    }
    if (!chatId) return { sent: false, reason: 'telegram ulanmagan' };

    const schoolBot = await getTelegramBot(schoolId);
    if (!schoolBot) return { sent: false, reason: 'bot sozlanmagan' };

    await schoolBot.telegram.sendMessage(chatId, matn);
    return { sent: true };
  } catch (e) {
    console.error('[Oylik xabari]', e.message);
    return { sent: false, reason: e.message };
  }
}

// Oylik berish. Xarajat va oylik yozuvi bitta tranzaksiyada yaratiladi:
// ilgari xarajat avval yozilar, oylik yozuvi yiqilsa (masalan o'sha oy uchun
// allaqachon to'langan bo'lsa) Moliyada yetim xarajat qolib ketardi va har
// urinishda takrorlanardi.
app.post('/api/salary-payments', authenticate, async (req, res, next) => {
  try {
    if (!['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Oylik berishga ruxsatingiz yo'q" });
    }
    const { userId, month, amount, baseSalary, bonuses, fines, note } = req.body;
    const parsedUserId = parseInt(userId);
    const parsedAmount = parseInt(amount);
    if (!Number.isInteger(parsedUserId)) return res.status(400).json({ error: "Xodim tanlanmagan" });
    if (!month) return res.status(400).json({ error: "Oy ko'rsatilmagan" });
    if (!Number.isFinite(parsedAmount)) return res.status(400).json({ error: "Summa noto'g'ri" });

    const employee = await prisma.user.findUnique({
      where: { id: parsedUserId },
      select: { name: true, schoolId: true }
    });
    if (!employee) return res.status(404).json({ error: 'Xodim topilmadi' });

    // Xodimning o'z filiali. Ilgari req.user.schoolId olinardi va filial
    // almashtirilgan bo'lsa yozuv boshqa filialga tushib ketardi.
    const schoolId = employee.schoolId || req.schoolScope || req.user.schoolId;
    if (!schoolId) return res.status(400).json({ error: "Xodim filialga biriktirilmagan" });

    const empName = employee.name || 'Xodim';

    try {
      const payment = await prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            amount: parsedAmount,
            category: 'Ish haqi',
            date: new Date().toISOString().split('T')[0],
            description: empName + ' \u2014 ' + month + ' oy maoshi',
            schoolId
          }
        });
        return await tx.salaryPayment.create({
          data: {
            userId: parsedUserId,
            month,
            amount: parsedAmount,
            baseSalary: parseInt(baseSalary) || 0,
            bonuses: parseInt(bonuses) || 0,
            fines: parseInt(fines) || 0,
            note: note || null,
            expenseId: expense.id,
            schoolId
          }
        });
      });

      // Xodim oylik olganini bilsin. Rahbar aynan shuni so'ragan edi:
      // "moliya bo'limida ham telegramdan ham aks etmayapdi".
      const satrlar = [
        '\u{1F4B0} Oylik berildi',
        '',
        '\u{1F464} ' + empName,
        '\u{1F4C5} Oy: ' + month,
        '\u{1F4B5} Summa: ' + parsedAmount.toLocaleString('ru-RU') + " so'm",
      ];
      if (parseInt(bonuses) > 0) satrlar.push('⭐ Bonus: ' + parseInt(bonuses).toLocaleString('ru-RU'));
      if (parseInt(fines) > 0)   satrlar.push('⚠️ Ushlanma: ' + parseInt(fines).toLocaleString('ru-RU'));
      if (note) satrlar.push('\u{1F4DD} ' + note);
      const xabar = await oylikXabariniYubor(parsedUserId, schoolId, satrlar.join(String.fromCharCode(10)));

      res.json({ ...payment, telegram: xabar });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: "Bu oy uchun oylik allaqachon berilgan. O'zgartirish uchun \"Tahrirlash\" tugmasidan foydalaning." });
      }
      throw err;
    }
  } catch (error) { next(error); }
});

// Berilgan oylikni tuzatish. Ilgari bunday yo'l umuman yo'q edi — xato summa
// kiritilsa yozuvni o'chirib, qaytadan yaratishdan boshqa chora qolmasdi.
app.put('/api/salary-payments/:id', authenticate, async (req, res, next) => {
  try {
    if (!['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Oylikni o'zgartirishga ruxsatingiz yo'q" });
    }
    const pid = parseInt(req.params.id);
    if (!Number.isInteger(pid)) return res.status(400).json({ error: "Noto'g'ri ID" });

    const existing = await prisma.salaryPayment.findUnique({ where: { id: pid } });
    if (!existing) return res.status(404).json({ error: 'Oylik yozuvi topilmadi' });

    const { amount, baseSalary, bonuses, fines, note } = req.body;
    const data = {};
    if (amount !== undefined) {
      const v = parseInt(amount);
      if (!Number.isFinite(v)) return res.status(400).json({ error: "Summa noto'g'ri" });
      data.amount = v;
    }
    if (baseSalary !== undefined) data.baseSalary = parseInt(baseSalary) || 0;
    if (bonuses !== undefined) data.bonuses = parseInt(bonuses) || 0;
    if (fines !== undefined) data.fines = parseInt(fines) || 0;
    if (note !== undefined) data.note = note || null;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "O'zgartirish uchun ma'lumot yo'q" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Moliyadagi xarajat ham summaga ergashsin, aks holda kassa va oylik
      // yozuvi bir-biriga mos kelmay qoladi.
      if (data.amount !== undefined && existing.expenseId) {
        await tx.expense.updateMany({
          where: { id: existing.expenseId },
          data: { amount: data.amount }
        });
      }
      return await tx.salaryPayment.update({ where: { id: pid }, data });
    });

    // Tuzatilgan summani ham xodim bilsin — aks holda u eski summani biladi.
    let telegram = { sent: false, reason: 'summa o\'zgarmadi' };
    if (data.amount !== undefined) {
      const satrlar = [
        '\u{1F504} Oylik tuzatildi',
        '',
        '\u{1F4C5} Oy: ' + existing.month,
        '\u{1F4B5} Yangi summa: ' + updated.amount.toLocaleString('ru-RU') + " so'm",
      ];
      if (updated.note) satrlar.push('\u{1F4DD} ' + updated.note);
      telegram = await oylikXabariniYubor(existing.userId, existing.schoolId, satrlar.join(String.fromCharCode(10)));
    }
    res.json({ ...updated, telegram });
  } catch (error) { next(error); }
});

app.delete('/api/salary-payments/:id', authenticate, async (req, res, next) => {
  try {
    if (!['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "O'chirishga ruxsatingiz yo'q" });
    }
    const { id } = req.params;
    const payment = await prisma.salaryPayment.findUnique({ where: { id: parseInt(id) } });
    if (!payment) return res.status(404).json({ error: 'Not found' });

    // Oylik yozuvi va unga bog'langan xarajat birga ketadi.
    await prisma.$transaction(async (tx) => {
      if (payment.expenseId) {
        await tx.expense.deleteMany({ where: { id: payment.expenseId } });
      }
      await tx.salaryPayment.delete({ where: { id: parseInt(id) } });
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get('/api/kpi-calculation', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId, month } = req.query;
    if (!userId || !month) return res.status(400).json({ error: 'userId and month required' });

    const employee = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, name: true, schoolId: true, kpiPercent: true }
    });
    if (!employee) return res.json({ groups: [], totalPayments: 0, kpiAmount: 0 });
    // Filialsiz xodimni ustoz yozuvi bilan bog'lab bo'lmaydi: bog'lash
    // aynan filial bo'yicha qidiriladi. Bu tekshiruvsiz Prisma
    // `schoolId: null` ni rad etib, 500 qaytarardi.
    if (employee.schoolId == null) return res.json({ groups: [], totalPayments: 0, kpiAmount: 0 });

    const teacher = await ustozniTop(employee);
    if (!teacher) return res.json({ groups: [], totalPayments: 0, kpiAmount: 0 });

    // Ustozning guruhlari. Ilgari bu yerda har guruh uchun o'quvchining
    // BARCHA to'lovlari qo'shilardi — bir nechta guruhda o'qiydigan o'quvchining
    // puli har bir ustozga to'liq yozilib, ikki marta sanalardi. Endi pul
    // guruhga bog'langan yozuvlar (Payment.groupId) bo'yicha olinadi.
    const groups = await prisma.group.findMany({
      where: { teacherId: teacher.id },
      include: { course: { select: { name: true } }, students: { select: { id: true } } }
    });
    const groupIds = groups.map(g => g.id);

    // Shu oyda guruhlarga yozilgan hisob: manfiy "Oylik" yozuvlari, ya'ni
    // o'quvchi o'sha guruh uchun qancha to'lashi kerakligi.
    const charged = groupIds.length
      ? await prisma.payment.groupBy({
          by: ['groupId'],
          where: { groupId: { in: groupIds }, type: 'Oylik', date: { startsWith: String(month) } },
          _sum: { amount: true },
        })
      : [];
    const chargedByGroup = new Map(charged.map(r => [r.groupId, -(r._sum.amount || 0)]));

    // Ustoz guruhiga TUSHGAN pul. Foiz aynan shundan olinadi: hisoblangan
    // summadan emas.
    //
    // "Tushgan" — o'quvchining puli shu oyda shu guruhning hisobini YOPGAN
    // qismi (services/ledger.js → lib/allocation.js). Avans oldindan
    // berilgan bo'lsa ham u faqat o'z oyida hisobga kiradi: 2 mln berib
    // 4 oy o'qiydigan o'quvchi uchun ustoz har oy 500 mingdan oladi.
    // Qarz kech to'langan bo'lsa — to'langan oyga yoziladi.
    const studentIds = [...new Set(groups.flatMap(g => g.students.map(s => s.id)))];
    const receivedByGroup = await receivedForGroups(studentIds, String(month));

    // O'tkazilgan darslar — ma'lumot uchun (oylikka qo'shilmaydi).
    const lessonRows = groupIds.length
      ? await prisma.attendance.findMany({
          where: { groupId: { in: groupIds }, date: { startsWith: String(month) } },
          select: { groupId: true, date: true },
          distinct: ['groupId', 'date'],
        })
      : [];
    const lessonsByGroup = new Map();
    lessonRows.forEach(r => lessonsByGroup.set(r.groupId, (lessonsByGroup.get(r.groupId) || 0) + 1));

    let totalPayments = 0;
    let totalCharged = 0;
    let totalLessons = 0;
    const groupBreakdown = groups.map(g => {
      const received = Math.round(receivedByGroup.get(g.id) || 0);
      const groupCharged = chargedByGroup.get(g.id) || 0;
      const lessons = lessonsByGroup.get(g.id) || 0;
      totalPayments += received;
      totalCharged += groupCharged;
      totalLessons += lessons;
      return {
        id: g.id,
        name: g.name,
        course: g.course?.name || '',
        studentCount: g.students.length,
        lessons,
        charged: groupCharged,
        total: received,
        payType: g.payType || null,
        payValue: g.payValue || 0,
      };
    });

    const kpiPercent = employee.kpiPercent || 0;

    // Har bir guruh uchun ustozga qancha to'lanadi. Rahbar aytgan uchta hol:
    //   'Belgilangan' — guruh uchun oyiga belgilangan summa (masalan 2 mln).
    //                   Guruhlar har xil bo'lishi mumkin: biriga 2, boshqasiga 3 mln.
    //   'Foiz'        — aynan shu guruhga tushgan puldan foiz.
    //   belgilanmagan — xodim kartasidagi umumiy KPI foizi.
    // Faqat oklad oladigan ustozda hech biri qo'yilmaydi va KPI foizi 0 bo'ladi,
    // shunda bu yerdan 0 chiqadi — oylik faqat asosiy maoshdan iborat bo'ladi.
    groupBreakdown.forEach(g => {
      if (g.payType === 'Belgilangan') {
        g.pay = Math.round(g.payValue || 0);
        g.payLabel = 'Belgilangan';
      } else if (g.payType === 'Foiz') {
        g.pay = Math.round(g.total * (g.payValue || 0) / 100);
        g.payLabel = (g.payValue || 0) + '%';
      } else {
        g.pay = Math.round(g.total * kpiPercent / 100);
        g.payLabel = kpiPercent + '%';
      }
    });
    const kpiAmount = groupBreakdown.reduce((s, g) => s + g.pay, 0);

    res.json({ groups: groupBreakdown, totalPayments, totalCharged, kpiPercent, kpiAmount, totalLessons });
  } catch (error) { next(error); }
});

// Ustoz va xodim yozuvlarini qo'lda moslashtirish. Odatda kerak emas —
// /api/teachers o'zi tuzatadi — lekin bir chetda qolib ketgan yozuv uchun
// qo'lda ishga tushirish yo'li ochiq tursin.
app.post('/api/admin/sync-teachers', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Only ADMIN can sync' });
    }
    const schoolIds = req.user.role === 'SUPERADMIN'
      ? null
      : [req.user.schoolId].filter(Boolean);

    // 1) Xodim yozuvi yo'q ustozlarga xodim yozuvi.
    const boglanganSoni = await ustozlarniXodimgaBogla(schoolIds);

    // 2) Ustoz yozuvi yo'q o'qituvchi-xodimlarga ustoz yozuvi.
    const users = await prisma.user.findMany({
      where: {
        role: { in: USTOZ_ROLLAR },
        schoolId: schoolIds ? { in: schoolIds } : { not: null },
        teacherProfile: { is: null }
      }
    });
    let createdCount = 0;
    for (const user of users) {
      const mavjud = await prisma.teacher.findFirst({
        where: { name: user.name, schoolId: user.schoolId, userId: null }
      });
      if (mavjud) {
        await prisma.teacher.update({ where: { id: mavjud.id }, data: { userId: user.id } });
      } else {
        await prisma.teacher.create({
          data: {
            name: user.name,
            phone: user.phone || '',
            salary: user.salary || 0,
            sharePercentage: user.kpiPercent || 0,
            lessonFee: 0,
            birthDate: '',
            hiredDate: new Date().toISOString().split('T')[0],
            status: user.status === 'Arxiv' ? 'Arxiv' : 'Faol',
            schoolId: user.schoolId,
            userId: user.id
          }
        });
        createdCount++;
      }
    }

    // 3) Eski ustoz davomatini xodim jurnaliga ko'chiramiz. Davomat endi
    //    faqat StaffAttendance da yuritiladi (profildagi "Ish grafigi"),
    //    TeacherAttendance esa tarix bo'lib qoladi.
    const kochirilgan = await ustozDavomatiniKochir(schoolIds);

    // 4) Ustoz yozuvidagi eski maosh raqamlarini xodim kartasiga moslaymiz.
    //    Ular allaqachon bir-biriga mos kelmay qolgan edi (masalan ulush
    //    xodim kartasida 20%, ustoz yozuvida 0%) va Telegram bot eskisini
    //    ko'rsatardi.
    let maoshTuzatildi = 0;
    const boglanganlar = await prisma.teacher.findMany({
      where: {
        userId: { not: null },
        ...(schoolIds && schoolIds.length ? { schoolId: { in: schoolIds } } : {})
      },
      include: { user: { select: { salary: true, kpiPercent: true } } }
    });
    for (const ustoz of boglanganlar) {
      if (!ustoz.user) continue;
      const data = ustozMaoshi(ustoz.user, ustoz);
      if (Object.keys(data).length === 0) continue;
      await prisma.teacher.update({ where: { id: ustoz.id }, data });
      maoshTuzatildi++;
    }

    res.json({
      success: true, linkedCount: boglanganSoni, createdCount,
      movedAttendance: kochirilgan, salaryFixed: maoshTuzatildi
    });
  } catch (error) { next(error); }
});

/**
 * TeacherAttendance yozuvlarini StaffAttendance ga ko'chiradi.
 *
 * Ustoz davomati ikki jadvalda yuritilardi va hisobot eskisidan o'qirdi.
 * Endi manba bitta; bu yerda eski yozuvlar yo'qolib ketmasligi uchun
 * ko'chiriladi. Takroran chaqirilsa hech narsa o'zgartirmaydi.
 */
async function ustozDavomatiniKochir(schoolIds) {
  const HOLAT = { Keldi: 'Keldi', Kelmapdi: 'Kelmadi', Kelmadi: 'Kelmadi', Sababli: 'Sababli' };
  const rows = await prisma.teacherAttendance.findMany({
    where: schoolIds && schoolIds.length ? { schoolId: { in: schoolIds } } : {},
    include: { teacher: { select: { userId: true } } }
  });
  let kochdi = 0;
  for (const r of rows) {
    const userId = r.teacher?.userId;
    const status = HOLAT[r.status];
    // Bog'lanmagan ustoz yoki "Dars bo'lmadi" kabi xodim jurnalida yo'q holat
    // ko'chirilmaydi — noto'g'ri kun qo'shib qo'ymaslik uchun.
    if (!userId || !status) continue;
    try {
      const bor = await prisma.staffAttendance.findFirst({ where: { userId, date: r.date } });
      if (bor) continue;
      await prisma.staffAttendance.create({
        data: { userId, date: r.date, status, schoolId: r.schoolId }
      });
      kochdi++;
    } catch (e) {
      // Bir vaqtda yozilib qolsa unique cheklovi ushlaydi — o'tkazib yuboramiz.
      if (e.code !== 'P2002') console.error("[Davomatni ko'chirish]", r.id, e.message);
    }
  }
  return kochdi;
}

// --- API Routes ---

// Students
app.get('/api/students', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const students = await prisma.student.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: {
        groups: { select: { id: true } },
        // Qaysi marshrutlarda ekani — profil va formalar uchun.
        routeStops: { select: { routeId: true } },
      }
    });
    res.json(students.map(s => ({
      ...s,
      groups: s.groups.map(g => g.id),
      routeIds: s.routeStops.map(x => x.routeId),
    })));
  } catch (error) { next(error); }
});
app.post('/api/students', authenticate, async (req, res, next) => {
  try {
    const { groups, schoolId, selectedGroupIds, selectedPrivileges, routeIds, ...rest } = req.body;
    const parsedSchoolId = parseInt(schoolId);
    if (!parsedSchoolId || isNaN(parsedSchoolId) || parsedSchoolId <= 0) {
      return res.status(400).json({ error: 'Valid schoolId required' });
    }
    const ALLOWED = ['name','phone','birthDate','address','location','status','joinedDate','needsTransport',
      'balance','photo','comment','rating','gender','fatherName','fatherPhone','motherName','motherPhone',
      'studentSchool','privilegeType','certCategory','certSubject','certType','certScore',
      'customPrices','orgType','region','district','transportId','statusChangedAt','leaveReason',
      'certificates','studyGoal','directionId'];
    const data = {};
    for (const key of ALLOWED) {
      if (rest[key] !== undefined) data[key] = rest[key];
    }
    // A base64 photo never reaches the row: it becomes a Storage URL first.
    await rasmMaydoniniTozala(data, 'photo', 'student');
    if (data.balance !== undefined) data.balance = parseFloat(data.balance) || 0;
    if (data.transportId !== undefined) data.transportId = data.transportId ? parseInt(data.transportId) : null;
    if (data.directionId !== undefined) data.directionId = data.directionId ? parseInt(data.directionId) : null;
    if (data.customPrices !== undefined && typeof data.customPrices !== 'object') delete data.customPrices;
    if (data.certificates !== undefined) {
      if (typeof data.certificates === 'string') {
        try {
          data.certificates = JSON.parse(data.certificates);
        } catch (e) {
          data.certificates = [];
        }
      }
      if (!Array.isArray(data.certificates)) {
        data.certificates = [];
      }
    }
    const student = await prisma.student.create({
      data: { ...data, schoolId: parsedSchoolId }
    });
    // Transport marshruti: forma tanlagan bo'lsa bekat qilib yoziladi.
    if (routeIds !== undefined) {
      await oquvchiMarshrutlari(student.id, routeIds, parsedSchoolId).catch(e => console.error('[Marshrut]', e.message));
    }
    const groupIds = (groups || selectedGroupIds || []).map(id => parseInt(id)).filter(id => !isNaN(id));
    // Guruhga qo'shilishi bilan oyning qolgan darslari uchun hisob yoziladi.
    const warnings = [];
    for (const gid of groupIds) {
      const r = await enrollStudent({ studentId: student.id, groupId: gid, schoolId: parsedSchoolId });
      if (r.warning) warnings.push(r.warning);
    }
    const updatedStudent = await prisma.student.findUnique({
      where: { id: student.id },
      include: { groups: { select: { id: true } } }
    });
    res.json({ ...updatedStudent, groups: updatedStudent.groups.map(g => g.id), warning: warnings.join(' ') || undefined });
  } catch (error) {
    console.error('POST /api/students error:', error.message);
    next(error);
  }
});

app.post('/api/students/import', authenticate, async (req, res, next) => {
  try {
    const { students, schoolId } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!Array.isArray(students)) return res.status(400).json({ error: 'students array required' });

    const sId = parseInt(schoolId);
    const today = new Date().toISOString().split('T')[0];

    const results = [];
    let skippedCount = 0;

    for (const item of students) {
      if (!item.name || !item.phone) {
        skippedCount++;
        continue;
      }

      const name = String(item.name).trim();
      const phone = String(item.phone).trim();

      // Check if already exists in this school
      const existing = await prisma.student.findFirst({
        where: {
          name,
          phone,
          schoolId: sId
        }
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      const data = {
        name,
        phone,
        birthDate: item.birthDate ? String(item.birthDate).trim() : "",
        address: item.address ? String(item.address).trim() : "",
        location: item.location ? String(item.location).trim() : null,
        status: item.status ? String(item.status).trim() : "Faol",
        joinedDate: item.joinedDate ? String(item.joinedDate).trim() : today,
        balance: item.balance ? parseFloat(item.balance) : 0,
        gender: item.gender && ['Erkak','Ayol'].includes(String(item.gender).trim()) ? String(item.gender).trim() : 'Erkak',
        fatherName: item.fatherName ? String(item.fatherName).trim() : null,
        fatherPhone: item.fatherPhone ? String(item.fatherPhone).trim() : null,
        motherName: item.motherName ? String(item.motherName).trim() : null,
        motherPhone: item.motherPhone ? String(item.motherPhone).trim() : null,
        studentSchool: item.studentSchool ? String(item.studentSchool).trim() : null,
        orgType: item.orgType ? String(item.orgType).trim() : null,
        region: item.region ? String(item.region).trim() : null,
        district: item.district ? String(item.district).trim() : null,
        schoolId: sId
      };

      const created = await prisma.student.create({
        data,
        include: { groups: { select: { id: true } } }
      });
      results.push({ ...created, groups: created.groups.map(g => g.id) });
    }

    res.json({ success: true, count: results.length, skippedCount, students: results });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || 'Import qilishda xatolik yuz berdi' });
  }
});

app.put('/api/students/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = parseInt(id);
    
    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Valid student ID talab qilinadi' });
    }

    const { groups, schoolId, routeIds, ...rest } = req.body;
    console.log(`Updating student ${studentId}`);

    // Whitelist only known Student schema fields
    const ALLOWED_STUDENT_FIELDS = [
      'name','phone','birthDate','address','location','status','joinedDate','needsTransport',
      'balance','photo','rating','comment','gender','fatherName','fatherPhone','motherName','motherPhone',
      'studentSchool','privilegeType','certCategory','certSubject','certType','certScore',
      'customPrices','orgType','region','district','transportId','statusChangedAt',
      'leaveReason','certificates','telegramId','fatherTelegramId','motherTelegramId',
      'studyGoal','directionId'
    ];
    const data = {};
    for (const key of ALLOWED_STUDENT_FIELDS) {
      if (rest[key] !== undefined) data[key] = rest[key];
    }
    // A base64 photo never reaches the row: it becomes a Storage URL first.
    await rasmMaydoniniTozala(data, 'photo', 'student');

    // If status is changing, update statusChangedAt
    let activating = false;
    if (data.status) {
      const oldStudent = await prisma.student.findUnique({ where: { id: studentId } });
      if (oldStudent && oldStudent.status !== data.status) {
        data.statusChangedAt = new Date();
        // Sinov → Faol: sinov darslari bepul edi, endi hisob boshlanadi.
        activating = oldStudent.status === 'Sinov' && data.status === 'Faol';
      }
    }

    if (data.transportId !== undefined) {
      data.transportId = data.transportId ? parseInt(data.transportId) : null;
    }
    if (data.directionId !== undefined) {
      data.directionId = data.directionId ? parseInt(data.directionId) : null;
    }
    // Telegram ID lar unique: bo'sh satr NULL emas, shuning uchun ikkinchi
    // o'quvchini bo'sh qiymat bilan saqlashda baza xato berardi. "Ulanmagan" —
    // bu NULL.
    for (const key of ['telegramId', 'fatherTelegramId', 'motherTelegramId']) {
      if (data[key] !== undefined) {
        const trimmed = typeof data[key] === 'string' ? data[key].trim() : data[key];
        data[key] = trimmed ? String(trimmed) : null;
      }
    }
    if (data.balance !== undefined) data.balance = parseFloat(data.balance) || 0;
    if (data.certificates !== undefined) {
      if (typeof data.certificates === 'string') {
        try {
          data.certificates = JSON.parse(data.certificates);
        } catch (e) {
          data.certificates = [];
        }
      }
      if (!Array.isArray(data.certificates)) {
        data.certificates = [];
      }
    }

    await prisma.student.update({
      where: { id: studentId },
      data
    });

    if (routeIds !== undefined) {
      const oquvchi = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
      await oquvchiMarshrutlari(studentId, routeIds, oquvchi.schoolId).catch(e => console.error('[Marshrut]', e.message));
    }

    // Guruhlar ro'yxati o'zgarsa — qo'shilganlarga oyning qolgan darslari
    // uchun hisob, chiqarilganlarga qaytarish. Ilgari shunchaki "set" edi.
    const notes = [];
    let ledgerChanged = false;
    if (groups) {
      const sync = await syncStudentGroups({ studentId, groupIds: groups.map(gId => parseInt(gId)) });
      if (sync.error) notes.push(sync.error);
      if (sync.warning) notes.push(sync.warning);
      if (sync.moved) ledgerChanged = true;
    }

    let activation = null;
    if (activating) {
      activation = await activateStudent({ studentId });
      if (activation.error) { notes.push(activation.error); activation = null; }
      else {
        if (activation.warning) notes.push(activation.warning);
        if (activation.total > 0) ledgerChanged = true;
      }
    }

    const updatedStudent = await prisma.student.findUnique({
      where: { id: studentId },
      include: { groups: { select: { id: true } } }
    });

    res.json({
      ...updatedStudent,
      groups: updatedStudent.groups.map(g => g.id),
      activation: activation || undefined,
      warning: notes.join(' ') || undefined,
      ledgerChanged: ledgerChanged || undefined,
    });
  } catch (error) {
    console.error(`Error updating student ${req.params.id}:`, error);
    next(error);
  }
});
app.delete('/api/students/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const sid = parseInt(req.params.id);
    if (isNaN(sid)) return res.status(400).json({ error: 'Noto\u2019g\u2019ri ID' });

    // O'quvchini o'chirish uning butun tarixini ham o'chiradi \u2014 eng muhimi
    // to'lovlarini, ya'ni Moliyadagi o'tgan oylar tushumi ham kamayadi. Shuning
    // uchun yozuvi bor o'quvchi uchun avval arxiv taklif qilinadi; rahbar
    // baribir o'chirishni tanlasa (force) shundagina hammasi o'chadi.
    const majburiy = String(req.query.force || '') === '1' || req.body?.force === true;
    if (!majburiy) {
      const [tolovSoni, davomatSoni] = await Promise.all([
        prisma.payment.count({ where: { studentId: sid } }),
        prisma.attendance.count({ where: { studentId: sid } }),
      ]);
      if (tolovSoni > 0 || davomatSoni > 0) {
        const qismlar = [];
        if (tolovSoni > 0) qismlar.push(tolovSoni + " ta to'lov");
        if (davomatSoni > 0) qismlar.push(davomatSoni + ' ta davomat');
        return res.status(400).json({
          error: "Bu o'quvchida " + qismlar.join(' va ') + " yozuvi bor. Arxivga olsangiz ro'yxatdan yo'qoladi, to'lov tarixi va Moliyadagi tushum joyida qoladi. Butunlay o'chirsangiz to'lovlari, davomati, baholari va imtihon natijalari ham o'chib ketadi.",
          canArchive: true,
          canForce: true
        });
      }
    }

    // Many-to-many: guruhlardan uzib olamiz
    await prisma.student.update({ where: { id: sid }, data: { groups: { set: [] } } }).catch(() => {});
    // Bog'liq yozuvlarni ketma-ket o'chiramiz
    await prisma.examResult.deleteMany({ where: { studentId: sid } }).catch(() => {});
    await prisma.score.deleteMany({ where: { studentId: sid } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { studentId: sid } }).catch(() => {});
    await prisma.deliveryLog.deleteMany({ where: { studentId: sid } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { studentId: sid } }).catch(() => {});
    // Nihoyat studentni o'chiramiz
    await prisma.student.delete({ where: { id: sid } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    next(error);
  }
});

// Teachers
app.get('/api/teachers', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const sid = parseInt(schoolId);
    let teachers = await prisma.teacher.findMany({ where: { schoolId: sid } });
    // Xodim yozuvi yo'q ustozni bir martada tuzatamiz — usiz unga oylik ham,
    // davomat ham qo'yib bo'lmaydi. Hammasi bog'langandan keyin bu shart
    // hech qachon bajarilmaydi, ya'ni qo'shimcha so'rov ham bo'lmaydi.
    if (teachers.some(t => !t.userId)) {
      if (await ustozlarniXodimgaBogla([sid])) {
        teachers = await prisma.teacher.findMany({ where: { schoolId: sid } });
      }
    }
    res.json(teachers);
  } catch (error) { next(error); }
});
// Only these columns may be written from a request. Pay fields in particular were
// previously reachable by spreading the whole body, so any signed-in member of staff
// could rewrite a teacher's salary or revenue share.
const TEACHER_FIELDS = ['name', 'phone', 'salary', 'sharePercentage', 'lessonFee',
  'salaryType', 'birthDate', 'hiredDate', 'photo', 'status', 'telegramId'];

function pickTeacherFields(body) {
  const data = {};
  for (const key of TEACHER_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  for (const num of ['salary', 'sharePercentage', 'lessonFee']) {
    if (data[num] !== undefined) data[num] = parseFloat(data[num]) || 0;
  }
  return data;
}

app.post('/api/teachers', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const data = pickTeacherFields(req.body);
    await rasmMaydoniniTozala(data, 'photo', 'teacher');
    if (!data.salaryType) data.salaryType = 'FIXED';
    const teacher = await prisma.teacher.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    // Ustozga darhol xodim yozuvi ham ochiladi. Ilgari bu yerdan qo'shilgan
    // ustoz "yarim odam" bo'lib qolardi: HR ro'yxatida boshqacha ko'rinar,
    // profili boshqacha ochilar, oylik berish tugmasi esa umuman yo'q edi.
    try {
      const mavjud = await xodimniTop(teacher);
      if (mavjud) {
        await prisma.teacher.updateMany({
          where: { id: teacher.id, userId: null },
          data: { userId: mavjud.id }
        });
        teacher.userId = mavjud.id;
      } else {
        const xodim = await ustozgaXodimYarat(teacher);
        if (xodim) teacher.userId = xodim.id;
      }
    } catch (e) {
      console.error("[Ustozga xodim yozuvi]", e.message);
    }
    res.json(teacher);
  } catch (error) { next(error); }
});
app.put('/api/teachers/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { id } = req.params;
    const ustozData = pickTeacherFields(req.body);
    await rasmMaydoniniTozala(ustozData, 'photo', 'teacher');
    const teacher = await prisma.teacher.update({
      where: { id: parseInt(id) },
      data: ustozData,
    });
    // Xodim yozuvi ham ergashsin: profil bitta bo'lgani uchun ism yoki telefon
    // ikki xil bo'lib qolsa, o'sha bitta sahifada qarama-qarshi ma'lumot chiqadi.
    try {
      const xodim = await xodimniTop(teacher);
      if (xodim) {
        const xodimData = {};
        if (teacher.name !== xodim.name) xodimData.name = teacher.name;
        if ((teacher.phone || null) !== xodim.phone) xodimData.phone = teacher.phone || null;
        if ((teacher.photo || null) !== xodim.photo) xodimData.photo = teacher.photo || null;
        if (teacher.status === 'Arxiv' && xodim.status !== 'Arxiv') xodimData.status = 'Arxiv';
        if (teacher.status !== 'Arxiv' && xodim.status === 'Arxiv') xodimData.status = 'Faol';
        if (Math.round(teacher.salary || 0) !== (xodim.salary || 0)) {
          xodimData.salary = Math.round(teacher.salary || 0);
        }
        if (Object.keys(xodimData).length) {
          await prisma.user.update({ where: { id: xodim.id }, data: xodimData });
        }
        if (!teacher.userId) {
          await prisma.teacher.update({ where: { id: teacher.id }, data: { userId: xodim.id } });
          teacher.userId = xodim.id;
        }
      }
    } catch (e) {
      console.error('[Xodim yozuvini moslash]', e.message);
    }
    res.json(teacher);
  } catch (error) { next(error); }
});
// Ustozni o'chirish. Ilgari bu shunchaki prisma.teacher.delete edi: guruhi yoki
// davomati bor ustozda Prisma foreign key xatosi qaytarar, u global error
// handler'ga tushib "Serverda xatolik yuz berdi" (500) bo'lib ko'rinardi va
// rahbar nima qilish kerakligini bilmasdi. Endi sabab oldindan aytiladi —
// xuddi /api/users/:id dagidek: arxiv yoki (davomat bo'lsa) butunlay o'chirish.
app.delete('/api/teachers/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const teacherId = parseInt(req.params.id);
    if (!Number.isInteger(teacherId)) return res.status(400).json({ error: "Ustoz raqami noto'g'ri" });

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) return res.status(404).json({ error: 'Ustoz topilmadi' });

    // Filial chegarasi: bir filial admini boshqa filialning ustozini o'chirmasin.
    if (req.user.role !== 'SUPERADMIN' && teacher.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Bu ustoz boshqa filialga tegishli' });
    }

    const [guruhlar, davomatSoni] = await Promise.all([
      prisma.group.findMany({ where: { teacherId }, select: { name: true } }),
      prisma.teacherAttendance.count({ where: { teacherId } })
    ]);

    // Guruhda ustoz majburiy (Group.teacherId nullable emas), shuning uchun
    // guruhi bor ustozni o'chirishning iloji yo'q — guruhlar egasiz qolardi.
    // Bunday holatda faqat arxiv taklif qilinadi va qaysi guruhlar ekani aytiladi.
    if (guruhlar.length > 0) {
      const nomlar = guruhlar.map(g => g.name).join(', ');
      return res.status(400).json({
        error: "Bu ustozga " + guruhlar.length + " ta guruh biriktirilgan: " + nomlar +
               ". Avval o'sha guruhlarga boshqa ustoz tayinlang, keyin o'chirasiz. " +
               "Arxivga olsangiz ro'yxatdan yo'qoladi, guruhlar esa joyida qoladi.",
        canArchive: true,
        canForce: false
      });
    }

    const majburiy = String(req.query.force || '') === '1' || req.body?.force === true;

    if (davomatSoni > 0 && !majburiy) {
      return res.status(400).json({
        error: "Bu ustozda " + davomatSoni + " ta davomat yozuvi bor. Arxivga olsangiz " +
               "ro'yxatdan yo'qoladi, tarix saqlanadi. Butunlay o'chirsangiz davomat ham o'chib ketadi.",
        canArchive: true,
        canForce: true
      });
    }

    // Bitta tranzaksiya: davomat o'chib, ustoz qolib ketmasin.
    await prisma.$transaction(async (tx) => {
      if (davomatSoni > 0) await tx.teacherAttendance.deleteMany({ where: { teacherId } });
      await tx.teacher.delete({ where: { id: teacherId } });
    });
    res.json({ success: true });
  } catch (error) {
    // Yuqorida sanab bo'lmagan bog'lanish qo'shilsa ham 500 emas, tushunarli javob.
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(400).json({
        error: "Bu ustozga bog'langan yozuvlar bor, shuning uchun o'chirib bo'lmaydi. Uni arxivga oling.",
        canArchive: true
      });
    }
    next(error);
  }
});

// Groups
app.get('/api/groups', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const groups = await prisma.group.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: { 
        students: { select: { id: true } },
        course: { select: { name: true } }
      }
    });
    res.json(groups.map(g => ({ 
      ...g, 
      studentIds: g.students.map(s => s.id),
      courseName: g.course?.name
    })));
  } catch (error) { next(error); }
});
app.post('/api/groups', authenticate, async (req, res, next) => {
  console.log('--- [POST /api/groups] Request received ---');
  try {
    let { studentIds, schoolId, courseName, name, teacherId, courseId, schedule, days, room, syllabusId } = req.body;
    console.log('Payload:', { studentIds, schoolId, courseName, name, teacherId, courseId, schedule, days, room, syllabusId });

    const sId = parseInt(schoolId);
    if (!sId) {
      console.log('Error: schoolId missing');
      return res.status(400).json({ error: 'schoolId required' });
    }
    
    // Resolve courseId
    if (!courseId && courseName) {
      // Kurs nomi katta-kichik harf va ortiqcha bo'shliqqa qaramay topilsin.
      // Ilgari aynan mos kelmasa yangi kurs ochilardi: "Matematika" va
      // "matematika " ikkita alohida kurs bo'lib qolar, ro'yxatda takrorlanar
      // va tushum ikkiga bo'linib ketardi.
      const nom = String(courseName).trim();
      let course = await prisma.course.findFirst({
        where: { name: { equals: nom, mode: 'insensitive' }, schoolId: sId }
      });
      if (!course) {
        console.log('Creating new course:', nom);
        course = await prisma.course.create({
          data: { name: nom, price: 0, schoolId: sId }
        });
      }
      courseId = course.id;
    }

    if (!courseId) {
      console.log('Error: courseId missing');
      return res.status(400).json({ error: 'Kurs tanlanishi yoki nomi kiritilishi shart' });
    }

    const prismaData = {
      name: name || 'Nomsiz guruh',
      teacherId: parseInt(teacherId),
      courseId: parseInt(courseId),
      schedule: schedule || '',
      days: days || 'TOQ',
      schoolId: sId
    };

    if (room !== undefined && room !== null && room !== '') {
      prismaData.room = parseInt(room);
    }
    if (syllabusId !== undefined && syllabusId !== null && syllabusId !== '') {
      prismaData.syllabusId = parseInt(syllabusId);
    }

    console.log('Prisma create data:', prismaData);

    const group = await prisma.group.create({ data: prismaData });
    console.log('Success: Group created with ID:', group.id);
    
    let memberWarning = null;
    if (studentIds && studentIds.length > 0) {
      const sync = await syncGroupMembers({ groupId: group.id, studentIds, schoolId: group.schoolId });
      memberWarning = sync.warning || null;
    }

    const updatedGroup = await prisma.group.findUnique({ 
      where: { id: group.id }, 
      include: { 
        students: { select: { id: true } },
        course: { select: { name: true } }
      } 
    });

    console.log('Returning group data');
    res.json({ 
      ...updatedGroup, 
      studentIds: updatedGroup.students.map(s => s.id),
      courseName: updatedGroup.course?.name,
      warning: memberWarning || undefined,
    });
  } catch (error) {
    console.error('CRITICAL ERROR in [POST /api/groups]:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Atomic endpoint: connect a single student to a group (uses 'connect', not 'set')
app.post('/api/groups/:id/students', authenticate, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const enrol = await enrollStudent({ studentId: parseInt(studentId), groupId });
    if (enrol.error) return res.status(400).json({ error: enrol.error });

    const updatedGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        students: { select: { id: true } },
        course: { select: { name: true } }
      }
    });

    res.json({
      ...updatedGroup,
      studentIds: updatedGroup.students.map(s => s.id),
      courseName: updatedGroup.course?.name,
      charge: enrol.charge, lessons: enrol.lessons, warning: enrol.warning || undefined,
      trial: enrol.trial || undefined,
    });
  } catch (error) {
    console.error('Error connecting student to group:', error);
    next(error);
  }
});

// Atomic endpoint: disconnect a single student from a group
app.delete('/api/groups/:id/students/:studentId', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);

    const out = await unenrollStudent({ studentId, groupId });
    if (out.error) return res.status(400).json({ error: out.error });

    const updatedGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        students: { select: { id: true } },
        course: { select: { name: true } }
      }
    });

    res.json({
      ...updatedGroup,
      studentIds: updatedGroup.students.map(s => s.id),
      courseName: updatedGroup.course?.name,
      refund: out.refund, warning: out.warning || undefined,
    });
  } catch (error) {
    console.error('Error disconnecting student from group:', error);
    next(error);
  }
});

app.put('/api/groups/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    let { studentIds, schoolId, name, teacherId, courseId, schedule, days, room, syllabusId,
          payType, payValue } = req.body;
    
    // Prepare data for Prisma - ONLY include fields that are in the schema
    const prismaData = {};
    if (name !== undefined) prismaData.name = name;
    if (teacherId !== undefined) prismaData.teacherId = parseInt(teacherId);
    if (courseId !== undefined) prismaData.courseId = parseInt(courseId);
    if (schedule !== undefined) prismaData.schedule = schedule;
    if (days !== undefined) prismaData.days = days;
    if (syllabusId !== undefined) {
      prismaData.syllabusId = (syllabusId === null || syllabusId === '') ? null : parseInt(syllabusId) || null;
    }

    // Ustozga shu guruh uchun to'lov turi. Bo'sh qiymat "umumiy KPI foizi"ga qaytaradi.
    if (payType !== undefined) {
      prismaData.payType = (payType === 'Belgilangan' || payType === 'Foiz') ? payType : null;
    }
    if (payValue !== undefined) {
      const v = parseFloat(payValue);
      prismaData.payValue = Number.isFinite(v) && v > 0 ? v : 0;
    }

    // "Nothing selected" arrives as 0 or '' from the form. There is no room with id 0, so
    // passing it through produced a foreign key error and a bare 500; an unset room is null.
    if (room !== undefined) {
      prismaData.room = (room === null || room === '') ? null : parseInt(room) || null;
    }

    // A group must have a teacher — say so plainly instead of letting the database
    // reject it with a constraint name the user cannot act on.
    if (prismaData.teacherId !== undefined && (!prismaData.teacherId || isNaN(prismaData.teacherId))) {
      return res.status(400).json({ error: 'Guruh uchun o\'qituvchi tanlanishi shart' });
    }
    if (prismaData.courseId !== undefined && (!prismaData.courseId || isNaN(prismaData.courseId))) {
      return res.status(400).json({ error: 'Guruh uchun kurs tanlanishi shart' });
    }

    const group = await prisma.group.update({
      where: { id: parseInt(id) },
      data: prismaData
    });

    // A'zolar ro'yxati o'zgarsa: yangi kelganlarga oyning qolgan darslari
    // uchun hisob, chiqarilganlarga o'tilmagan darslar puli qaytadi.
    let memberWarning = null;
    if (studentIds) {
      const sync = await syncGroupMembers({ groupId: group.id, studentIds, schoolId: group.schoolId });
      memberWarning = sync.warning || null;
    }

    const updatedGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: { 
        students: { select: { id: true } },
        course: { select: { name: true } }
      }
    });

    res.json({
      ...updatedGroup,
      studentIds: updatedGroup.students.map(s => s.id),
      courseName: updatedGroup.course?.name,
      warning: memberWarning || undefined,
    });
  } catch (error) {
    console.error('Error updating group:', error);
    next(error);
  }
});

app.delete('/api/groups/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) return res.status(400).json({ error: "Noto'g'ri ID" });

    await prisma.$transaction([
      prisma.examAssignment.deleteMany({ where: { groupId } }),
      prisma.attendance.deleteMany({ where: { groupId } }),
      prisma.score.deleteMany({ where: { groupId } }),
      prisma.group.update({ where: { id: groupId }, data: { students: { set: [] } } }),
      prisma.group.delete({ where: { id: groupId } }),
    ]);

    res.json({ success: true });
  } catch (error) { next(error); }
});

// Leads
app.get('/api/leads', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const leads = await prisma.lead.findMany({ where: { schoolId: parseInt(schoolId) } });
    res.json(leads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (error) { next(error); }
});
app.post('/api/leads', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    await rasmMaydoniniTozala(data, 'photo', 'lead');
    const lead = await prisma.lead.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    
    // Telegram Notification
    notifyAdmins(`🆕 Yangi lid: ${lead.name}\n📞 ${lead.phone}\n📚 Kurs: ${lead.course}`, parseInt(schoolId));

    res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
  } catch (error) { next(error); }
});
// Public endpoint for landing page form submissions (no auth required)
app.post('/api/public/leads', publicFormLimiter, async (req, res, next) => {
  try {
    const { name, phone, course } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Ism va telefon majburiy' });
    const schoolId = 1; // default school
    const lead = await prisma.lead.create({
      data: { name, phone, course: course || 'Aniqlanmagan', source: 'Landing Page', status: 'Yangi', schoolId }
    });
    notifyAdmins(`🌐 Landing Page dan yangi ariza:\n👤 ${lead.name}\n📞 ${lead.phone}\n📚 Kurs: ${lead.course}`, schoolId);
    res.json({ success: true, id: lead.id });
  } catch (error) { next(error); }
});

// GET school info for public apply form
app.get('/api/public/schools/:schoolId/info', async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Mavjud bo\'lmagan filial ID' });

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: { settings: true }
    });

    if (!school) return res.status(404).json({ error: 'Filial topilmadi' });

    const setting = school.settings[0] || {};
    res.json({
      id: school.id,
      name: school.name,
      orgName: setting.orgName || school.name,
      logo: setting.logo || null
    });
  } catch (error) { next(error); }
});

// GET school courses for public apply form
app.get('/api/public/schools/:schoolId/courses', async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Mavjud bo\'lmagan filial ID' });

    // Faqat hozir guruhi bor kurslar. Ilgari markazda bir marta yaratilgan,
    // lekin allaqachon yopilgan eski kurslar ham ariza formasida turardi va
    // ariza beruvchi mavjud bo'lmagan kursni tanlay olardi.
    const courses = await prisma.course.findMany({
      where: { schoolId, groups: { some: {} } },
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' }
    });
    res.json(courses);
  } catch (error) { next(error); }
});

// GET current groups for the public apply form.
// The form only offered a course name, so an applicant could not see which groups are
// actually running or pick one that fits their schedule. Only non-sensitive fields are
// exposed: no student names, no phone numbers.
app.get('/api/public/schools/:schoolId/groups', async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: "Mavjud bo'lmagan filial ID" });

    const groups = await prisma.group.findMany({
      where: { schoolId },
      select: {
        id: true, name: true, schedule: true, days: true, courseId: true,
        course: { select: { name: true, price: true } },
        teacher: { select: { name: true } },
        roomRel: { select: { capacity: true } },
        _count: { select: { students: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json(groups.map(g => ({
      id: g.id,
      name: g.name,
      schedule: g.schedule,
      days: g.days,
      courseId: g.courseId,
      courseName: g.course?.name || '',
      price: g.course?.price ?? null,
      teacherName: g.teacher?.name || '',
      studentCount: g._count.students,
      capacity: g.roomRel?.capacity ?? null
    })));
  } catch (error) { next(error); }
});

// Ariza formasidagi yo'nalish va transport ro'yxatlari. Ikkalasi ham CRM dagi
// "o'quvchi qo'shish" oynasidagi bilan bir xil bo'lishi kerak — shuning uchun
// ochiq forma ham xuddi shu jadvallardan o'qiydi. Faqat nom chiqadi.
app.get('/api/public/schools/:schoolId/directions', async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: "Mavjud bo'lmagan filial ID" });
    const rows = await prisma.direction.findMany({
      where: { schoolId },
      select: { id: true, name: true, subjects: true },
      orderBy: { name: 'asc' }
    });
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/public/schools/:schoolId/transports', async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: "Mavjud bo'lmagan filial ID" });
    const rows = await prisma.transport.findMany({
      where: { schoolId, status: 'Faol' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    res.json(rows);
  } catch (error) { next(error); }
});

// Eskirgan: ariza havolasi endi doimiy, tokensiz. Bu yo'l faqat ilgari
// tarqatilgan QR kodlar uchun qoldi — token bo'lmasa ham forma ochiladi va
// ariza qabul qilinadi. Himoya serverda: so'rov cheklovi (soatiga 20 ta) va
// bir xil ism-telefon uchun takroriylik tekshiruvi.
const APPLY_TOKEN_TTL_MS = 30 * 60 * 1000;

// POST create single-use registration token (Authenticated)
app.post('/api/public/schools/:schoolId/tokens', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Mavjud bo\'lmagan filial ID' });

    // "To'liq o'quv markazi" tanlanganda klient bu yerga 0 yuborardi: Prisma
    // foreign key xatosi 500 bo'lib qaytar, havola oynasi esa abadiy
    // "Yuklanmoqda" bo'lib turardi. Ariza havolasi doim bitta filialga tegishli.
    if (schoolId <= 0) {
      return res.status(400).json({ error: "Havola uchun filialni tanlang" });
    }
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) return res.status(404).json({ error: 'Filial topilmadi' });

    const token = await prisma.applyToken.create({
      data: { schoolId }
    });
    res.json({ token: token.id, expiresAt: new Date(token.createdAt.getTime() + APPLY_TOKEN_TTL_MS) });
  } catch (error) { next(error); }
});

// GET check if a registration token is valid
app.get('/api/public/tokens/:tokenId', async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const token = await prisma.applyToken.findUnique({
      where: { id: tokenId }
    });

    if (!token || token.used || Date.now() - token.createdAt.getTime() > APPLY_TOKEN_TTL_MS) {
      return res.json({ valid: false });
    }

    res.json({ valid: true, schoolId: token.schoolId });
  } catch (error) { next(error); }
});

// POST register lead via public apply form using unique token (directly to students module)
app.post('/api/public/schools/:schoolId/leads', publicFormLimiter, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Mavjud bo\'lmagan filial ID' });

    const {
      name, phone, course, source, token, groupId,
      birthDate, address, gender, studentSchool,
      fatherName, fatherPhone, motherName, motherPhone,
      preferredTime, notes, photo, certificates,
      // CRM dagi "o'quvchi qo'shish" oynasidagi bilan bir xil maydonlar —
      // ariza orqali kelgan o'quvchi ham to'liq yozilsin.
      orgType, region, district, studyGoal, directionId, transportId, privileges, location
    } = req.body;

    if (!name || !phone) return res.status(400).json({ error: 'Ism va telefon raqami majburiy' });

    // Token is optional — if provided, validate it (legacy single-use support)
    if (token) {
      const applyToken = await prisma.applyToken.findUnique({ where: { id: token } });
      const isExpired = applyToken && Date.now() - applyToken.createdAt.getTime() > APPLY_TOKEN_TTL_MS;
      if (!applyToken || applyToken.used || isExpired || applyToken.schoolId !== schoolId) {
        return res.status(400).json({ error: 'Ushbu ro\'yxatdan o\'tish havolasi eskirgan, noto\'g\'ri yoki allaqachon ishlatilgan.' });
      }
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    // Check duplicate student
    const duplicateStudent = await prisma.student.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
        phone: cleanPhone,
        schoolId
      }
    });

    if (duplicateStudent) {
      return res.status(400).json({ error: 'Siz kiritgan ma\'lumotlar bilan o\'quvchi allaqachon ro\'yxatdan o\'tgan.' });
    }

    const certList = Array.isArray(certificates) ? certificates : [];

    // Imtiyozlar formadagi belgilangan tugmalardan keladi. "Sertifikat" esa
    // sertifikat qo'shilgan bo'lsa o'zi qo'shiladi.
    const PRIVILEGES = ['Nogironligi bor', 'Harbiy oila', "Xotin-qizlar daftari", 'Sertifikat'];
    const privList = (Array.isArray(privileges) ? privileges : []).filter(p => PRIVILEGES.includes(p));
    if (certList.length > 0 && !privList.includes('Sertifikat')) privList.push('Sertifikat');

    const GOALS = ['Asosiy fan', 'Majburiy fan', 'Mustaqil'];

    // Yo'nalish va transport — faqat shu filialnikilari qabul qilinadi.
    let wantedDirectionId = parseInt(directionId);
    if (Number.isInteger(wantedDirectionId) && wantedDirectionId > 0) {
      const dir = await prisma.direction.findFirst({ where: { id: wantedDirectionId, schoolId }, select: { id: true } });
      if (!dir) wantedDirectionId = null;
    } else {
      wantedDirectionId = null;
    }
    let wantedTransportId = parseInt(transportId);
    if (Number.isInteger(wantedTransportId) && wantedTransportId > 0) {
      const tr = await prisma.transport.findFirst({ where: { id: wantedTransportId, schoolId }, select: { id: true } });
      if (!tr) wantedTransportId = null;
    } else {
      wantedTransportId = null;
    }

    const student = await prisma.student.create({
      data: {
        name: cleanName,
        phone: cleanPhone,
        birthDate: birthDate || "",
        address: address || "",
        status: "Sinov",
        joinedDate: new Date().toISOString().split('T')[0],
        balance: 0,
        photo: photo || null,
        gender: ['Erkak','Ayol'].includes(gender) ? gender : 'Erkak',
        fatherName: fatherName || null,
        fatherPhone: fatherPhone || null,
        motherName: motherName || null,
        motherPhone: motherPhone || null,
        studentSchool: studentSchool || null,
        // Xaritadan belgilangan joy: "38.4833,67.9333". Boshqa shakldagi
        // matnni saqlamaymiz.
        location: (typeof location === 'string' && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(location.trim()))
          ? location.trim() : null,
        orgType: orgType || null,
        region: region || null,
        district: district || null,
        studyGoal: GOALS.includes(studyGoal) ? studyGoal : null,
        directionId: wantedDirectionId,
        transportId: wantedTransportId,
        privilegeType: privList.length > 0 ? privList.join(',') : 'None',
        certificates: certList,
        comment: `[Onlayn Ariza] Kurs: ${course || 'Aniqlanmagan'}.${notes ? ` Izoh: ${notes}` : ''}`,
        schoolId
      }
    });

    notifyAdmins(`🆕 Onlayn formadan yangi o'quvchi:\n👤 ${student.name}\n📞 ${student.phone}\n📚 Kurs: ${course || 'Aniqlanmagan'}`, schoolId);
    // Tanlangan guruh — faqat shu filialniki bo'lsa biriktiriladi.
    const wantedGroupId = parseInt(groupId);
    if (!isNaN(wantedGroupId)) {
      const joinedGroup = await prisma.group.findFirst({ where: { id: wantedGroupId, schoolId } });
      if (joinedGroup) {
        await enrollStudent({ studentId: student.id, groupId: joinedGroup.id, schoolId });
        notifyAdmins("👥 Guruh: " + joinedGroup.name + " (" + student.name + ")", schoolId);
      }
    }

    res.json({ success: true, id: student.id });
  } catch (error) { next(error); }
});

app.put('/api/leads/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    await rasmMaydoniniTozala(data, 'photo', 'lead');
    const lead = await prisma.lead.update({ where: { id: parseInt(id) }, data });
    res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
  } catch (error) { next(error); }
});

app.delete('/api/leads/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.lead.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Payments
app.get('/api/payments', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const payments = await prisma.payment.findMany({ where: { schoolId: parseInt(schoolId) } });
    res.json(payments);
  } catch (error) { next(error); }
});
// To'lov turlari. "Chegirma" — pul kirmagan, lekin o'quvchining hisobiga
// yozilgan qayta hisob (masalan kasal bo'lib dars qoldirgan). U balansni
// oshiradi, lekin kassa tushumi sifatida hisoblanmaydi.
const PAYMENT_TYPES = ['Naqd', 'Karta', "O'tkazma", 'Peyme', 'Klik', 'Chegirma', 'Oylik', 'Qaytarish'];

app.post('/api/payments', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    // Ilgari hech qanday tekshiruv yo'q edi: bo'sh yoki matnli summa Prisma
    // xatosiga aylanib, 500 bo'lib chiqardi.
    const parsedAmount = parseFloat(data.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({ error: "Summa noto'g'ri" });
    }
    data.amount = parsedAmount;
    if (data.type === 'Plastik') data.type = 'Karta';
    if (data.type && !PAYMENT_TYPES.includes(data.type)) {
      return res.status(400).json({ error: "To'lov turi noto'g'ri" });
    }
    if (data.studentId) data.studentId = parseInt(data.studentId);

    // To'lovni guruhga bog'lab qo'yamiz — ustozning ulushi aynan guruhga
    // tushgan pul bo'yicha hisoblanadi. Aniq bo'lmasa (o'quvchi bir nechta
    // guruhda va kurs tanlanmagan) bo'sh qoldiramiz: KPI hisobida bunday
    // to'lov hisoblangan summaga proporsional taqsimlanadi.
    if (data.groupId === undefined && data.studentId) {
      try {
        const st = await prisma.student.findUnique({
          where: { id: data.studentId },
          select: { groups: { select: { id: true, courseId: true } } },
        });
        const sGroups = st?.groups || [];
        const candidates = data.courseId
          ? sGroups.filter(g => g.courseId === data.courseId)
          : sGroups;
        if (candidates.length === 1) data.groupId = candidates[0].id;
      } catch (e) {
        console.error('Guruhni aniqlashda xato:', e.message);
      }
    }
    if (data.groupId !== undefined) {
      const gid = parseInt(data.groupId);
      data.groupId = Number.isInteger(gid) && gid > 0 ? gid : null;
    }
    // Kurs ixtiyoriy: tanlanmasa null, noto'g'ri qiymat ham null bo'ladi
    // (0 yoki bo'sh satr foreign key xatosini keltirib chiqarardi).
    if (data.courseId !== undefined) {
      const parsedCourseId = parseInt(data.courseId);
      data.courseId = Number.isInteger(parsedCourseId) && parsedCourseId > 0 ? parsedCourseId : null;
    }
    const payment = await prisma.payment.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    await prisma.student.update({
      where: { id: payment.studentId },
      data: { balance: { increment: payment.amount } }
    });
    res.json(payment);
  } catch (error) { next(error); }
});

// O'quvchining hisobi: qaysi oy uchun qancha hisoblangan, qanchasi yopilgan,
// hamyonida qancha avans turibdi. Balans raqamining ochib berilgani.
app.get('/api/students/:id/ledger', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const student = await prisma.student.findUnique({ where: { id }, select: { id: true, schoolId: true, balance: true, name: true } });
    if (!student) return res.status(404).json({ error: "O'quvchi topilmadi" });
    if (!(await canAccessSchool(req.user, student.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    const ledger = await studentLedger(id);
    res.json({ studentId: id, balance: student.balance, ...ledger });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Face ID — yuz belgilari.
//
// Belgi 128 ta sondan iborat. Ilgari u Student.customPrices ichida saqlanardi
// va /api/init bilan har bir o'quvchi uchun yuborilardi: 235 ta o'quvchi
// ro'yxatdan o'tsa javob yarim megabaytga og'irlashardi. Endi alohida
// jadvalda va faqat kerak bo'lganda — yo'qlama oynasi ochilganda, o'sha
// guruh uchun — yuklanadi.
// ---------------------------------------------------------------------------

/** Belgi haqiqiy 128 sonli vektormi. */
function validDescriptor(d) {
  return Array.isArray(d) && d.length === 128 && d.every(n => typeof n === 'number' && Number.isFinite(n));
}

app.get('/api/face-profiles', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(400).json({ error: 'schoolId kerak' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });

    const groupId = parseInt(req.query.groupId);
    const studentId = parseInt(req.query.studentId);
    const where = { schoolId };
    if (Number.isInteger(studentId) && studentId > 0) {
      where.studentId = studentId;
    } else if (Number.isInteger(groupId) && groupId > 0) {
      where.student = { groups: { some: { id: groupId } } };
    }

    // ids=1 — faqat kim ro'yxatdan o'tganini bilish uchun (yengil javob).
    if (String(req.query.ids || '') === '1') {
      const rows = await prisma.faceProfile.findMany({ where, select: { studentId: true, source: true, updatedAt: true } });
      return res.json({ profiles: rows });
    }

    const rows = await prisma.faceProfile.findMany({ where, select: { studentId: true, descriptor: true, source: true } });
    res.json({ profiles: rows });
  } catch (error) { next(error); }
});

app.post('/api/face-profiles', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(400).json({ error: 'schoolId kerak' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });

    const list = Array.isArray(req.body.profiles) ? req.body.profiles : [];
    if (!list.length) return res.status(400).json({ error: "Bo'sh ro'yxat" });
    if (list.length > 50) return res.status(400).json({ error: "Bir so'rovda 50 tadan ko'p emas" });

    const clean = [];
    for (const item of list) {
      const studentId = parseInt(item.studentId);
      if (!Number.isInteger(studentId)) continue;
      if (!validDescriptor(item.descriptor)) continue;
      clean.push({ studentId, descriptor: item.descriptor, source: item.source === 'rasm' ? 'rasm' : 'kamera' });
    }
    if (!clean.length) return res.status(400).json({ error: "Yuz belgisi noto'g'ri" });

    // Faqat shu filialdagi o'quvchilar.
    const allowed = await prisma.student.findMany({
      where: { id: { in: clean.map(c => c.studentId) }, schoolId },
      select: { id: true },
    });
    const allowedIds = new Set(allowed.map(a => a.id));
    const rows = clean.filter(c => allowedIds.has(c.studentId));
    if (!rows.length) return res.status(400).json({ error: "O'quvchilar bu filialda topilmadi" });

    await prisma.$transaction(rows.map(r => prisma.faceProfile.upsert({
      where: { studentId: r.studentId },
      create: { studentId: r.studentId, descriptor: r.descriptor, source: r.source, schoolId },
      update: { descriptor: r.descriptor, source: r.source, schoolId },
    })));

    res.json({ saved: rows.length });
  } catch (error) { next(error); }
});

app.delete('/api/face-profiles/:studentId', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
    if (!student) return res.status(404).json({ error: "O'quvchi topilmadi" });
    if (!(await canAccessSchool(req.user, student.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    await prisma.faceProfile.deleteMany({ where: { studentId } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Expenses
const EXPENSE_METHODS = ['Naqd', 'Karta', "O'tkazma"];
app.get('/api/expenses', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const expenses = await prisma.expense.findMany({ where: { schoolId: parseInt(schoolId) } });
    res.json(expenses);
  } catch (error) { next(error); }
});

app.post('/api/expenses', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, amount, category, date, description, method } = req.body;
    const parsedSchoolId = parseInt(schoolId);
    if (!parsedSchoolId || isNaN(parsedSchoolId) || parsedSchoolId <= 0) {
      return res.status(400).json({ error: 'Valid schoolId required' });
    }
    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount) || 0,
        category: category || 'Boshqa',
        date: date || new Date().toISOString().split('T')[0],
        description: description || null,
        // Naqd — kassadan chiqadi, qolganlari bankdan.
        method: EXPENSE_METHODS.includes(method) ? method : 'Naqd',
        schoolId: parsedSchoolId
      }
    });
    res.json(expense);
  } catch (error) { next(error); }
});

app.delete('/api/expenses/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Kassa — naqd pul.
//
// Tizim ilgari "to'lov bo'ldi"ni bilardi, lekin "hozir seyfda qancha naqd
// turishi kerak" degan savolga javob bera olmasdi. Kassadagi naqd =
// naqd kirim − naqd chiqim (Expense.method = Naqd) − inkassatsiya.
// Kunni yopishda administrator pulni sanaydi, tizim kutilgan summani
// beradi, farq yozib qo'yiladi.
// ---------------------------------------------------------------------------

/** So'ralgan filial(lar): 0 — foydalanuvchining barcha filiallari. */
async function kassaSchools(req) {
  const wanted = parseInt(req.query.schoolId ?? req.body?.schoolId);
  if (!Number.isInteger(wanted)) return null;
  if (wanted === ALL_BRANCHES) return allowedSchoolIds(req.user);
  return [wanted];
}

/** Kun bo'yicha naqd kirim / chiqim / inkassatsiya. */
async function kassaByDay(schoolIds, from, to) {
  const dateFilter = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const [pay, exp, hand] = await Promise.all([
    prisma.payment.groupBy({
      by: ['date'],
      where: { schoolId: { in: schoolIds }, type: 'Naqd', amount: { gt: 0 }, date: dateFilter },
      _sum: { amount: true }, _count: true,
    }),
    prisma.expense.groupBy({
      by: ['date'],
      where: { schoolId: { in: schoolIds }, method: 'Naqd', date: dateFilter },
      _sum: { amount: true }, _count: true,
    }),
    prisma.cashHandover.groupBy({
      by: ['date'],
      where: { schoolId: { in: schoolIds }, date: dateFilter },
      _sum: { amount: true }, _count: true,
    }),
  ]);
  const days = new Map();
  const day = (d) => { if (!days.has(d)) days.set(d, { date: d, in: 0, inCount: 0, out: 0, outCount: 0, handover: 0 }); return days.get(d); };
  pay.forEach(r => { const d = day(r.date); d.in += r._sum.amount || 0; d.inCount += r._count; });
  exp.forEach(r => { const d = day(r.date); d.out += r._sum.amount || 0; d.outCount += r._count; });
  hand.forEach(r => { const d = day(r.date); d.handover += r._sum.amount || 0; });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Berilgan kun oxirida kassada bo'lishi kerak bo'lgan naqd. */
async function cashOnHandAt(schoolIds, date) {
  const rows = await kassaByDay(schoolIds, null, date);
  return Math.round(rows.reduce((s, d) => s + d.in - d.out - d.handover, 0));
}

app.get('/api/kassa', authenticate, async (req, res, next) => {
  try {
    const schoolIds = await kassaSchools(req);
    if (!schoolIds) return res.status(400).json({ error: 'schoolId kerak' });
    const daysBack = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const from = new Date(Date.now() + 5 * 3600 * 1000 - daysBack * 86400000).toISOString().slice(0, 10);

    const [all, closes, handovers, nonCashToday] = await Promise.all([
      kassaByDay(schoolIds, null, null),
      prisma.cashDayClose.findMany({ where: { schoolId: { in: schoolIds }, date: { gte: from } }, orderBy: { date: 'desc' } }),
      prisma.cashHandover.findMany({ where: { schoolId: { in: schoolIds }, date: { gte: from } }, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
      prisma.payment.groupBy({
        by: ['type'],
        where: { schoolId: { in: schoolIds }, date: today, amount: { gt: 0 }, type: { in: ['Karta', "O'tkazma", 'Peyme', 'Klik'] } },
        _sum: { amount: true },
      }),
    ]);

    // Kun oxiridagi qoldiq — boshidan yig'ib boriladi.
    let running = 0;
    const withRunning = all.map(d => { running += d.in - d.out - d.handover; return { ...d, endBalance: Math.round(running) }; });
    const cashOnHand = Math.round(running);
    const closeByDate = new Map(closes.map(c => [c.date, c]));
    const recent = withRunning.filter(d => d.date >= from).reverse().map(d => {
      const c = closeByDate.get(d.date);
      return {
        ...d,
        in: Math.round(d.in), out: Math.round(d.out), handover: Math.round(d.handover),
        close: c ? { id: c.id, expected: c.expected, counted: c.counted, diff: Math.round(c.counted - c.expected), note: c.note } : null,
      };
    });
    const todayRow = withRunning.find(d => d.date === today) || { in: 0, inCount: 0, out: 0, outCount: 0, handover: 0 };
    const nonCash = nonCashToday.reduce((s, r) => s + (r._sum.amount || 0), 0);

    res.json({
      today,
      cashOnHand,
      todayIn: Math.round(todayRow.in), todayInCount: todayRow.inCount,
      todayOut: Math.round(todayRow.out), todayOutCount: todayRow.outCount,
      todayHandover: Math.round(todayRow.handover),
      todayNonCash: Math.round(nonCash),
      todayClosed: closeByDate.has(today),
      days: recent,
      handovers,
      closes,
    });
  } catch (error) { next(error); }
});

app.post('/api/kassa/handover', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, amount, date, toWhom, note } = req.body;
    const sid = parseInt(schoolId);
    if (!Number.isInteger(sid) || sid <= 0) return res.status(400).json({ error: 'Filialni tanlang' });
    if (!(await canAccessSchool(req.user, sid))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    const sum = Math.round(parseFloat(amount));
    if (!Number.isFinite(sum) || sum <= 0) return res.status(400).json({ error: "Summa noto'g'ri" });
    const day = date || new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const have = await cashOnHandAt([sid], day);
    if (sum > have) return res.status(400).json({ error: `Kassada bu kunga ${have.toLocaleString('ru-RU')} so'm bor, ${sum.toLocaleString('ru-RU')} topshirib bo'lmaydi` });
    const row = await prisma.cashHandover.create({
      data: { schoolId: sid, amount: sum, date: day, toWhom: String(toWhom || 'Rahbar').trim(), note: note || null, createdById: req.user.id },
    });
    res.json(row);
  } catch (error) { next(error); }
});

app.delete('/api/kassa/handover/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const row = await prisma.cashHandover.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!row) return res.status(404).json({ error: 'Topilmadi' });
    if (!(await canAccessSchool(req.user, row.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    await prisma.cashHandover.delete({ where: { id: row.id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.post('/api/kassa/close', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, date, counted, note } = req.body;
    const sid = parseInt(schoolId);
    if (!Number.isInteger(sid) || sid <= 0) return res.status(400).json({ error: 'Filialni tanlang' });
    if (!(await canAccessSchool(req.user, sid))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    const day = date || new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const sum = Math.round(parseFloat(counted));
    if (!Number.isFinite(sum) || sum < 0) return res.status(400).json({ error: 'Sanalgan summani kiriting' });
    const expected = await cashOnHandAt([sid], day);
    const row = await prisma.cashDayClose.upsert({
      where: { schoolId_date: { schoolId: sid, date: day } },
      create: { schoolId: sid, date: day, expected, counted: sum, note: note || null, closedById: req.user.id },
      update: { expected, counted: sum, note: note || null, closedById: req.user.id },
    });
    res.json({ ...row, diff: Math.round(sum - expected) });
  } catch (error) { next(error); }
});

// Transports
// NOTE: /api/transports lived here twice. This earlier copy shadowed the fuller one
// further down (it omitted the driver relation and deleted a transport without first
// detaching its students and delivery logs, so DELETE failed on a foreign key).
// The later definition is now the only one — see the transport block below.

// ===================== YO'NALISHLAR (DIRECTIONS) =====================
//
// "Iqtisodiyot (Matematika + Ingliz tili)" kabi kirish yo'nalishlari. Har bir
// markazda o'z ro'yxati bo'lgani uchun qattiq yozib qo'yilmaydi — admin
// sozlamalardan o'zi qo'shadi.
app.get('/api/directions', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    res.json(await prisma.direction.findMany({ where: { schoolId }, orderBy: { name: 'asc' } }));
  } catch (error) { next(error); }
});

app.post('/api/directions', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: "Yo'nalish nomi kerak" });
    const subjects = req.body.subjects ? String(req.body.subjects).trim() : null;
    res.json(await prisma.direction.create({ data: { name, subjects, schoolId } }));
  } catch (error) { next(error); }
});

app.put('/api/directions/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const found = await prisma.direction.findUnique({ where: { id }, select: { schoolId: true } });
    if (!found) return res.status(404).json({ error: "Yo'nalish topilmadi" });
    if (!(await canAccessSchool(req.user, found.schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Yo'nalish nomi kerak" });
      data.name = name;
    }
    if (req.body.subjects !== undefined) data.subjects = req.body.subjects ? String(req.body.subjects).trim() : null;
    res.json(await prisma.direction.update({ where: { id }, data }));
  } catch (error) { next(error); }
});

// O'chirilgan yo'nalish o'quvchilarni olib ketmaydi: ularning directionId si
// NULL bo'ladi (schema: onDelete SetNull), ya'ni "yo'nalish tanlanmagan".
app.delete('/api/directions/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const found = await prisma.direction.findUnique({ where: { id }, select: { schoolId: true } });
    if (!found) return res.status(404).json({ error: "Yo'nalish topilmadi" });
    if (!(await canAccessSchool(req.user, found.schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    await prisma.student.updateMany({ where: { directionId: id }, data: { directionId: null } });
    await prisma.direction.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Specific Types API
// Specific Types API
app.get('/api/courses', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    res.json(await prisma.course.findMany({ where: { schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});
app.post('/api/courses', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.price) data.price = parseFloat(data.price);
    if (data.syllabusId !== undefined) {
      data.syllabusId = data.syllabusId ? parseInt(data.syllabusId) : null;
    }
    res.json(await prisma.course.create({ data: { ...data, schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});
app.put('/api/courses/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.price !== undefined) data.price = parseFloat(req.body.price);
    if (req.body.syllabusId !== undefined) {
      data.syllabusId = req.body.syllabusId ? parseInt(req.body.syllabusId) : null;
    }
    res.json(await prisma.course.update({ where: { id: parseInt(req.params.id) }, data }));
  } catch (error) { next(error); }
});
app.delete('/api/courses/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const cId = parseInt(req.params.id);
    if (isNaN(cId)) return res.status(400).json({ error: "Noto'g'ri ID" });

    // Ilgari bu yerda guruhlar ixtiyoriy boshqa kursga ko'chirilardi:
    // findFirst filial bo'yicha ham filtrlanmagani uchun guruh butunlay
    // boshqa markazning kursiga o'tib ketishi mumkin edi. Endi guruhi bor
    // kursni o'chirib bo'lmaydi — avval guruhlarni ko'chirish kerak.
    const groupCount = await prisma.group.count({ where: { courseId: cId } });
    if (groupCount > 0) {
      return res.status(400).json({
        error: "Bu kursda " + groupCount + " ta guruh bor. Avval guruhlarni boshqa kursga o'tkazing yoki o'chiring."
      });
    }

    // To'lovlar kursga bog'langan bo'lsa, yozuv o'chmasin — faqat bog'lanish uziladi.
    await prisma.payment.updateMany({ where: { courseId: cId }, data: { courseId: null } });
    await prisma.course.delete({ where: { id: cId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete course error:', error);
    next(error);
  }
});

// --- Topics (Syllabus) ---
app.get('/api/topics', authenticate, async (req, res, next) => {
  try {
    const { schoolId, syllabusId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const where = { schoolId: parseInt(schoolId) };
    if (syllabusId) where.syllabusId = parseInt(syllabusId);
    const topics = await prisma.topic.findMany({ where, orderBy: { order: 'asc' } });
    res.json(topics);
  } catch (error) { next(error); }
});

app.post('/api/topics', authenticate, async (req, res, next) => {
  try {
    const { schoolId, title, description, order, syllabusId,
            moduleName, hours, materials, status } = req.body;
    if (!schoolId || !title) return res.status(400).json({ error: 'Missing required fields' });
    const topic = await prisma.topic.create({
      data: {
        title,
        description: description || null,
        order: order ? parseInt(order) : 1,
        moduleName: moduleName || null,
        hours: hours ? parseInt(hours) : null,
        materials: materials || null,
        status: status || null,
        syllabusId: syllabusId ? parseInt(syllabusId) : null,
        schoolId: parseInt(schoolId)
      }
    });
    res.json(topic);
  } catch (error) { next(error); }
});

app.put('/api/topics/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, order, syllabusId,
            moduleName, hours, materials, status } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (order !== undefined) data.order = parseInt(order);
    if (syllabusId !== undefined) data.syllabusId = syllabusId ? parseInt(syllabusId) : null;
    if (moduleName !== undefined) data.moduleName = moduleName || null;
    if (hours !== undefined) data.hours = hours === null || hours === '' ? null : parseInt(hours);
    if (materials !== undefined) data.materials = materials || null;
    if (status !== undefined) data.status = status || null;

    const topic = await prisma.topic.update({
      where: { id: parseInt(id) },
      data
    });
    res.json(topic);
  } catch (error) { next(error); }
});

app.delete('/api/topics/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.topic.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Syllabuses (O'quv programmasi) ---
app.get('/api/syllabuses', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const syllabuses = await prisma.syllabus.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: { topics: { orderBy: { order: 'asc' } } }
    });
    res.json(syllabuses);
  } catch (error) { next(error); }
});

app.post('/api/syllabuses', authenticate, async (req, res, next) => {
  try {
    const { schoolId, name, materials } = req.body;
    if (!schoolId || !name) return res.status(400).json({ error: 'Missing required fields' });
    const syllabus = await prisma.syllabus.create({
      data: {
        name,
        materials: materials || null,
        schoolId: parseInt(schoolId)
      },
      include: { topics: true }
    });
    res.json(syllabus);
  } catch (error) { next(error); }
});

app.put('/api/syllabuses/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, materials } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (materials !== undefined) data.materials = materials;

    const syllabus = await prisma.syllabus.update({
      where: { id: parseInt(id) },
      data,
      include: { topics: { orderBy: { order: 'asc' } } }
    });
    res.json(syllabus);
  } catch (error) { next(error); }
});

app.delete('/api/syllabuses/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.syllabus.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});


app.get('/api/rooms', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    res.json(await prisma.room.findMany({ where: { schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});

app.post('/api/rooms', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.capacity) data.capacity = parseInt(data.capacity);
    res.json(await prisma.room.create({ data: { ...data, schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});

app.delete('/api/rooms/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    await prisma.room.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ===================== ORGANIZATION ENDPOINTS =====================

app.get('/api/organizations', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    const orgs = await prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });

    // Aggregate stats per org via grouped queries (4 queries total regardless of org count)
    const [studentGroups, teacherGroups, revenueGroups, userGroups, schoolGroups, adminUsers] = await Promise.all([
      prisma.student.groupBy({ by: ['schoolId'], _count: { id: true } }),
      prisma.teacher.groupBy({ by: ['schoolId'], _count: { id: true } }),
      prisma.payment.groupBy({ by: ['schoolId'], _sum: { amount: true } }),
      prisma.user.groupBy({ by: ['schoolId'], _count: { id: true } }),
      prisma.school.findMany({ select: { id: true, organizationId: true } }),
      prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true, name: true, phone: true, schoolId: true }
      })
    ]);

    const toSchoolMap = (arr, key, val) => Object.fromEntries(arr.map(r => [r.schoolId, r[key]?.[val] || 0]));
    const studentsBySchool = toSchoolMap(studentGroups, '_count', 'id');
    const teachersBySchool = toSchoolMap(teacherGroups, '_count', 'id');
    const revenuesBySchool = toSchoolMap(revenueGroups, '_sum', 'amount');
    const usersBySchool    = toSchoolMap(userGroups,    '_count', 'id');

    const enriched = orgs.map(org => {
      const orgSchools = schoolGroups.filter(s => s.organizationId === org.id);
      const schoolCount   = orgSchools.length;
      const studentCount  = orgSchools.reduce((a, s) => a + (studentsBySchool[s.id] || 0), 0);
      const teacherCount  = orgSchools.reduce((a, s) => a + (teachersBySchool[s.id] || 0), 0);
      const revenue       = orgSchools.reduce((a, s) => a + (revenuesBySchool[s.id] || 0), 0);
      const userCount     = orgSchools.reduce((a, s) => a + (usersBySchool[s.id] || 0), 0);
      
      // Sort schools by ID ascending to guarantee the primary/first branch admin is preferred
      const sortedSchools = [...orgSchools].sort((a, b) => a.id - b.id);
      let orgAdmin = null;
      for (const s of sortedSchools) {
        const admin = adminUsers.find(u => u.schoolId === s.id);
        if (admin) {
          orgAdmin = admin;
          break;
        }
      }
      
      return { 
        ...org, 
        schoolCount, 
        studentCount, 
        teacherCount, 
        revenue, 
        userCount,
        adminName: orgAdmin ? orgAdmin.name : '',
        adminEmail: orgAdmin ? orgAdmin.email : '',
        adminPhone: orgAdmin ? orgAdmin.phone : '',
        adminId: orgAdmin ? orgAdmin.id : null
      };
    });

    res.json(enriched);
  } catch (error) { next(error); }
});

app.get('/api/organizations/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    const orgId = parseInt(req.params.id);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Tashkilot topilmadi' });

    const schools = await prisma.school.findMany({ where: { organizationId: orgId } });

    const [studentGroups, teacherGroups, revenueGroups, userGroups, adminUsers] = await Promise.all([
      prisma.student.groupBy({ by: ['schoolId'], where: { schoolId: { in: schools.map(s => s.id) } }, _count: { id: true } }),
      prisma.teacher.groupBy({ by: ['schoolId'], where: { schoolId: { in: schools.map(s => s.id) } }, _count: { id: true } }),
      prisma.payment.groupBy({ by: ['schoolId'], where: { schoolId: { in: schools.map(s => s.id) } }, _sum: { amount: true } }),
      prisma.user.groupBy({ by: ['schoolId'], where: { schoolId: { in: schools.map(s => s.id) } }, _count: { id: true } }),
      prisma.user.findMany({
        where: { role: 'ADMIN', schoolId: { in: schools.map(s => s.id) } },
        select: { id: true, email: true, name: true, phone: true, schoolId: true }
      })
    ]);

    const toMap = (arr, key, val) => Object.fromEntries(arr.map(r => [r.schoolId, r[key]?.[val] || 0]));
    const students = toMap(studentGroups, '_count', 'id');
    const teachers = toMap(teacherGroups, '_count', 'id');
    const revenues = toMap(revenueGroups, '_sum', 'amount');
    const users    = toMap(userGroups,    '_count', 'id');

    const enrichedSchools = schools.map(s => ({
      ...s,
      studentCount: students[s.id] || 0,
      teacherCount: teachers[s.id] || 0,
      revenue:      revenues[s.id] || 0,
      userCount:    users[s.id]    || 0,
    }));

    // Find the admin of the first school branch (sorted by ID)
    const sortedSchools = [...schools].sort((a, b) => a.id - b.id);
    let firstAdmin = null;
    for (const s of sortedSchools) {
      const admin = adminUsers.find(u => u.schoolId === s.id);
      if (admin) {
        firstAdmin = admin;
        break;
      }
    }

    res.json({ 
      ...org, 
      schools: enrichedSchools,
      adminName: firstAdmin ? firstAdmin.name : '',
      adminEmail: firstAdmin ? firstAdmin.email : '',
      adminPhone: firstAdmin ? firstAdmin.phone : '',
      adminId: firstAdmin ? firstAdmin.id : null
    });
  } catch (error) { next(error); }
});

app.post('/api/organizations', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    const { name, address, phone, adminName, adminEmail, adminPassword, maxSchools } = req.body;
    if (!name) return res.status(400).json({ error: 'Tashkilot nomi kiritilishi shart' });
    if (!adminEmail || !adminPassword) return res.status(400).json({ error: 'Admin email va parol kiritilishi shart' });

    // Check email unique
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create org + default school + admin user in a transaction
    const org = await prisma.organization.create({
      data: {
        name,
        address,
        phone,
        status: 'Sinov',
        maxSchools: maxSchools || 3,
        schools: {
          create: [
            {
              name: name + ' (Asosiy)',
              address: address || null,
              users: {
                create: [{
                  name: adminName || 'Admin',
                  email: adminEmail,
                  password: hashedPassword,
                  role: 'ADMIN',
                  phone: phone || null,
                }]
              }
            }
          ]
        }
      },
      include: { schools: { include: { users: { select: { id: true, name: true, email: true, role: true } } } } }
    });
    res.json(org);
  } catch (error) { next(error); }
});

app.delete('/api/organizations/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    const orgId = parseInt(req.params.id);
    const schools = await prisma.school.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const schoolIds = schools.map(s => s.id);

    if (schoolIds.length > 0) {
      await prisma.$transaction([
        prisma.examResult.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.examAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.exam.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.question.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.attendance.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.score.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.teacherAttendance.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.deliveryLog.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.route.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.transport.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.smsLog.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.payment.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.lead.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.expense.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.student.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.group.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.teacher.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.course.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.room.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.setting.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.user.deleteMany({ where: { schoolId: { in: schoolIds } } }),
        prisma.school.deleteMany({ where: { id: { in: schoolIds } } }),
      ]);
    }

    await prisma.organization.delete({ where: { id: orgId } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Organization Subscription & Admin Settings ---
app.put('/api/organizations/:id/subscription', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    const orgId = parseInt(req.params.id);
    const { 
      name, address, phone, 
      status, expiresAt, maxSchools,
      adminName, adminEmail, adminPhone, adminPassword 
    } = req.body;

    const orgData = {};
    if (name !== undefined) orgData.name = name;
    if (address !== undefined) orgData.address = address;
    if (phone !== undefined) orgData.phone = phone;
    if (status !== undefined) orgData.status = status;
    if (expiresAt !== undefined) orgData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (maxSchools !== undefined) orgData.maxSchools = parseInt(maxSchools);

    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: orgData
    });

    const schools = await prisma.school.findMany({ 
      where: { organizationId: orgId }, 
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    const schoolIds = schools.map(s => s.id);

    if (schoolIds.length > 0) {
      let firstAdmin = null;
      for (const sId of schoolIds) {
        const admin = await prisma.user.findFirst({
          where: { role: 'ADMIN', schoolId: sId }
        });
        if (admin) {
          firstAdmin = admin;
          break;
        }
      }

      if (firstAdmin) {
        const adminData = {};
        if (adminName !== undefined) adminData.name = adminName;
        if (adminPhone !== undefined) adminData.phone = adminPhone;
        if (adminEmail !== undefined && adminEmail !== firstAdmin.email) {
          const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
          if (existingUser) return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
          adminData.email = adminEmail;
        }
        if (adminPassword) {
          adminData.password = await bcrypt.hash(adminPassword, 10);
        }

        if (Object.keys(adminData).length > 0) {
          await prisma.user.update({
            where: { id: firstAdmin.id },
            data: adminData
          });
        }
      } else if (adminEmail) {
        const hashedPassword = await bcrypt.hash(adminPassword || '123456', 10);
        await prisma.user.create({
          data: {
            name: adminName || 'Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN',
            phone: adminPhone || phone || null,
            schoolId: schoolIds[0]
          }
        });
      }
    }

    res.json(updatedOrg);
  } catch (error) { next(error); }
});

// --- SaaS Leads ---
app.get('/api/saas-leads', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'SELLER') {
      return res.status(403).json({ error: 'Ruxsat yoq' });
    }
    
    let where = {};
    if (req.user.role === 'SELLER') {
      where = { sellerId: req.user.id };
    }
    
    const leads = await prisma.saaSLead.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leads);
  } catch (error) { next(error); }
});

app.post('/api/saas-leads', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'SELLER') {
      return res.status(403).json({ error: 'Ruxsat yoq' });
    }
    
    const { name, phone, centerName, status, notes, sellerId } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and Phone required' });
    
    const data = {
      name,
      phone,
      centerName,
      status: status || 'Yangi',
      notes,
      sellerId: req.user.role === 'SELLER' ? req.user.id : (sellerId ? parseInt(sellerId) : null)
    };
    
    const lead = await prisma.saaSLead.create({
      data,
      include: {
        seller: {
          select: { id: true, name: true }
        }
      }
    });
    res.status(201).json(lead);
  } catch (error) { next(error); }
});

app.put('/api/saas-leads/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'SELLER') {
      return res.status(403).json({ error: 'Ruxsat yoq' });
    }
    
    const leadId = parseInt(req.params.id);
    const { name, phone, centerName, status, notes, sellerId } = req.body;
    
    const lead = await prisma.saaSLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead topilmadi' });
    
    if (req.user.role === 'SELLER' && lead.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Faqat o\'zingizga biriktirilgan lidlarni tahrirlashingiz mumkin' });
    }
    
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (centerName !== undefined) data.centerName = centerName;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (sellerId !== undefined && req.user.role === 'SUPERADMIN') {
      data.sellerId = sellerId ? parseInt(sellerId) : null;
    }
    
    const updated = await prisma.saaSLead.update({
      where: { id: leadId },
      data,
      include: {
        seller: {
          select: { id: true, name: true }
        }
      }
    });
    res.json(updated);
  } catch (error) { next(error); }
});

app.delete('/api/saas-leads/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'SELLER') {
      return res.status(403).json({ error: 'Ruxsat yoq' });
    }
    const leadId = parseInt(req.params.id);
    const lead = await prisma.saaSLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead topilmadi' });
    
    if (req.user.role === 'SELLER' && lead.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Faqat o\'zingizga biriktirilgan lidlarni o\'chirishingiz mumkin' });
    }
    
    await prisma.saaSLead.delete({ where: { id: leadId } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Sellers/Sales Agents Management (Superadmin only) ---
app.get('/api/sellers', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    
    const sellers = await prisma.user.findMany({
      where: { role: 'SELLER' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        sellerLeads: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });
    
    const enrichedSellers = sellers.map(s => {
      const totalLeads = s.sellerLeads.length;
      const convertedLeads = s.sellerLeads.filter(l => l.status === 'Sotildi').length;
      const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
      return {
        id: s.id,
        email: s.email,
        name: s.name,
        phone: s.phone,
        createdAt: s.createdAt,
        totalLeads,
        convertedLeads,
        conversionRate
      };
    });
    
    res.json(enrichedSellers);
  } catch (error) { next(error); }
});

app.post('/api/sellers', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruxsat yoq' });
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, name and password required' });
    }
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Ushbu email bilan foydalanuvchi allaqachon mavjud' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const seller = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: 'SELLER',
        schoolId: null
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true
      }
    });
    res.status(201).json(seller);
  } catch (error) { next(error); }
});


// ===================== INIT (single bulk-load endpoint) =====================
// Replaces 19 separate API calls with 1 — critical for Vercel cold-start perf

app.get('/api/init', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'schoolId required' });

    let schoolsWhere = {};
    let targetSchoolIds = [];

    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'SELLER') {
      const userSchoolId = req.user.schoolId || (schoolId > 0 ? schoolId : null);
      if (userSchoolId) {
        const userSchool = await prisma.school.findUnique({
          where: { id: userSchoolId }
        });
        if (userSchool && userSchool.organizationId) {
          schoolsWhere = { organizationId: userSchool.organizationId };
          const orgSchools = await prisma.school.findMany({
            where: { organizationId: userSchool.organizationId },
            select: { id: true }
          });
          targetSchoolIds = orgSchools.map(s => s.id);
        } else {
          schoolsWhere = { id: userSchoolId };
          targetSchoolIds = [userSchoolId];
        }
      }
      if (schoolId > 0) {
        targetSchoolIds = [schoolId];
      }
    } else {
      if (schoolId > 0) {
        schoolsWhere = { id: schoolId };
        targetSchoolIds = [schoolId];
      } else {
        schoolsWhere = {};
        const allSchools = await prisma.school.findMany({ select: { id: true } });
        targetSchoolIds = allSchools.map(s => s.id);
      }
    }

    const whereQuery = { schoolId: { in: targetSchoolIds } };

    // All queries run in parallel — only 1 DB round-trip overhead
    const [
      students, teachers, groups, leads, payments, courses, rooms,
      settings, attendances, scores, teacherAttendances, staffAttendances, expenses,
      transports, routes, users, questions, exams, examResults, schools,
      topics, syllabuses, directions
    ] = await Promise.all([
      prisma.student.findMany({
        where: whereQuery,
        // Marshrut bekatlari ham kerak: o'quvchi qaysi marshrutda ekani
        // formalarda va profilda shu yerdan ko'rinadi.
        include: { groups: { select: { id: true } }, routeStops: { select: { routeId: true } } }
      }),
      prisma.teacher.findMany({ where: whereQuery }),
      prisma.group.findMany({
        where: whereQuery,
        include: {
          students: { select: { id: true } },
          course: { select: { name: true } }
        }
      }),
      prisma.lead.findMany({ where: whereQuery }),
      prisma.payment.findMany({ where: whereQuery }),
      prisma.course.findMany({ where: whereQuery }),
      prisma.room.findMany({ where: whereQuery }),
      prisma.setting.findFirst({ where: { schoolId: { in: targetSchoolIds } } }),
      // Only the recent window loads with the app. Attendance is the one table that grows
      // without bound — 255 students marked daily is ~38k rows a year — and /api/init is a
      // single response that Vercel caps at 4.5 MB. Older records are fetched per student
      // or per group from /api/attendances when a detail screen actually needs them.
      prisma.attendance.findMany({ where: { ...whereQuery, date: { gte: attendanceWindowStart() } } }),
      prisma.score.findMany({ where: whereQuery }),
      prisma.teacherAttendance.findMany({ where: whereQuery }),
      // Xodim davomati (profildagi "Ish grafigi" kalendari yozadigan jadval).
      // Hisobot ilgari TeacherAttendance dan o'qir edi, unga esa hech narsa
      // yozilmay qolgan — shuning uchun hamma xodim 0% ko'rinardi.
      prisma.staffAttendance.findMany({ where: whereQuery }),
      prisma.expense.findMany({ where: whereQuery }),
      prisma.transport.findMany({
        where: whereQuery,
        include: { driver: true }
      }),
      prisma.route.findMany({
        where: whereQuery,
        // Bekatlar bilan: `studentIds` endi ustundan emas, shu yerdan
        // hisoblanadi (pastda marshrutJavobi). Aks holda sahifa yangilangach
        // yangi marshrutlar bo'sh ko'rinardi.
        include: ROUTE_INCLUDE
      }),
      prisma.user.findMany({
        where: whereQuery,
        select: {
          id: true, email: true, name: true, phone: true, photo: true, position: true,
          salary: true, role: true, createdAt: true, telegramId: true, schoolId: true,
          workDays: true, kpiPercent: true, status: true,
          teacherProfile: { select: { id: true } }
        }
      }),
      prisma.question.findMany({ where: whereQuery }),
      prisma.exam.findMany({ where: whereQuery }),
      prisma.examResult.findMany({ where: whereQuery }),
      prisma.school.findMany({ where: schoolsWhere }),
      prisma.topic.findMany({ where: whereQuery }),
      prisma.syllabus.findMany({ where: whereQuery, include: { topics: { orderBy: { order: 'asc' } } } }),
      prisma.direction.findMany({ where: whereQuery, orderBy: { name: 'asc' } }),
    ]);

    // Xodim yozuvi yo'q ustoz qolib ketmasin: aks holda uning profili boshqacha
    // ochiladi va oylik berib bo'lmaydi. Bir marta tuzalgandan keyin bu shart
    // hech qachon bajarilmaydi.
    let teachersRoyxati = teachers;
    if (teachersRoyxati.some(t => !t.userId)) {
      if (await ustozlarniXodimgaBogla(targetSchoolIds)) {
        teachersRoyxati = await prisma.teacher.findMany({ where: whereQuery });
      }
    }

    // Map relations to flat IDs / names just like individual endpoints do
    const mappedStudents = students.map(s => ({
      ...s,
      groups: s.groups.map(g => g.id),
      routeIds: (s.routeStops || []).map(x => x.routeId)
    }));
    sorashniQozgatish();
    const mappedRoutes = routes.map(marshrutJavobi);
    const mappedGroups = groups.map(g => ({
      ...g,
      studentIds: g.students.map(s => s.id),
      courseName: g.course?.name
    }));

    res.json({
      students: mappedStudents,
      teachers: teachersRoyxati,
      groups: mappedGroups,
      leads, payments, courses, rooms,
      // Admins configure SMS/Telegram from the settings screen and need the real values;
      // every other role gets the masked copy.
      settings: isAdmin(req.user) ? hidePaymeSecrets(settings) : stripSettingSecrets(settings),
      attendances, scores, teacherAttendances, staffAttendances, expenses,
      transports, routes: mappedRoutes, questions, exams, examResults, schools,
      topics, syllabuses, directions,
      users: users.map(u => {
        const { teacherProfile, ...qolgan } = u;
        return { ...qolgan, teacherId: teacherProfile?.id ?? null };
      })
    });
  } catch (error) { next(error); }
});

// ===================== SCHOOL / BRANCH ENDPOINTS =====================

app.get('/api/schools', authenticate, async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'SUPERADMIN') {
      const schools = await prisma.school.findMany();
      // 4 ta grouped query — N ta maktab bo'lsa ham faqat 4 ta DB murojaat
      const [studentGroups, teacherGroups, revenueGroups, userGroups] = await Promise.all([
        prisma.student.groupBy({ by: ['schoolId'], _count: { id: true } }),
        prisma.teacher.groupBy({ by: ['schoolId'], _count: { id: true } }),
        prisma.payment.groupBy({ by: ['schoolId'], _sum: { amount: true } }),
        prisma.user.groupBy({ by: ['schoolId'], _count: { id: true } }),
      ]);

      const toMap = (arr, key, val) => Object.fromEntries(arr.map(r => [r.schoolId, r[key]?.[val] || 0]));
      const students = toMap(studentGroups, '_count', 'id');
      const teachers = toMap(teacherGroups, '_count', 'id');
      const revenues = toMap(revenueGroups, '_sum', 'amount');
      const users    = toMap(userGroups,    '_count', 'id');

      return res.json(schools.map(s => ({
        ...s,
        studentCount: students[s.id] || 0,
        teacherCount: teachers[s.id] || 0,
        revenue:      revenues[s.id] || 0,
        userCount:    users[s.id]    || 0,
      })));
    }

    let schoolsWhere = {};
    if (req.user.schoolId) {
      const userSchool = await prisma.school.findUnique({
        where: { id: req.user.schoolId }
      });
      if (userSchool && userSchool.organizationId) {
        schoolsWhere = { organizationId: userSchool.organizationId };
      } else {
        schoolsWhere = { id: req.user.schoolId };
      }
    } else {
      schoolsWhere = { id: -1 };
    }

    const schools = await prisma.school.findMany({ where: schoolsWhere });
    res.json(schools);
  } catch (error) { next(error); }
});

app.post('/api/schools', authenticate, async (req, res, next) => {
  try {
    const isSuper = req.user.role === 'SUPERADMIN';
    const isAdmin = req.user.role === 'ADMIN';

    if (!isSuper && !isAdmin) {
      return res.status(403).json({ error: 'Faqat Super Admin yoki Tashkilot Admini filial yarata oladi' });
    }

    const { name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Filial nomi kiritilishi shart' });

    let orgId = null;

    if (isSuper) {
      if (req.body.organizationId) {
        orgId = parseInt(req.body.organizationId);
      }
    } else {
      // Admin o'z schoolId orqali organizationId ni topadi.
      // Agar organizationId yo'q bo'lsa ham, filial yaratishga ruxsat beriladi.
      if (req.user.schoolId) {
        const adminSchool = await prisma.school.findUnique({
          where: { id: req.user.schoolId }
        });
        if (adminSchool?.organizationId) {
          orgId = adminSchool.organizationId;
        }
      }
    }

    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: { _count: { select: { schools: true } } }
      });
      if (org && org._count.schools >= (org.maxSchools || 10)) {
        return res.status(400).json({
          error: `Filiallar soni limitga yetdi (${org.maxSchools || 10} ta).`
        });
      }
    }

    const data = { name, address };
    if (orgId) data.organizationId = orgId;

    res.json(await prisma.school.create({ data }));
  } catch (error) { next(error); }
});

// Filial nomi/manzilini tahrirlash. Ilgari faqat qo'shish va o'chirish bor edi,
// shuning uchun nomdagi xatoni ("Filliali") tuzatib bo'lmasdi — filialni o'chirib
// qaytadan yaratish esa unga bog'langan barcha ma'lumotni yo'qotardi.
app.put('/api/schools/:id', authenticate, async (req, res, next) => {
  try {
    const isSuper = req.user.role === 'SUPERADMIN';
    const isAdmin = req.user.role === 'ADMIN';
    if (!isSuper && !isAdmin) {
      return res.status(403).json({ error: "Faqat Super Admin yoki Tashkilot Admini filialni tahrirlay oladi" });
    }

    const schoolId = parseInt(req.params.id);
    if (isNaN(schoolId)) return res.status(400).json({ error: "Noto'g'ri ID" });

    const { name, address } = req.body;
    const data = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: "Filial nomi bo'sh bo'lmasligi kerak" });
      data.name = trimmed;
    }
    if (address !== undefined) {
      const trimmed = String(address).trim();
      data.address = trimmed || null;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "O'zgartirish uchun ma'lumot yo'q" });
    }

    res.json(await prisma.school.update({ where: { id: schoolId }, data }));
  } catch (error) { next(error); }
});

app.delete('/api/schools/:id', authenticate, async (req, res, next) => {
  try {
    const isSuper = req.user.role === 'SUPERADMIN';
    const isAdmin = req.user.role === 'ADMIN';

    if (!isSuper && !isAdmin) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    const schoolId = parseInt(req.params.id);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Noto\'g\'ri ID' });

    if (isAdmin) {
      if (schoolId === req.user.schoolId) {
        return res.status(400).json({ error: 'O\'zingiz faoliyat yuritayotgan filialni o\'chira olmaysiz' });
      }
      const targetSchool = await prisma.school.findUnique({ where: { id: schoolId } });
      const adminSchool = await prisma.school.findUnique({ where: { id: req.user.schoolId } });
      if (!targetSchool || !adminSchool || targetSchool.organizationId !== adminSchool.organizationId) {
        return res.status(403).json({ error: 'Faqat o\'zingizning tashkilotingizga tegishli filialni o\'chira olasiz' });
      }
    }

    // Cascade delete — correct order to satisfy all FK constraints
    await prisma.$transaction([
      // 1. Null out optional cross-FK references to avoid circular dependency
      prisma.transport.updateMany({ where: { schoolId }, data: { driverId: null } }),
      prisma.route.updateMany({ where: { schoolId }, data: { driverId: null, transportId: null } }),
      prisma.student.updateMany({ where: { schoolId }, data: { transportId: null } }),
      // 2. Delete leaf records that reference students / teachers / groups
      prisma.deliveryLog.deleteMany({ where: { schoolId } }),
      prisma.attendance.deleteMany({ where: { schoolId } }),
      prisma.score.deleteMany({ where: { schoolId } }),
      prisma.examAssignment.deleteMany({ where: { schoolId } }),
      prisma.examResult.deleteMany({ where: { schoolId } }),
      prisma.teacherAttendance.deleteMany({ where: { schoolId } }),
      prisma.staffAttendance.deleteMany({ where: { schoolId } }),
      prisma.salaryPayment.deleteMany({ where: { schoolId } }),
      prisma.payment.deleteMany({ where: { schoolId } }),
      // 3. Delete other school-level records
      prisma.smsLog.deleteMany({ where: { schoolId } }),
      prisma.question.deleteMany({ where: { schoolId } }),
      prisma.messageTemplate.deleteMany({ where: { schoolId } }),
      prisma.messageCampaign.deleteMany({ where: { schoolId } }),
      prisma.autoMessageRule.deleteMany({ where: { schoolId } }),
      prisma.applyToken.deleteMany({ where: { schoolId } }),
      prisma.expense.deleteMany({ where: { schoolId } }),
      // 4. Delete entities in FK-safe order
      prisma.exam.deleteMany({ where: { schoolId } }),
      prisma.route.deleteMany({ where: { schoolId } }),
      prisma.transport.deleteMany({ where: { schoolId } }),
      prisma.lead.deleteMany({ where: { schoolId } }),
      prisma.student.deleteMany({ where: { schoolId } }),
      prisma.group.deleteMany({ where: { schoolId } }),
      prisma.teacher.deleteMany({ where: { schoolId } }),
      prisma.topic.deleteMany({ where: { schoolId } }),
      prisma.course.deleteMany({ where: { schoolId } }),
      prisma.syllabus.deleteMany({ where: { schoolId } }),
      prisma.room.deleteMany({ where: { schoolId } }),
      prisma.setting.deleteMany({ where: { schoolId } }),
      prisma.user.deleteMany({ where: { schoolId } }),
      prisma.school.delete({ where: { id: schoolId } })
    ]);

    res.json({ success: true });
  } catch (error) { next(error); }
});


// The error handler used to sit right here, roughly 2000 lines before the last route.
// Express only reaches an error handler registered *after* the layer that failed, so
// every route below fell through to Express's default HTML 500 — which the frontend
// could not parse as JSON. It now lives at the end of the file, after all routes.

// Settings
app.get('/api/settings', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

    let settings = await prisma.setting.findUnique({ where: { schoolId: parseInt(schoolId) } });
    if (!settings) {
      settings = await prisma.setting.create({
        data: { schoolId: parseInt(schoolId), orgName: "QUANTUM EDU" }
      });
    }
    res.json(isAdmin(req.user) ? hidePaymeSecrets(settings) : stripSettingSecrets(settings));
  } catch (error) { next(error); }
});

app.put('/api/settings', authenticate, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Faqat administrator sozlamalarni o\'zgartira oladi' });
    const { schoolId, eskizPasswordSet, telegramSet, paymeKeySet, paymeTestKeySet, paymeEndpointToken, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    await rasmMaydoniniTozala(data, 'logo', 'logo');

    // An empty secret means "unchanged" — never let a blank field wipe stored credentials.
    for (const key of ['eskizPassword', 'telegram', 'paymeKey', 'paymeTestKey']) {
      if (data[key] !== undefined && String(data[key]).trim() === '') delete data[key];
    }
    // Stored encrypted when SETTINGS_KEY is configured, so a leaked database does not
    // hand over the SMS account. Without the key this is a no-op and behaviour is unchanged.
    if (data.eskizPassword !== undefined) data.eskizPassword = encryptSecret(data.eskizPassword);
    for (const key of ['paymeKey', 'paymeTestKey']) {
      if (data[key] !== undefined) data[key] = encryptSecret(String(data[key]).trim());
    }
    if (data.paymeMerchantId !== undefined) data.paymeMerchantId = String(data.paymeMerchantId || '').trim() || null;
    if (data.paymeMode !== undefined && !PAYME_MODES.includes(data.paymeMode)) {
      return res.status(400).json({ error: "Payme rejimi noto'g'ri" });
    }
    if (data.paymeVatPercent !== undefined) {
      const vat = parseInt(data.paymeVatPercent);
      data.paymeVatPercent = Number.isInteger(vat) && vat >= 0 && vat <= 100 ? vat : 0;
    }
    for (const key of ['paymeMxik', 'paymePackageCode']) {
      if (data[key] !== undefined) data[key] = String(data[key] || '').trim() || null;
    }
    for (const key of ['paymeIpCheck', 'paymeAllowRefund']) {
      if (data[key] !== undefined) data[key] = data[key] === true || data[key] === 'true';
    }

    const oldSettings = await prisma.setting.findUnique({ where: { schoolId: parseInt(schoolId) } });

    // Jonli rejimga o'tish uchun jonli kalit, testga — test kaliti kerak.
    // Aks holda webhook hamma so'rovni rad etib, "nega ishlamayapti" bo'lardi.
    if (data.paymeMode === 'live' && !(data.paymeKey || oldSettings?.paymeKey)) {
      return res.status(400).json({ error: 'Jonli rejim uchun avval Payme kalitini kiriting' });
    }
    if (data.paymeMode === 'test' && !(data.paymeTestKey || oldSettings?.paymeTestKey)) {
      return res.status(400).json({ error: 'Test rejimi uchun avval Payme test kalitini kiriting' });
    }
    // Webhook manzilining maxfiy qismi bir marta yaratiladi; mijoz uni o'zgartira olmaydi.
    if (!oldSettings?.paymeEndpointToken) data.paymeEndpointToken = generatePaymeEndpointToken();

    const settings = await prisma.setting.upsert({
      where: { schoolId: parseInt(schoolId) },
      update: data,
      create: { ...data, schoolId: parseInt(schoolId) }
    });

    // If telegram token changed and is valid, set webhook automatically
    if (settings.telegram && settings.telegram.includes(':') && (!oldSettings || oldSettings.telegram !== settings.telegram)) {
      try {
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api/telegram-webhook/${schoolId}`;
        
        const { Telegraf } = await import('telegraf');
        const tempBot = new Telegraf(settings.telegram.trim());
        await tempBot.telegram.setWebhook(webhookUrl);
        console.log(`Successfully registered Telegram Webhook for school ${schoolId} to: ${webhookUrl}`);
      } catch (err) {
        console.error(`Failed to register Telegram Webhook for school ${schoolId}:`, err.message);
      }
    }

    res.json(hidePaymeSecrets(settings));
  } catch (error) { next(error); }
});

// Attendances
app.get('/api/attendances', authenticate, async (req, res, next) => {
  try {
    const { schoolId, studentId, groupId, from, to } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

    let where = { schoolId: parseInt(schoolId) };
    if (studentId) where.studentId = parseInt(studentId);
    if (groupId) where.groupId = parseInt(groupId);
    // A group's full history runs to thousands of rows. Screens that render only a few
    // weeks pass a date range rather than pulling everything.
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = String(from);
      if (to) where.date.lte = String(to);
    }

    const attendances = await prisma.attendance.findMany({ where });
    res.json(attendances);
  } catch (error) { next(error); }
});
app.post('/api/attendances', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    
    const studentId = parseInt(data.studentId);
    const groupId = parseInt(data.groupId);
    const date = data.date;

    const existing = await prisma.attendance.findFirst({
      where: { studentId, groupId, date, schoolId: parseInt(schoolId) }
    });

    let attendance;
    if (existing) {
      const updateData = { status: data.status };
      if (data.topicId !== undefined) updateData.topicId = data.topicId ? parseInt(data.topicId) : null;
      if (data.caughtUp !== undefined) updateData.caughtUp = data.caughtUp === true;
      
      attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: updateData
      });
    } else {
      const prismaData = {
        studentId,
        groupId,
        date,
        status: data.status,
        schoolId: parseInt(schoolId)
      };
      if (data.topicId) prismaData.topicId = parseInt(data.topicId);
      if (data.caughtUp !== undefined) prismaData.caughtUp = data.caughtUp === true;

      attendance = await prisma.attendance.create({ data: prismaData });
    }
    
    // Davomat qo'yilganda xabar avtomatik ketmaydi. Ilgari har bir belgilash
    // ota-onaga darhol Telegram xabari yuborardi: yo'qlama tuzatilsa ular ikki-uch
    // marta xabar olardi. Endi xabarni xodim POST /api/attendances/notify orqali
    // bir marta o'zi yuboradi.

    res.json(attendance);
  } catch (error) { next(error); }
});

app.put('/api/attendances/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, topicId, caughtUp } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (topicId !== undefined) data.topicId = topicId ? parseInt(topicId) : null;
    if (caughtUp !== undefined) data.caughtUp = caughtUp === true;

    const attendance = await prisma.attendance.update({
      where: { id: parseInt(id) },
      data
    });
    res.json(attendance);
  } catch (error) { next(error); }
});

// PATCH update topic for all existing attendances in a group/date
app.patch('/api/attendances/topic', authenticate, async (req, res, next) => {
  try {
    const { schoolId, groupId, date, topicId } = req.body;
    if (!schoolId || !groupId || !date) return res.status(400).json({ error: 'Missing fields' });

    const result = await prisma.attendance.updateMany({
      where: { groupId: parseInt(groupId), date, schoolId: parseInt(schoolId) },
      data: { topicId: topicId ? parseInt(topicId) : null }
    });
    res.json({ count: result.count });
  } catch (error) { next(error); }
});

// Batch attendance — mark all students at once for a group/date
app.post('/api/attendances/batch', authenticate, async (req, res, next) => {
  try {
    const { schoolId, groupId, date, records, topicId } = req.body;
    if (!schoolId || !groupId || !date || !records) return res.status(400).json({ error: 'Missing fields' });
    
    const results = [];

    for (const record of records) {
      const existing = await prisma.attendance.findFirst({
        where: { studentId: record.studentId, groupId: parseInt(groupId), date, schoolId: parseInt(schoolId) }
      });
      let updatedOrCreated;

      if (existing) {
        const updateData = { status: record.status };
        if (topicId !== undefined) {
          updateData.topicId = topicId ? parseInt(topicId) : null;
        }
        
        updatedOrCreated = await prisma.attendance.update({
          where: { id: existing.id },
          data: updateData
        });
      } else {
        const createData = {
          studentId: record.studentId,
          groupId: parseInt(groupId),
          date,
          status: record.status,
          schoolId: parseInt(schoolId)
        };
        if (topicId !== undefined) {
          createData.topicId = topicId ? parseInt(topicId) : null;
        }
        
        updatedOrCreated = await prisma.attendance.create({
          data: createData
        });
      }
      results.push(updatedOrCreated);

    }
    res.json(results);
  } catch (error) { next(error); }
});

// Bir kunlik yo'qlamani ota-onalarga bitta bosishda yuborish.
// Davomat qo'yilganda xabar avtomatik ketmaydi — xodim yo'qlamani tekshirib
// bo'lgach shu tugmani bosadi va har bir o'quvchi uchun bitta xabar ketadi.
app.post('/api/attendances/notify', authenticate, async (req, res, next) => {
  try {
    const { schoolId, groupId, date } = req.body;
    if (!schoolId || !groupId || !date) {
      return res.status(400).json({ error: "schoolId, groupId va date kerak" });
    }

    const records = await prisma.attendance.findMany({
      where: { groupId: parseInt(groupId), date, schoolId: parseInt(schoolId) },
      include: { student: true, group: { select: { name: true } } }
    });

    if (records.length === 0) {
      return res.json({ success: true, sent: 0, skipped: 0, total: 0, message: "Bu kunga yo'qlama qo'yilmagan" });
    }

    const schoolBot = await getTelegramBot(parseInt(schoolId));
    if (!schoolBot) {
      return res.status(400).json({ error: "Telegram bot sozlanmagan" });
    }

    const ICONS = { Keldi: "✅", Kelmapdi: "❌", Sababli: "⚠️", Kechikdi: "⏰" };
    let sent = 0;
    let skipped = 0;

    for (const record of records) {
      const student = record.student;
      if (!student) continue;

      const icon = ICONS[record.status] || "ℹ️";
      const message = [
        icon + " Davomat xabarnomasi",
        "",
        "👤 O'quvchi: " + student.name,
        "📌 Holat: " + record.status,
        "📅 Sana: " + date,
        "📚 Guruh: " + (record.group ? record.group.name : "")
      ].join(String.fromCharCode(10));

      // Ota-ona birinchi navbatda; ular ulanmagan bo'lsa o'quvchining o'ziga.
      const chatIds = [student.fatherTelegramId, student.motherTelegramId].filter(Boolean);
      if (chatIds.length === 0 && student.telegramId) chatIds.push(student.telegramId);

      if (chatIds.length === 0) { skipped++; continue; }

      for (const chatId of chatIds) {
        try {
          await schoolBot.telegram.sendMessage(chatId, message);
          sent++;
        } catch (e) {
          console.error('[Attendance notify] ' + student.name + ':', e.message);
          skipped++;
        }
      }
    }

    res.json({ success: true, sent, skipped, total: records.length });
  } catch (error) { next(error); }
});

app.delete('/api/attendances/batch', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, groupId, date } = req.query;
    if (!schoolId || !groupId || !date) return res.status(400).json({ error: 'Missing parameters' });
    
    await prisma.attendance.deleteMany({
      where: {
        groupId: parseInt(groupId),
        date: date,
        schoolId: parseInt(schoolId)
      }
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Teacher Attendances
app.get('/api/teacher-attendances', authenticate, async (req, res, next) => {
  try {
    const { schoolId, teacherId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    let where = { schoolId: parseInt(schoolId) };
    if (teacherId) where.teacherId = parseInt(teacherId);
    const attendances = await prisma.teacherAttendance.findMany({ where });
    res.json(attendances);
  } catch (error) { next(error); }
});

app.post('/api/teacher-attendances', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    // Upsert: if already exists for this teacher+date, update
    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: data.teacherId, date: data.date, schoolId: parseInt(schoolId) }
    });
    if (existing) {
      const updated = await prisma.teacherAttendance.update({ where: { id: existing.id }, data: { status: data.status } });
      return res.json(updated);
    }
    const attendance = await prisma.teacherAttendance.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    res.json(attendance);
  } catch (error) { next(error); }
});

// O'qituvchining o'z davomatini unga Telegram orqali yuborish.
// O'quvchi davomati uchun /api/attendances/notify bor edi, ustozlar uchun esa
// hech qanday xabar yo'q edi. Xabar faqat ustozning o'ziga boradi.
app.post('/api/teacher-attendances/notify', authenticate, async (req, res, next) => {
  try {
    const { schoolId, date, teacherId, userId } = req.body;
    if (!schoolId || !date) return res.status(400).json({ error: "schoolId va date kerak" });

    const records = [];

    // Davomat endi xodim jurnalida (StaffAttendance) yuritiladi — profildagi
    // "Ish grafigi" kalendari o'sha yerga yozadi. Shuning uchun avval shu
    // yerdan qaraymiz, eski TeacherAttendance esa faqat tarix uchun qoladi.
    let teacherTg = null;
    if (teacherId) {
      const t = await prisma.teacher.findUnique({
        where: { id: parseInt(teacherId) },
        select: { telegramId: true },
      });
      teacherTg = t?.telegramId || null;
    }

    if (userId) {
      const staffRows = await prisma.staffAttendance.findMany({
        where: { userId: parseInt(userId), date },
        include: { user: { select: { name: true, telegramId: true } } },
      });
      // Telegram id ustoz yozuvida bo'lishi mumkin (bot ustozni shu yerga bog'laydi).
      staffRows.forEach(r => records.push({
        status: r.status,
        name: r.user?.name,
        telegramId: r.user?.telegramId || teacherTg,
      }));
    }

    if (records.length === 0) {
      const where = { schoolId: parseInt(schoolId), date };
      if (teacherId) where.teacherId = parseInt(teacherId);
      const rows = await prisma.teacherAttendance.findMany({
        where,
        include: { teacher: { select: { name: true, telegramId: true } } }
      });
      rows.forEach(r => records.push({
        status: r.status,
        name: r.teacher?.name,
        telegramId: r.teacher?.telegramId,
      }));
    }

    if (records.length === 0) {
      return res.json({ success: true, sent: 0, skipped: 0, total: 0, message: "Bu kunga davomat qo'yilmagan" });
    }

    const schoolBot = await getTelegramBot(parseInt(schoolId));
    if (!schoolBot) return res.status(400).json({ error: "Telegram bot sozlanmagan" });

    const ICONS = { Keldi: "\u2705", Kelmapdi: "\u274C", Kelmadi: "\u274C", Sababli: "\u26A0\uFE0F" };
    let sent = 0;
    let skipped = 0;

    for (const record of records) {
      if (!record.telegramId) { skipped++; continue; }

      const icon = ICONS[record.status] || "\u2139\uFE0F";
      const message = [
        icon + " Davomat xabarnomasi",
        "",
        "\u{1F464} " + record.name,
        "\u{1F4CC} Holat: " + record.status,
        "\u{1F4C5} Sana: " + date
      ].join(String.fromCharCode(10));

      try {
        await schoolBot.telegram.sendMessage(record.telegramId, message);
        sent++;
      } catch (e) {
        console.error('[Teacher notify] ' + record.name + ':', e.message);
        skipped++;
      }
    }

    res.json({ success: true, sent, skipped, total: records.length });
  } catch (error) { next(error); }
});

// O'quvchini boshqa guruhga ko'chirish — pul oyning qolgan qismi bo'yicha
// qayta hisoblanadi. preview: true bo'lsa faqat hisob qaytadi, hech narsa yozilmaydi.
app.post('/api/students/:id/transfer', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, fromGroupId, toGroupId, date, preview } = req.body;
    if (!schoolId || !toGroupId || !date) {
      return res.status(400).json({ error: "schoolId, toGroupId va date kerak" });
    }
    const result = await transferStudent({
      studentId: req.params.id,
      fromGroupId, toGroupId, date,
      schoolId: parseInt(schoolId),
      apply: preview !== true,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (error) { next(error); }
});

// O'qishni to'xtatgan o'quvchiga o'tilmagan darslar uchun pulni qaytarish.
app.post('/api/students/:id/refund', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, date, mode, preview, groupIds } = req.body;
    if (!schoolId || !date) return res.status(400).json({ error: "schoolId va date kerak" });
    if (mode && !['cash', 'balance'].includes(mode)) {
      return res.status(400).json({ error: "mode faqat 'cash' yoki 'balance' bo'lishi mumkin" });
    }
    const result = await refundStudent({
      studentId: req.params.id,
      date, groupIds,
      mode: mode || 'balance',
      schoolId: parseInt(schoolId),
      apply: preview !== true,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (error) { next(error); }
});

// Scores
app.get('/api/scores', authenticate, async (req, res, next) => {
  try {
    const { schoolId, studentId, groupId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

    let where = { schoolId: parseInt(schoolId) };
    if (studentId) where.studentId = parseInt(studentId);
    if (groupId) where.groupId = parseInt(groupId);

    const scores = await prisma.score.findMany({ where });
    res.json(scores);
  } catch (error) { next(error); }
});

app.post('/api/scores', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const score = await prisma.score.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    res.json(score);
  } catch (error) { next(error); }
});


// ========== TRANSPORT ROUTES (UPDATED) ==========
/**
 * O'quvchini berilgan marshrutlarga biriktiradi (boshqalaridan chiqaradi).
 *
 * Forma marshrut ro'yxatini butunicha yuboradi: ro'yxatda yo'q marshrutdan
 * bekat o'chadi, yangisiga oxiriga qo'shiladi. Faqat shu filialning
 * marshrutlari qabul qilinadi.
 */
async function oquvchiMarshrutlari(studentId, routeIds, schoolId) {
  const soralgan = [...new Set((routeIds || []).map(x => parseInt(x)).filter(Number.isInteger))];
  const haqiqiy = soralgan.length
    ? (await prisma.route.findMany({ where: { id: { in: soralgan }, schoolId }, select: { id: true } })).map(r => r.id)
    : [];

  const hozirgi = await prisma.routeStop.findMany({
    where: { studentId, route: { schoolId } },
    select: { routeId: true },
  });
  const hozirgiSet = new Set(hozirgi.map(x => x.routeId));

  const ochiriladi = [...hozirgiSet].filter(id => !haqiqiy.includes(id));
  if (ochiriladi.length) {
    await prisma.routeStop.deleteMany({ where: { studentId, routeId: { in: ochiriladi } } });
  }

  for (const routeId of haqiqiy) {
    if (hozirgiSet.has(routeId)) continue;
    // Yangi bekat oxiriga qo'shiladi — tartibni Logistikada o'zgartiriladi.
    const oxirgi = await prisma.routeStop.findFirst({
      where: { routeId }, orderBy: { tartib: 'desc' }, select: { tartib: true },
    });
    await prisma.routeStop.create({
      data: { routeId, studentId, tartib: (oxirgi?.tartib ?? -1) + 1 },
    });
  }

  // O'zgargan marshrutlarda tartib qayta quriladi (avtomatik bo'lsa).
  const ozgargan = [...new Set([...ochiriladi, ...haqiqiy.filter(id => !hozirgiSet.has(id))])];
  for (const routeId of ozgargan) {
    const r = await prisma.route.findUnique({ where: { id: routeId }, select: { autoOrder: true } });
    if (r?.autoOrder) await marshrutniTartiblash(routeId).catch(e => console.error('[Tartib]', e.message));
  }
  return haqiqiy;
}

// ========== LOGISTIKA: umumiy yordamchilar ==========
//
// Ilgari transport va marshrut endpointlari req.body ni to'g'ridan-to'g'ri
// Prisma'ga uzatardi: begona maydon ham, boshqa filialning schoolId si ham
// o'tib ketardi. Endi faqat quyidagi maydonlar qabul qilinadi va yozuv
// o'zgartirilishidan oldin uning shu filialga tegishliligi tekshiriladi.
const TRANSPORT_FIELDS = ['name', 'model', 'number', 'capacity', 'driverName', 'driverPhone', 'status', 'driverId'];
const TRANSPORT_STATUSES = ['Faol', "Ta'mirda", 'Arxiv'];
const DELIVERY_STATUSES = ['Olib ketildi', 'Uyiga yetkazildi', 'Kelmadi'];
// Haydovchi — User yozuvi. include: { driver: true } uning parol hashini va
// emailini ham brauzerga yuborardi; kerak bo'lgani faqat shu uch maydon.
const DRIVER_SELECT = { id: true, name: true, phone: true };

/** Ruxsat etilgan maydonlarnigina ajratib oladi. */
function pickFields(body, fields) {
  const out = {};
  for (const key of fields) if (body[key] !== undefined) out[key] = body[key];
  return out;
}

/** Bo'sh qiymat — null (bog'lanish uzildi), noto'g'ri son — undefined. */
function optionalId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Transport ma'lumotini tekshiradi va sonlarni joyiga qo'yadi (data o'zgaradi).
 * Xato bo'lsa o'zbekcha izoh, bo'lmasa null qaytadi.
 */
async function transportXatosi(data, schoolId, ozId = null) {
  if (data.name !== undefined) {
    data.name = String(data.name).trim();
    if (!data.name) return 'Transport nomi majburiy';
  }
  if (data.capacity !== undefined) {
    const n = parseInt(data.capacity);
    // Ilgari bo'sh maydon NaN bo'lib bazaga borardi va 500 qaytarardi.
    if (!Number.isInteger(n) || n < 1 || n > 100) return "Sig'im 1 dan 100 gacha son bo'lishi kerak";
    data.capacity = n;
  }
  if (data.status !== undefined && !TRANSPORT_STATUSES.includes(data.status)) {
    return 'Holat notanish: ' + data.status;
  }
  if (data.driverId !== undefined) {
    const did = optionalId(data.driverId);
    if (did === undefined) return "Haydovchi noto'g'ri tanlandi";
    if (did !== null) {
      const driver = await prisma.user.findFirst({ where: { id: did, schoolId }, select: { id: true, name: true } });
      if (!driver) return 'Haydovchi shu filialda topilmadi';
      // Transport.driverId unique — ilgari bu P2002 bo'lib xom 500 qaytarardi.
      const band = await prisma.transport.findFirst({
        where: { driverId: did, ...(ozId ? { id: { not: ozId } } : {}) },
        select: { name: true },
      });
      if (band) return driver.name + ' allaqachon "' + band.name + '" ga biriktirilgan';
    }
    data.driverId = did;
  }
  return null;
}

app.get('/api/transports', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const transports = await prisma.transport.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: { driver: { select: DRIVER_SELECT } }
    });
    res.json(transports);
  } catch (error) { next(error); }
});
app.post('/api/transports', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    const data = pickFields(req.body, TRANSPORT_FIELDS);
    if (!data.name) return res.status(400).json({ error: 'Transport nomi majburiy' });
    const xato = await transportXatosi(data, schoolId);
    if (xato) return res.status(400).json({ error: xato });

    const transport = await prisma.transport.create({
      data: { ...data, schoolId },
      include: { driver: { select: DRIVER_SELECT } }
    });
    res.json(transport);
  } catch (error) { next(error); }
});
app.put('/api/transports/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const mavjud = await prisma.transport.findUnique({ where: { id } });
    if (!mavjud) return res.status(404).json({ error: 'Transport topilmadi' });
    if (!(await canAccessSchool(req.user, mavjud.schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    const data = pickFields(req.body, TRANSPORT_FIELDS);
    const xato = await transportXatosi(data, mavjud.schoolId, id);
    if (xato) return res.status(400).json({ error: xato });

    const transport = await prisma.transport.update({
      where: { id },
      data,
      include: { driver: { select: DRIVER_SELECT } }
    });
    res.json(transport);
  } catch (error) { next(error); }
});
app.delete('/api/transports/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const mavjud = await prisma.transport.findUnique({ where: { id } });
    if (!mavjud) return res.status(404).json({ error: 'Transport topilmadi' });
    if (!(await canAccessSchool(req.user, mavjud.schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    // Marshrutga biriktirilgan mashina o'chirilsa, marshrutning transporti
    // jimgina bo'shab qolardi va kunlik holat sahifasida yo'qolardi.
    const marshrutlar = await prisma.route.findMany({ where: { transportId: id }, select: { name: true } });
    if (marshrutlar.length > 0) {
      return res.status(400).json({
        error: 'Bu mashina marshrutga biriktirilgan: ' + marshrutlar.map(r => r.name).join(', ') +
               '. Avval marshrutga boshqa mashina tanlang.',
      });
    }

    await prisma.student.updateMany({ where: { transportId: id }, data: { transportId: null } });
    await prisma.deliveryLog.deleteMany({ where: { transportId: id } });
    await prisma.transport.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});
app.put('/api/students/:id/transport', authenticate, async (req, res, next) => {
  try {
    const studentId = parseInt(req.params.id);
    const { transportId } = req.body;
    const student = await prisma.student.update({ where: { id: studentId }, data: { transportId: transportId ? parseInt(transportId) : null } });
    res.json(student);
  } catch (error) { next(error); }
});

// ========== MARSHRUTLAR (LOGISTIKA) ==========
const ROUTE_FIELDS = ['name', 'startTime', 'transportId', 'driverId', 'days', 'direction', 'autoOrder', 'studentIds'];
const ROUTE_DAYS = ['TOQ', 'JUFT', 'HAR_KUNI'];
const ROUTE_DIRECTIONS = ['KETISH', 'QAYTISH'];
const ROUTE_INCLUDE = {
  transport: true,
  driver: { select: DRIVER_SELECT },
  stops: {
    orderBy: { tartib: 'asc' },
    include: { student: { select: { id: true, name: true, phone: true, photo: true, address: true, location: true } } },
  },
};

/**
 * Marshrutni brauzer kutgan shaklga keltiradi.
 *
 * Bekatlar endi RouteStop jadvalida, lekin javobdagi `studentIds` o'z
 * o'rnida qoladi — endi u saqlanadigan ustun emas, bekatlardan hisoblanadi.
 * Shu sabab sahifaning qolgan qismini o'zgartirmasdan ham to'g'ri ishlaydi.
 */
function marshrutJavobi(route) {
  const stops = route.stops || [];
  return {
    ...route,
    stops,
    studentIds: stops.map(x => x.studentId),
  };
}

/**
 * Bekatlarni berilgan tartibda qayta yozadi.
 *
 * Ro'yxatdan chiqarilgani o'chadi, qolganining tartibi yangilanadi. Hammasi
 * bitta tranzaksiyada: yarim yozilgan marshrut qolib ketmasin.
 */
async function bekatlarniYozish(routeId, studentIds) {
  const hozirgi = await prisma.routeStop.findMany({ where: { routeId }, select: { studentId: true } });
  const hozirgiSet = new Set(hozirgi.map(x => x.studentId));
  const yangiSet = new Set(studentIds);

  const ochiriladi = [...hozirgiSet].filter(id => !yangiSet.has(id));
  await prisma.$transaction([
    ...(ochiriladi.length
      ? [prisma.routeStop.deleteMany({ where: { routeId, studentId: { in: ochiriladi } } })]
      : []),
    ...studentIds.map((studentId, i) =>
      prisma.routeStop.upsert({
        where: { routeId_studentId: { routeId, studentId } },
        create: { routeId, studentId, tartib: i },
        update: { tartib: i },
      })
    ),
  ]);
}

/**
 * Marshrut ma'lumotini tekshiradi va sonlarni joyiga qo'yadi (data o'zgaradi).
 *
 * studentIds — tartiblangan ro'yxat, marshrutning bekatlari. Bu yerda u shu
 * filialning mavjud o'quvchilariga qisqartiriladi: o'chirilgan yoki boshqa
 * filialga ko'chgan o'quvchi ro'yxatda qolib, sanoqni chalkashtirardi.
 */
async function marshrutXatosi(data, schoolId) {
  if (data.name !== undefined) {
    data.name = String(data.name).trim();
    if (!data.name) return 'Marshrut nomi majburiy';
  }
  if (data.days !== undefined && !ROUTE_DAYS.includes(data.days)) {
    return 'Kunlar notanish: ' + data.days;
  }
  if (data.direction !== undefined && !ROUTE_DIRECTIONS.includes(data.direction)) {
    return "Yo'nalish notanish: " + data.direction;
  }
  if (data.autoOrder !== undefined) data.autoOrder = Boolean(data.autoOrder);
  if (data.startTime !== undefined) {
    const vaqt = String(data.startTime || '').trim();
    if (vaqt && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(vaqt)) return 'Vaqt SS:DD ko‘rinishida bo‘lsin';
    data.startTime = vaqt || null;
  }
  for (const [key, model, nomi] of [['transportId', 'transport', 'Transport'], ['driverId', 'user', 'Haydovchi']]) {
    if (data[key] === undefined) continue;
    const id = optionalId(data[key]);
    if (id === undefined) return nomi + " noto'g'ri tanlandi";
    if (id !== null) {
      const bor = await prisma[model].findFirst({ where: { id, schoolId }, select: { id: true } });
      if (!bor) return nomi + ' shu filialda topilmadi';
    }
    data[key] = id;
  }
  if (data.studentIds !== undefined) {
    if (!Array.isArray(data.studentIds)) return "O'quvchilar ro'yxati noto'g'ri";
    const soralgan = [...new Set(data.studentIds.map(x => parseInt(x)).filter(Number.isInteger))];
    const bor = await prisma.student.findMany({
      where: { id: { in: soralgan }, schoolId },
      select: { id: true },
    });
    const borSet = new Set(bor.map(x => x.id));
    // Tartib saqlanadi: foydalanuvchi bekatlarni shu ketma-ketlikda qo'ygan.
    data.studentIds = soralgan.filter(id => borSet.has(id));
  }
  return null;
}

app.get('/api/routes', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const routes = await prisma.route.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: ROUTE_INCLUDE,
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });
    res.json(routes.map(marshrutJavobi));
  } catch (error) { next(error); }
});

app.post('/api/routes', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    const data = pickFields(req.body, ROUTE_FIELDS);
    if (!data.name) return res.status(400).json({ error: 'Marshrut nomi majburiy' });
    if (!data.days) data.days = 'HAR_KUNI';
    const xato = await marshrutXatosi(data, schoolId);
    if (xato) return res.status(400).json({ error: xato });

    // studentIds endi ustun emas — bekat jadvaliga yoziladi.
    const { studentIds, ...routeData } = data;
    const route = await prisma.route.create({ data: { ...routeData, schoolId } });
    if (studentIds && studentIds.length) await bekatlarniYozish(route.id, studentIds);
    // Tartibni tizim quradi (autoOrder yoqiq bo'lsa).
    if (route.autoOrder !== false) await marshrutniTartiblash(route.id);

    const toliq = await prisma.route.findUnique({ where: { id: route.id }, include: ROUTE_INCLUDE });
    res.json(marshrutJavobi(toliq));
  } catch (error) { next(error); }
});

app.put('/api/routes/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const mavjud = await prisma.route.findUnique({ where: { id } });
    if (!mavjud) return res.status(404).json({ error: 'Marshrut topilmadi' });
    if (!(await canAccessSchool(req.user, mavjud.schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    const data = pickFields(req.body, ROUTE_FIELDS);
    const xato = await marshrutXatosi(data, mavjud.schoolId);
    if (xato) return res.status(400).json({ error: xato });

    const { studentIds, ...routeData } = data;
    if (Object.keys(routeData).length) await prisma.route.update({ where: { id }, data: routeData });
    if (studentIds !== undefined) await bekatlarniYozish(id, studentIds);

    // Tartib: `autoOrder: false` bilan kelgan so'rov — admin qo'lda surgan,
    // tizim aralashmaydi. Aks holda (o'quvchi qo'shildi/olindi, yo'nalish
    // o'zgardi, markaz ko'chdi yoki "avtomatik" qayta yoqildi) tartib
    // qaytadan quriladi.
    const yangilangan = await prisma.route.findUnique({ where: { id }, select: { autoOrder: true, direction: true } });
    const qoldaSurildi = data.autoOrder === false;
    const tartibgaTegdi = studentIds !== undefined || data.direction !== undefined || data.autoOrder === true;
    if (!qoldaSurildi && yangilangan?.autoOrder && tartibgaTegdi) await marshrutniTartiblash(id);

    const toliq = await prisma.route.findUnique({ where: { id }, include: ROUTE_INCLUDE });
    res.json(marshrutJavobi(toliq));
  } catch (error) { next(error); }
});

app.delete('/api/routes/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const mavjud = await prisma.route.findUnique({ where: { id } });
    if (!mavjud) return res.status(404).json({ error: 'Marshrut topilmadi' });
    if (!(await canAccessSchool(req.user, mavjud.schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    await prisma.route.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * Bugungi to'lqinlar: qaysi vaqtda nechta bola uyga ketadi.
 *
 * Dars tugash vaqti guruh jadvalidan olinadi; jadvali to'ldirilmagan
 * guruhlar alohida qaytadi — admin ularni to'g'rilashi kerak.
 */
app.get('/api/logistics/waves', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : undefined;

    // Sahifa ochilishi — so'rash vaqti kelganini tekshirish uchun ham sabab.
    sorashniQozgatish();
    const { tolqinlar, jadvalsiz } = await kunlikTolqinlar({ schoolId, date });
    // Har to'lqin uchun haydovchi javoblari qisqacha.
    const javoblar = await prisma.driverAvailability.findMany({
      where: { schoolId, date: date || undefined },
      select: { endTime: true, status: true, date: true },
    });
    res.json({
      tolqinlar: tolqinlar.map(t => ({
        endTime: t.endTime,
        guruhlar: t.guruhlar,
        oquvchi: t.oquvchilar.length,
        kelmagan: t.kelmaganlar.length,
        // Ro'yxatning o'zi ham: kartochka ostidan ochilib ko'rsatiladi.
        // `nuqta` — joylashuvi bormi; bo'lmasa bola rejaga tusha olmaydi.
        oquvchilar: t.oquvchilar.map(o => ({
          id: o.id, name: o.name, address: o.address || null,
          phone: o.phone || null, guruh: o.guruh || null, nuqta: !!o.location,
        })),
        kelmaganlar: t.kelmaganlar,
        doimiylar: t.doimiylar,
        javoblar: {
          jami: javoblar.filter(j => j.endTime === t.endTime).length,
          ha: javoblar.filter(j => j.endTime === t.endTime && j.status === 'HA').length,
          yoq: javoblar.filter(j => j.endTime === t.endTime && j.status === 'YOQ').length,
        },
      })),
      jadvalsiz,
    });
  } catch (error) { next(error); }
});

/** Haydovchilardan shu to'lqin uchun so'rash (bot orqali). */
app.post('/api/logistics/ask-drivers', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    const endTime = String(req.body.endTime || '');
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) return res.status(400).json({ error: "Vaqt noto'g'ri" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || '')) ? String(req.body.date) : undefined;

    const { tolqinlar } = await kunlikTolqinlar({ schoolId, date });
    const tolqin = tolqinlar.find(t => t.endTime === endTime);
    const natija = await haydovchilardanSorash({
      schoolId, date: date || toDateStr(), endTime,
      oquvchiSoni: tolqin?.oquvchilar.length || 0,
    });
    res.json(natija);
  } catch (error) { next(error); }
});

/** Kunlik reja: tasdiqlagan haydovchilar bo'yicha taqsimot. */
app.post('/api/logistics/daily-plan', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });
    const endTime = String(req.body.endTime || '');
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) return res.status(400).json({ error: "Vaqt noto'g'ri" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || '')) ? String(req.body.date) : undefined;

    const natija = await kunlikRejaniTuzish({
      schoolId, date, endTime,
      rejim: req.body.rejim === 'arzon' ? 'arzon' : 'tez',
      apply: req.body.apply === true,
    });
    if (natija.xato) return res.status(400).json({ error: natija.xato });
    res.json(natija);
  } catch (error) { next(error); }
});

/**
 * Haydovchilardan so'rashni fon rejimida ishga tushiradi.
 *
 * Vercel bepul tarifida cron kuniga bir marta ishlaydi, "2 soat oldin" esa
 * kun davomida istalgan payt kelishi mumkin. Shuning uchun tekshiruv
 * CRM ochilganda ham yuriladi — ofisda kimdir doim ochiq turadi. Ortiqcha
 * yuk bo'lmasligi uchun 5 daqiqada bir martadan tez chaqirilmaydi.
 */
let sorashOxirgi = 0;
function sorashniQozgatish() {
  const hozir = Date.now();
  if (hozir - sorashOxirgi < 5 * 60 * 1000) return;
  sorashOxirgi = hozir;
  avtoJarayon({}).catch(e => console.error('[Logistika avto]', e.message));
}

/**
 * Vercel cron: yaqinlashib kelayotgan to'lqinlar uchun haydovchilardan
 * so'raydi. Bir necha marta chaqirilsa ham xavfsiz.
 */
app.get('/api/logistics/auto-process', async (req, res, next) => {
  try {
    const cronError = cronRequestRejected(req);
    if (cronError) return res.status(401).json({ error: cronError });
    const natija = await avtoJarayon({});
    res.json({ ok: true, natija });
  } catch (error) { next(error); }
});

// ========== REYSLAR ==========
//
// "Bugun" doskasi uchun: qaysi reys boshlangan, qachon tugagan, kim
// haydagan. Yetkazish yozuvlari alohida endpointda keladi.
app.get('/api/route-runs', authenticate, async (req, res, next) => {
  try {
    const { schoolId, date } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const where = { schoolId: parseInt(schoolId) };
    if (date) where.date = String(date);
    const runs = await prisma.routeRun.findMany({
      where,
      include: {
        driver: { select: DRIVER_SELECT },
        transport: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(runs);
  } catch (error) { next(error); }
});

/**
 * Logistika statistikasi: sana oralig'i bo'yicha tarix.
 *
 * Bir so'rovda hammasi keladi — o'quvchi bo'yicha jamlanma, haydovchi
 * bo'yicha reyslar va kun bo'yicha yig'indi. Oraliq berilmasa boshidan
 * hisoblanadi: markaz nechta reys qilgani va kim necha marta chiqmagani
 * ko'rinsin.
 */
app.get('/api/logistics/stats', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    const where = { schoolId };
    const { from, to } = req.query;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = String(from);
      if (to) where.date.lte = String(to);
    }

    const [logs, runs] = await Promise.all([
      prisma.deliveryLog.findMany({
        where,
        select: {
          id: true, date: true, status: true, studentId: true, markedAt: true,
          student: { select: { id: true, name: true } },
          run: { select: { routeId: true, route: { select: { name: true, direction: true } } } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      }),
      prisma.routeRun.findMany({
        where,
        select: {
          id: true, date: true, routeId: true, startedAt: true, finishedAt: true,
          driver: { select: { id: true, name: true } },
          route: { select: { name: true, direction: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      }),
    ]);

    // O'quvchi bo'yicha: necha marta qatnagan, necha marta chiqmagan.
    const oquvchilar = {};
    for (const l of logs) {
      const k = l.studentId;
      if (!oquvchilar[k]) oquvchilar[k] = { studentId: k, name: l.student?.name || '', olindi: 0, yetkazildi: 0, kelmadi: 0 };
      if (l.status === 'Olib ketildi') oquvchilar[k].olindi++;
      else if (l.status === 'Uyiga yetkazildi') oquvchilar[k].yetkazildi++;
      else if (l.status === 'Kelmadi') oquvchilar[k].kelmadi++;
    }

    // Haydovchi bo'yicha: reyslar soni va o'rtacha davomiylik (daqiqa).
    const haydovchilar = {};
    for (const r of runs) {
      const k = r.driver?.id || 0;
      if (!haydovchilar[k]) haydovchilar[k] = { driverId: k, name: r.driver?.name || 'Belgilanmagan', reys: 0, tugagan: 0, jamiDaqiqa: 0 };
      haydovchilar[k].reys++;
      if (r.startedAt && r.finishedAt) {
        haydovchilar[k].tugagan++;
        haydovchilar[k].jamiDaqiqa += Math.round((new Date(r.finishedAt) - new Date(r.startedAt)) / 60000);
      }
    }
    for (const h of Object.values(haydovchilar)) {
      h.ortachaDaqiqa = h.tugagan > 0 ? Math.round(h.jamiDaqiqa / h.tugagan) : null;
    }

    // Kun bo'yicha yig'indi — grafik yoki jadval uchun.
    const kunlar = {};
    for (const l of logs) {
      if (!kunlar[l.date]) kunlar[l.date] = { date: l.date, olindi: 0, yetkazildi: 0, kelmadi: 0, reys: 0 };
      if (l.status === 'Olib ketildi') kunlar[l.date].olindi++;
      else if (l.status === 'Uyiga yetkazildi') kunlar[l.date].yetkazildi++;
      else if (l.status === 'Kelmadi') kunlar[l.date].kelmadi++;
    }
    for (const r of runs) {
      if (!kunlar[r.date]) kunlar[r.date] = { date: r.date, olindi: 0, yetkazildi: 0, kelmadi: 0, reys: 0 };
      kunlar[r.date].reys++;
    }

    res.json({
      jami: {
        reys: runs.length,
        yozuv: logs.length,
        olindi: logs.filter(l => l.status === 'Olib ketildi').length,
        yetkazildi: logs.filter(l => l.status === 'Uyiga yetkazildi').length,
        kelmadi: logs.filter(l => l.status === 'Kelmadi').length,
        oquvchi: Object.keys(oquvchilar).length,
        birinchiKun: [...runs, ...logs].map(x => x.date).sort()[0] || null,
      },
      oquvchilar: Object.values(oquvchilar).sort((a, b) => b.kelmadi - a.kelmadi || b.olindi - a.olindi),
      haydovchilar: Object.values(haydovchilar).sort((a, b) => b.reys - a.reys),
      kunlar: Object.values(kunlar).sort((a, b) => b.date.localeCompare(a.date)),
      reyslar: runs.slice(0, 200),
    });
  } catch (error) { next(error); }
});

// ========== YETKAZISH YOZUVLARI ==========

// Reys va yozuv mantig'i services/logistics.js da: bot ham xuddi shu
// funksiyalarni chaqiradi.
app.get('/api/delivery-logs', authenticate, async (req, res, next) => {
  try {
    const { schoolId, date } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const where = { schoolId: parseInt(schoolId) };
    if (date) where.date = String(date);
    // Reysning marshruti kerak: bitta o'quvchining bir kunda ertalabki va
    // kechqurungi yozuvi bo'lishi mumkin, sahifa ularni ajrata olsin.
    const logs = await prisma.deliveryLog.findMany({
      where,
      include: { run: { select: { routeId: true } } },
    });
    res.json(logs);
  } catch (error) { next(error); }
});

app.post('/api/delivery-logs', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.body.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (!(await canAccessSchool(req.user, schoolId))) return res.status(403).json({ error: "Ruxsat yo'q" });

    const studentId = parseInt(req.body.studentId);
    const transportId = parseInt(req.body.transportId);
    const date = String(req.body.date || '').trim();
    const status = req.body.status;

    if (!Number.isInteger(studentId)) return res.status(400).json({ error: "O'quvchi tanlanmagan" });
    if (!Number.isInteger(transportId)) return res.status(400).json({ error: 'Transport tanlanmagan' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Sana noto'g'ri" });
    if (!DELIVERY_STATUSES.includes(status)) return res.status(400).json({ error: 'Holat notanish: ' + status });

    const [student, transport] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } }),
      prisma.transport.findFirst({ where: { id: transportId, schoolId }, select: { id: true } }),
    ]);
    if (!student) return res.status(404).json({ error: "O'quvchi shu filialda topilmadi" });
    if (!transport) return res.status(404).json({ error: 'Transport shu filialda topilmadi' });

    // Yozuv reysga bog'lanadi: ertalabki "Olib ketildi" endi kechqurungi
    // "Uyiga yetkazildi" ni bosib ketmaydi — ular ikki xil reysning yozuvi.
    // routeId yuborilmasa eski xatti-harakat saqlanadi (kuniga bitta yozuv).
    const routeId = parseInt(req.body.routeId);
    if (Number.isInteger(routeId)) {
      const route = await prisma.route.findFirst({
        where: { id: routeId, schoolId },
        select: { id: true, transportId: true, driverId: true, direction: true },
      });
      if (!route) return res.status(404).json({ error: 'Marshrut shu filialda topilmadi' });
      const log = await holatniYozish({
        route, studentId, status, date, schoolId,
        markedById: req.user?.id || null,
        transportId,
      });
      return res.json(log);
    }

    const existing = await prisma.deliveryLog.findFirst({ where: { studentId, date, schoolId, runId: null } });
    const yozuv = { status, transportId: transportId || null, markedById: req.user?.id || null, markedAt: new Date() };
    if (existing) {
      const updated = await prisma.deliveryLog.update({ where: { id: existing.id }, data: yozuv });
      return res.json(updated);
    }
    const log = await prisma.deliveryLog.create({ data: { ...yozuv, studentId, date, schoolId } });
    res.json(log);
  } catch (error) { next(error); }
});

// --- Utility Routes ---
app.post('/api/utils/remove-bg', authenticate, async (req, res, next) => {
  try {
    const { image } = req.body; // Base64 image
    if (!image) {
      console.warn('Remove BG: No image provided');
      return res.status(400).json({ error: 'Rasm yuborilmadi' });
    }

    console.log(`[Remove BG] Processing image of size ${image.length} chars...`);

    // --- METHOD 1: Free Keyless Hugging Face BRIA RMBG-1.4 Gradio Queue API ---
    try {
      console.log('[Remove BG] Attempting free keyless HuggingFace BRIA RMBG-1.4 Space...');
      
      // Parse base64 string into a buffer
      const base64Data = image.replace(/^data:image\/[\w+]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 1. Upload to HuggingFace Space /upload
      const blob = new Blob([buffer], { type: 'image/png' });
      const form = new FormData();
      form.append('files', blob, 'input.png');

      const uploadResponse = await fetch('https://briaai-bria-rmbg-1-4.hf.space/upload', {
        method: 'POST',
        body: form
      });

      if (!uploadResponse.ok) {
        throw new Error(`HF Space upload returned status ${uploadResponse.status}`);
      }

      const uploadJson = await uploadResponse.json();
      const tempFilePath = uploadJson[0];
      if (!tempFilePath) {
        throw new Error('HF Space upload returned empty path');
      }

      console.log(`[Remove BG] Uploaded to HF successfully. Temp path: ${tempFilePath}`);

      // 2. Join queue
      const sessionHash = Math.random().toString(36).substring(2);
      const joinResponse = await fetch('https://briaai-bria-rmbg-1-4.hf.space/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            {
              path: tempFilePath,
              orig_name: "input.png"
            }
          ],
          fn_index: 0,
          session_hash: sessionHash
        })
      });

      if (joinResponse.ok) {
        const joinJson = await joinResponse.json();
        const eventId = joinJson.event_id;

        if (eventId) {
          console.log(`[Remove BG] Joined queue, event: ${eventId}. Waiting for results via SSE...`);
          
          // Fetch the stream
          const streamResponse = await fetch(`https://briaai-bria-rmbg-1-4.hf.space/queue/data?session_hash=${sessionHash}`);
          if (streamResponse.ok) {
            const reader = streamResponse.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let textBuffer = '';
            
            // Timeout after 15 seconds to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('HuggingFace queue timeout')), 15000)
            );

            const streamPromise = (async () => {
              while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                  const chunk = decoder.decode(value, { stream: !done });
                  textBuffer += chunk;
                  if (chunk.includes('process_completed')) {
                    break;
                  }
                }
              }
            })();

            await Promise.race([streamPromise, timeoutPromise]);

            // Parse response buffer
            const lines = textBuffer.split('\n');
            let successResult = null;

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.substring(6));
                  if (parsed.msg === 'process_completed' && parsed.success && parsed.output) {
                    successResult = parsed.output;
                    break;
                  }
                } catch (e) {}
              }
            }

            if (successResult && successResult.data && successResult.data[0]) {
              const outputItem = successResult.data[0];
              let resultBase64 = null;

              if (typeof outputItem === 'string' && outputItem.startsWith('data:')) {
                resultBase64 = outputItem;
              } else if (outputItem.data && typeof outputItem.data === 'string' && outputItem.data.startsWith('data:')) {
                resultBase64 = outputItem.data;
              } else {
                const filePath = outputItem.path || outputItem.name;
                if (filePath) {
                  const fileUrl = `https://briaai-bria-rmbg-1-4.hf.space/file=${filePath}`;
                  console.log(`[Remove BG] Downloading processed image from ${fileUrl}...`);
                  const fileRes = await fetch(fileUrl);
                  if (fileRes.ok) {
                    const arrayBuffer = await fileRes.arrayBuffer();
                    const contentType = fileRes.headers.get('content-type') || 'image/png';
                    const base64Str = Buffer.from(arrayBuffer).toString('base64');
                    resultBase64 = `data:${contentType};base64,${base64Str}`;
                  }
                }
              }

              if (resultBase64) {
                console.log('[Remove BG] Successfully processed background removal via free HuggingFace Space!');
                return res.json({
                  success: true,
                  image: resultBase64,
                  message: 'Background removed successfully (HuggingFace free)'
                });
              }
            }
          }
        }
      }
      console.warn('[Remove BG] Free HuggingFace Space failed or returned unsuccessful status. Falling back to fal.ai...');
    } catch (hfError) {
      console.error('[Remove BG] HuggingFace processing error:', hfError);
    }

    // --- METHOD 2: Fallback to fal.ai (requires positive account balance) ---
    console.log('[Remove BG] Attempting fallback to fal.ai...');
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      console.error('Remove BG: FAL_KEY missing in process.env');
      return res.status(500).json({ error: 'FAL_KEY sozlanmagan va tekin xizmat ishlamadi' });
    }

    const response = await fetch('https://fal.run/fal-ai/bria/background-removal', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: image
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`fal.ai API error (${response.status}):`, errorText);
      return res.status(response.status).json({ success: false, error: `AI xizmati xatosi: ${response.status}`, details: errorText });
    }

    const data = await response.json();
    const resultUrl = data.image?.url || data.image_url;

    if (!resultUrl) {
      console.error('fal.ai response missing image URL:', data);
      return res.status(500).json({ success: false, error: 'AI natijani qaytarmadi' });
    }

    // Fetch fal.ai image and convert to base64 so it is stored directly as base64 in the database
    console.log(`[Remove BG] Fetching result from fal.ai URL: ${resultUrl}...`);
    const falImageRes = await fetch(resultUrl);
    if (falImageRes.ok) {
      const arrayBuffer = await falImageRes.arrayBuffer();
      const contentType = falImageRes.headers.get('content-type') || 'image/png';
      const base64Str = Buffer.from(arrayBuffer).toString('base64');
      const base64Result = `data:${contentType};base64,${base64Str}`;
      
      console.log('Background removed successfully via fal.ai and converted to base64');
      return res.json({ 
        success: true, 
        image: base64Result, 
        message: 'Background removed successfully (fal.ai)' 
      });
    }

    // If conversion failed, return the URL as is
    res.json({ 
      success: true, 
      image: resultUrl, 
      message: 'Background removed successfully (fal.ai URL)' 
    });
  } catch (error) { 
    console.error('Background removal critical error:', error);
    res.status(500).json({ success: false, error: error.message || 'Serverda ichki xatolik' });
  }
});

// ==================== ESKIZ SMS INTEGRATION ====================

const eskizTokensCache = new Map(); // email -> { token, expiry }

async function getEskizToken(schoolId) {
  let email = process.env.ESKIZ_EMAIL;
  let password = process.env.ESKIZ_PASSWORD;

  if (schoolId) {
    const settings = await prisma.setting.findUnique({ where: { schoolId } });
    if (settings && settings.eskizEmail && settings.eskizPassword) {
      email = settings.eskizEmail.trim();
      // Reads plaintext rows written before encryption existed, and encrypted ones after.
      password = decryptSecret(settings.eskizPassword).trim();
    }
  }

  if (!email || !password) throw new Error('Eskiz SMS sozlamalari (email/password) kiritilmagan');

  const cached = eskizTokensCache.get(email);
  if (cached) {
    if (cached.error && Date.now() < cached.errorExpiry) {
      throw new Error('Eskiz SMS token request recently failed: ' + cached.error);
    }
    if (cached.token && Date.now() < cached.expiry) {
      return cached.token;
    }
  }

  console.log(`[Eskiz] Token olishga urinish: ${email}`);

  let lastError = null;
  const endpoints = [
    'https://notify.eskiz.uz/api/auth/login',
    'https://portal.eskiz.uz/api/auth/login'
  ];

  for (const url of endpoints) {
    try {
      console.log(`[Eskiz] Endpointga urinish: ${url}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', password);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      const data = await res.json();
      if (data.data?.token) {
        const token = data.data.token;
        const expiry = Date.now() + 23 * 60 * 60 * 1000;
        eskizTokensCache.set(email, { token, expiry });
        console.log(`[Eskiz] Token muvaffaqiyatli olindi (Source: ${url})`);
        return token;
      }
      console.warn(`[Eskiz] ${url} muvaffaqiyatsiz:`, JSON.stringify(data));
      lastError = data.message || JSON.stringify(data);
    } catch (err) {
      console.error(`[Eskiz] ${url} xatosi: ${err.name === 'AbortError' ? 'Timeout' : err.message}`);
      lastError = err.name === 'AbortError' ? 'Ulanishda kutish vaqti tugadi (Timeout)' : err.message;
    }
  }

  // Cache the error for 60 seconds to avoid repeating timeouts during batch sending
  eskizTokensCache.set(email, { error: lastError, errorExpiry: Date.now() + 60000 });
  throw new Error('Eskiz token olish barcha endpointlarda muvaffaqiyatsiz tugadi: ' + lastError);
}

// Ota-ona raqamini aniqlash yordamchisi
function resolveRecipientPhone(student) {
  return student.fatherPhone || student.motherPhone || student.phone;
}

// Bitta raqamga SMS yuborish
// Transport xabarlari SMS ga tushishi uchun: servis server.js ga bog'liq
// bo'lib qolmasin deb, aksincha, server o'zini ro'yxatdan o'tkazadi.
smsYuboruvchiniUlash((phone, message, type, studentId, schoolId) =>
  sendSms(phone, message, type, studentId, schoolId));

async function sendSms(phone, message, type, studentId, schoolId, campaignId = null) {
  let from = process.env.ESKIZ_FROM || '4546';
  
  if (schoolId) {
    const settings = await prisma.setting.findUnique({ where: { schoolId } });
    if (settings && settings.eskizFrom) {
      from = settings.eskizFrom.trim();
    }
  }

  try {
    const token = await getEskizToken(schoolId);
    const cleanPhone = phone.replace(/\D/g, ''); // Faqat raqamlar

    const params = new URLSearchParams();
    params.append('mobile_phone', cleanPhone);
    params.append('message', message);
    params.append('from', from);
    params.append('callback_url', '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    const success = data.status === 'wait' || data.status === 'success' || res.ok;

    await prisma.smsLog.create({
      data: {
        toPhone: phone,
        message,
        status: success ? 'SENT' : 'FAILED',
        type,
        studentId: studentId || null,
        eskizId: data.id ? String(data.id) : null,
        errorMsg: success ? null : JSON.stringify(data),
        channel: 'SMS',
        campaignId: campaignId || null,
        schoolId
      }
    });
    return { success, data };
  } catch (err) {
    console.error('[Eskiz] SMS yuborishda xato:', err.message);
    try {
      await prisma.smsLog.create({
        data: {
          toPhone: phone, message, status: 'FAILED', type,
          studentId: studentId || null, errorMsg: err.message,
          channel: 'SMS', campaignId: campaignId || null, schoolId
        }
      });
    } catch (_) {}
    return { success: false, error: err.message };
  }
}

// API: Bitta SMS yuborish (qo'lda)
app.post('/api/sms/send', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    let { phone, message, type, studentId } = req.body;
    if (!message) return res.status(400).json({ error: 'Xabar matni kerak' });
    
    let student = null;
    if (studentId) {
      student = await prisma.student.findUnique({ where: { id: Number(studentId) } });
    }

    if (phone === 'AUTO_RESOLVE' && student) {
      phone = resolveRecipientPhone(student);
    }

    if (!phone || phone === 'AUTO_RESOLVE') return res.status(400).json({ error: 'Telefon raqamini aniqlab bo\'lmadi' });
    
    let telegramSent = false;
    if (student && student.telegramId) {
      try {
        const schoolBot = await getTelegramBot(student.schoolId || req.user.schoolId);
        if (schoolBot) {
          await schoolBot.telegram.sendMessage(student.telegramId, message);
          telegramSent = true;
        }
      } catch (tgErr) {
        console.error('[Telegram Manual Send] Error sending to student:', tgErr.message);
      }
    }

    const result = await sendSms(phone, message, type || 'MANUAL', studentId ? Number(studentId) : null, req.user.schoolId);
    res.json({ ...result, telegramSent });
  } catch (err) { next(err); }
});

// API: Davomatga kelmagan o'quvchilarga SMS yuborish
app.post('/api/sms/attendance', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { date, groupId } = req.body;
    if (!date || !groupId) return res.status(400).json({ error: 'date va groupId kerak' });

    // Kelmagan o'quvchilarni toping (Student classroom attendance status is 'Kelmapdi')
    const absences = await prisma.attendance.findMany({
      where: {
        groupId: Number(groupId),
        date,
        status: 'Kelmapdi',
        schoolId: req.user.schoolId
      },
      include: { student: true, group: true }
    });

    if (absences.length === 0) return res.json({ success: true, count: 0, sent: 0, message: 'Kelmaganlar topilmadi' });

    const results = [];
    for (const absence of absences) {
      const student = absence.student;
      const phone = resolveRecipientPhone(student);
      if (!phone) { results.push({ name: student.name, status: 'raqam yo\'q' }); continue; }

      const msg = `Sariosiyo o'quv markazi: farzandingiz ${student.name} bugun ${date} kuni darsga kelmadi.`;
      const r = await sendSms(phone, msg, 'ATTENDANCE', student.id, req.user.schoolId);
      results.push({ name: student.name, phone, ...r });
    }
    const sentCount = results.filter(r => r.success).length;
    res.json({ success: true, count: sentCount, sent: sentCount, total: results.length, results });
  } catch (err) { next(err); }
});

// API: SMS loglari
app.get('/api/sms/logs', authenticate, async (req, res, next) => {
  try {
    const logs = await prisma.smsLog.findMany({
      where: { schoolId: req.user.schoolId },
      orderBy: { sentAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (err) { next(err); }
});

app.get('/api/sms/check-status/:id', authenticate, async (req, res, next) => {
  try {
    const logId = parseInt(req.params.id);
    const log = await prisma.smsLog.findUnique({ where: { id: logId } });
    
    if (!log || !log.eskizId) {
      return res.status(404).json({ error: 'Log topilmadi yoki Eskiz ID mavjud emas' });
    }

    const token = await getEskizToken();
    const statusRes = await fetch(`https://notify.eskiz.uz/api/message/sms/get-status/${log.eskizId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const statusData = await statusRes.json();
    const eskizStatus = statusData.data?.status || statusData.status; // Eskiz status key structure
    
    let newStatus = log.status;
    if (['DELIVRD', 'TRANSMTD', 'SENT'].includes(eskizStatus)) {
        newStatus = 'SENT';
    } else if (['REJECTD', 'EXPIRED', 'FAILED', 'error'].includes(eskizStatus)) {
        newStatus = 'FAILED';
    }

    const updatedLog = await prisma.smsLog.update({
      where: { id: logId },
      data: { 
        status: newStatus,
        errorMsg: JSON.stringify(statusData)
      }
    });

    res.json(updatedLog);
  } catch (err) { next(err); }
});

// API: Eskiz token tekshirish (test)
app.get('/api/sms/test-connection', authenticate, async (req, res, next) => {
  try {
    // The token itself never leaves the server — the caller only needs to know the login worked.
    await getEskizToken();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'Eskiz API muvaffaqiyatli bog\'landi' });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== END ESKIZ SMS ====================

// ==================== MESSAGING MODULE ====================

// Shablon o'zgaruvchilarini to'ldirish: {ism} {qarz} {balans} {guruh} {markaz}
function fillTemplate(body, student, groupsForStudent, school) {
  const balance = Number(student.balance || 0);
  const debt = balance < 0 ? Math.abs(balance) : 0;
  const groupNames = (groupsForStudent || []).map(g => g.name).join(', ');

  // Custom trigger properties
  const examName = student.customExamName || '';
  const examScore = student.customExamScore !== undefined ? String(student.customExamScore) : '';
  const examPercentage = student.customExamPercentage !== undefined ? `${student.customExamPercentage}%` : '';
  const paymentAmount = student.customPaymentAmount !== undefined ? student.customPaymentAmount.toLocaleString() : '';
  const dailyScore = student.customDailyScore !== undefined ? String(student.customDailyScore) : '';

  return String(body || '')
    .replace(/\{ism\}/gi, student.name || '')
    .replace(/@name/gi, student.name || '')
    .replace(/\{qarz\}/gi, debt.toLocaleString())
    .replace(/\{balans\}/gi, balance.toLocaleString())
    .replace(/\{guruh\}/gi, groupNames)
    .replace(/\{markaz\}/gi, school?.name || '')
    .replace(/\{imtihon_nomi\}/gi, examName)
    .replace(/\{imtihon_ball\}/gi, examScore)
    .replace(/\{imtihon_foiz\}/gi, examPercentage)
    .replace(/\{to_lov_summa\}/gi, paymentAmount)
    .replace(/\{bahosi\}/gi, dailyScore);
}

// Bitta o'quvchiga tanlangan kanal(lar) orqali yuborish
// Reject a promise if it doesn't settle within `ms` — keeps batches fast
function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}

// Xabar kimga ketishi. Bitta qoidada bir nechta qabul qiluvchi bo'lishi mumkin,
// shuning uchun bazada vergul bilan saqlanadi: "FATHER,MOTHER". Eski yozuvlarda
// bitta qiymat turadi va "PARENT" — ota va ona degani, shu yerda ochiladi.
const RECIPIENT_KINDS = ['STUDENT', 'FATHER', 'MOTHER'];

function parseRecipients(value) {
  const list = String(value || '')
    .split(',')
    .map(v => v.trim().toUpperCase())
    .flatMap(v => (v === 'PARENT' ? ['FATHER', 'MOTHER'] : [v]))
    .filter(v => RECIPIENT_KINDS.includes(v));
  return list.length ? [...new Set(list)] : ['FATHER', 'MOTHER'];
}

/** Bazaga yozish uchun bir xil ko'rinishga keltirish. */
const normalizeRecipients = (value) => parseRecipients(value).join(',');

async function sendToOne({ student, message, channel, recipientTo, type, schoolId, campaignId }) {
  let anySuccess = false;
  let attempted = false;
  const kinds = parseRecipients(recipientTo);

  // Telegram
  if (channel === 'TELEGRAM' || channel === 'BOTH') {
    const tids = [];
    const qoshTid = (id, name) => {
      if (id && !tids.some(t => String(t.id) === String(id))) tids.push({ id, name });
    };
    if (kinds.includes('STUDENT')) qoshTid(student.telegramId, student.name);
    if (kinds.includes('FATHER')) qoshTid(student.fatherTelegramId, `${student.name} (Otasi)`);
    if (kinds.includes('MOTHER')) qoshTid(student.motherTelegramId, `${student.name} (Onasi)`);

    const schoolBot = tids.length > 0 ? await getTelegramBot(schoolId) : null;
    for (const target of tids) {
      attempted = true;
      try {
        if (schoolBot) {
          await withTimeout(schoolBot.telegram.sendMessage(target.id, message), 4000, 'Telegram timeout');
          anySuccess = true;
          await prisma.smsLog.create({
            data: {
              toPhone: String(target.id), toName: target.name, message,
              status: 'SENT', type, studentId: student.id,
              channel: 'TELEGRAM', campaignId: campaignId || null, schoolId
            }
          });
        }
      } catch (tgErr) {
        await prisma.smsLog.create({
          data: {
            toPhone: String(target.id), toName: target.name, message,
            status: 'FAILED', type, studentId: student.id, errorMsg: tgErr.message,
            channel: 'TELEGRAM', campaignId: campaignId || null, schoolId
          }
        }).catch(() => {});
      }
    }
  }

  // SMS
  if (channel === 'SMS' || (channel === 'BOTH' && !anySuccess)) {
    const phones = [];
    const qoshRaqam = (raqam) => { if (raqam && !phones.includes(raqam)) phones.push(raqam); };
    if (kinds.includes('STUDENT')) qoshRaqam(student.phone);
    if (kinds.includes('FATHER')) qoshRaqam(student.fatherPhone);
    if (kinds.includes('MOTHER')) qoshRaqam(student.motherPhone);
    // Tanlanganlarning birortasida ham raqam bo'lmasa — o'quvchining o'z
    // raqamiga ketsin, xabar yo'qolib qolmasin.
    if (!phones.length) qoshRaqam(student.phone);

    for (const phone of phones) {
      attempted = true;
      const r = await sendSms(phone, message, type || 'MANUAL', student.id, schoolId, campaignId);
      if (r.success) anySuccess = true;
    }
  }

  return { attempted, success: anySuccess };
}

// O'quvchining guruhlarini (StudentGroups relation) olish uchun yordamchi
async function getStudentGroupsMap(schoolId) {
  const groups = await prisma.group.findMany({
    where: { schoolId },
    include: { students: { select: { id: true } } }
  });
  const map = {}; // studentId -> [{id,name}]
  for (const g of groups) {
    for (const s of g.students) {
      if (!map[s.id]) map[s.id] = [];
      map[s.id].push({ id: g.id, name: g.name });
    }
  }
  return map;
}

// Ommaviy yuborish
app.post('/api/messaging/send-batch', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { studentIds, sendList, audience, message, channel, recipientTo, filters } = req.body;
    const schoolId = req.user.schoolId;
    if (!Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ error: 'studentIds kerak' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Xabar matni kerak' });
    const ch = ['SMS', 'TELEGRAM', 'BOTH'].includes(channel) ? channel : 'SMS';
    const to = ['STUDENT', 'FATHER', 'MOTHER', 'PARENT'].includes(recipientTo) ? recipientTo : 'PARENT';

    const totalCount = (audience === 'STUDENTS' && Array.isArray(sendList) && sendList.length > 0)
      ? sendList.length
      : studentIds.length;

    // Load all data before responding so background only does sending
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    let recipients = [];
    let groupsMap = {};
    let studentsMap = {};

    if (audience === 'TEACHERS') {
      const teachers = await prisma.teacher.findMany({ where: { id: { in: studentIds.map(Number) }, schoolId } });
      recipients = teachers.map(t => ({ id: t.id, name: t.name, phone: t.phone, telegramId: t.telegramId }));
    } else if (audience === 'STAFF') {
      const users = await prisma.user.findMany({ where: { id: { in: studentIds.map(Number) }, schoolId } });
      recipients = users.map(u => ({ id: u.id, name: u.name, phone: u.phone, telegramId: u.telegramId }));
    } else if (audience === 'STUDENTS' && Array.isArray(sendList) && sendList.length > 0) {
      const studentIdsFromList = sendList.map(e => Number(e.studentId));
      const [students, gMap] = await Promise.all([
        prisma.student.findMany({ where: { id: { in: studentIdsFromList }, schoolId } }),
        getStudentGroupsMap(schoolId)
      ]);
      for (const s of students) studentsMap[s.id] = s;
      groupsMap = gMap;
    }

    const campaign = await prisma.messageCampaign.create({
      data: { message, channel: ch, recipientTo: to, filtersJson: filters || null, totalCount, schoolId }
    });

    // Build a flat list of send tasks
    const tasks = [];
    if (audience === 'STUDENTS' && Array.isArray(sendList) && sendList.length > 0) {
      for (const entry of sendList) {
        const student = studentsMap[Number(entry.studentId)];
        if (!student) continue;
        tasks.push({ student, recipientTo: entry.recipientTo, groups: groupsMap[student.id] || [] });
      }
    } else {
      const targetTo = (audience === 'TEACHERS' || audience === 'STAFF') ? 'STUDENT' : to;
      for (const recipient of recipients) {
        tasks.push({ student: recipient, recipientTo: targetTo, groups: groupsMap[recipient.id] || [] });
      }
    }

    // Send SYNCHRONOUSLY with high concurrency — on Vercel serverless,
    // anything after res.json() is frozen, so we must finish sending first.
    // 25-wide concurrency keeps even ~100 recipients well under 5s.
    let sentCount = 0, failedCount = 0;
    const concurrencyLimit = 25;
    for (let i = 0; i < tasks.length; i += concurrencyLimit) {
      const chunk = tasks.slice(i, i + concurrencyLimit);
      await Promise.all(chunk.map(async (task) => {
        const personalized = fillTemplate(message, task.student, task.groups, school);
        const r = await sendToOne({
          student: task.student,
          message: personalized,
          channel: ch,
          recipientTo: task.recipientTo,
          type: 'MANUAL',
          schoolId,
          campaignId: campaign.id
        });
        if (r.success) sentCount++; else failedCount++;
      }));
    }

    await prisma.messageCampaign.update({
      where: { id: campaign.id },
      data: { sentCount, failedCount }
    }).catch(err => console.error('Failed to update campaign counts:', err));

    res.json({ success: true, campaign, sentCount, failedCount, total: totalCount });
  } catch (err) { next(err); }
});

// --- Eskiz shablon moderatsiyasi -------------------------------------------
//
// Eskiz tasdiqlanmagan matnli SMS ni yubormaydi. Ilgari shablon faqat CRM
// bazasiga yozilar, moderatsiyaga esa qo'lda, Eskiz kabinetidan yuborish
// kerak edi — buni unutish oson va SMS "sababsiz" yetib bormasdi.

// Raqamga aylanadigan o'zgaruvchilar: Eskizda ular %d bilan belgilanadi.
const ESKIZ_RAQAMLI = ['qarz', 'balans', 'to_lov_summa', 'imtihon_ball', 'imtihon_foiz', 'bahosi'];

/**
 * CRM shablonini Eskiz andozasiga aylantiradi.
 * {ism} kabi o'rinbosarlar Eskizda %w (so'z) yoki %d (son) bo'ladi.
 */
function eskizMatniga(body) {
  return String(body || '').replace(/\{([a-zA-Z_]+)\}/g, (_, nom) =>
    ESKIZ_RAQAMLI.includes(String(nom).toLowerCase()) ? '%d' : '%w{1,5}'
  ).trim();
}

/**
 * Shablonni Eskizga moderatsiyaga yuboradi.
 * Xatolik butun amalni to'xtatmaydi: shablon CRM da baribir saqlanadi,
 * holati esa yozuvda ko'rinib turadi.
 */
async function eskizShablonYubor(body, schoolId) {
  const matn = eskizMatniga(body);
  if (matn.length < 10) {
    return { status: "Eskiz uchun juda qisqa (kamida 10 belgi)", id: null };
  }
  try {
    const token = await getEskizToken(schoolId);
    const params = new URLSearchParams();
    params.append('template', matn);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('https://notify.eskiz.uz/api/user/template', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.status === 'fail') {
      const xato = data?.data?.errors
        ? Object.values(data.data.errors).flat().join(', ')
        : (data?.message || 'Eskiz rad etdi');
      console.warn('[Eskiz shablon]', xato);
      return { status: 'xato: ' + xato, id: null };
    }
    const id = data?.data?.id ?? data?.id ?? null;
    return { status: data?.data?.status || 'moderation', id: id ? String(id) : null };
  } catch (err) {
    console.error('[Eskiz shablon]', err.message);
    return { status: 'xato: ' + err.message, id: null };
  }
}

// Shablonlar CRUD
app.get('/api/messaging/templates', authenticate, async (req, res, next) => {
  try {
    let templates = await prisma.messageTemplate.findMany({
      where: { schoolId: req.user.schoolId }, orderBy: { createdAt: 'desc' }
    });

    // Moderatsiyada turgan shablonlarning holati Eskiz tomonida o'zgaradi,
    // shuning uchun ro'yxat ochilganda yangilab olamiz. Eskizga murojaat
    // qilib bo'lmasa ro'yxat baribir ko'rsatiladi.
    const kutilayotgan = templates.filter(t => t.eskizTemplateId && t.eskizStatus !== 'confirmed');
    if (kutilayotgan.length > 0) {
      try {
        const token = await getEskizToken(req.user.schoolId);
        const r = await fetch('https://notify.eskiz.uz/api/user/templates', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const d = await r.json().catch(() => ({}));
        const holatlar = new Map((d?.result || []).map(x => [String(x.id), x.status]));
        const yangilangan = [];
        for (const t of kutilayotgan) {
          const holat = holatlar.get(String(t.eskizTemplateId));
          if (holat && holat !== t.eskizStatus) yangilangan.push({ id: t.id, holat });
        }
        if (yangilangan.length > 0) {
          await Promise.all(yangilangan.map(y =>
            prisma.messageTemplate.update({ where: { id: y.id }, data: { eskizStatus: y.holat } })
          ));
          templates = await prisma.messageTemplate.findMany({
            where: { schoolId: req.user.schoolId }, orderBy: { createdAt: 'desc' }
          });
        }
      } catch (e) {
        console.warn('[Eskiz shablon holati]', e.message);
      }
    }

    res.json(templates);
  } catch (err) { next(err); }
});

app.post('/api/messaging/templates', authenticate, async (req, res, next) => {
  try {
    const { name, body, category, isAuto, autoType, autoChannel, autoRecipient, autoConfig, autoTime } = req.body;
    if (!name || !body) return res.status(400).json({ error: 'name va body kerak' });

    // Shablon yaratilishi bilan Eskizga moderatsiyaga ketadi.
    const eskiz = await eskizShablonYubor(body, req.user.schoolId);

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        body,
        category: category || 'Umumiy',
        isAuto: !!isAuto,
        autoType: autoType || null,
        autoChannel: autoChannel || 'BOTH',
        autoRecipient: autoRecipient || 'PARENT',
        autoConfig: autoConfig || null,
        autoTime: autoTime || '09:00',
        eskizStatus: eskiz.status,
        eskizTemplateId: eskiz.id,
        schoolId: req.user.schoolId
      }
    });
    res.status(201).json(template);
  } catch (err) { next(err); }
});

app.put('/api/messaging/templates/:id', authenticate, async (req, res, next) => {
  try {
    const { name, body, category, isAuto, autoType, autoChannel, autoRecipient, autoConfig, autoTime } = req.body;
    const data = {
      ...(name !== undefined && { name }),
      ...(body !== undefined && { body }),
      ...(category !== undefined && { category }),
      ...(isAuto !== undefined && { isAuto: !!isAuto }),
      ...(autoType !== undefined && { autoType }),
      ...(autoChannel !== undefined && { autoChannel }),
      ...(autoRecipient !== undefined && { autoRecipient }),
      ...(autoConfig !== undefined && { autoConfig }),
      ...(autoTime !== undefined && { autoTime })
    };

    // Matn o'zgargan bo'lsa eski moderatsiya kuchini yo'qotadi — qaytadan
    // yuboriladi. Faqat nomi tahrirlansa Eskizga tegilmaydi.
    if (body !== undefined) {
      const oldingi = await prisma.messageTemplate.findUnique({
        where: { id: parseInt(req.params.id) },
        select: { body: true },
      });
      if (oldingi && oldingi.body !== body) {
        const eskiz = await eskizShablonYubor(body, req.user.schoolId);
        data.eskizStatus = eskiz.status;
        data.eskizTemplateId = eskiz.id;
      }
    }

    const template = await prisma.messageTemplate.update({
      where: { id: parseInt(req.params.id) },
      data
    });
    res.json(template);
  } catch (err) { next(err); }
});

app.delete('/api/messaging/templates/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    await prisma.messageTemplate.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Kampaniyalar tarixi
app.get('/api/messaging/campaigns', authenticate, async (req, res, next) => {
  try {
    const campaigns = await prisma.messageCampaign.findMany({
      where: { schoolId: req.user.schoolId }, orderBy: { createdAt: 'desc' }, take: 100
    });
    res.json(campaigns);
  } catch (err) { next(err); }
});

// Avtomatik qoidalar CRUD
app.get('/api/messaging/auto-rules', authenticate, async (req, res, next) => {
  try {
    const rules = await prisma.autoMessageRule.findMany({
      where: { schoolId: req.user.schoolId },
      orderBy: { id: 'desc' }
    });
    res.json(rules);
  } catch (err) { next(err); }
});

app.post('/api/messaging/auto-rules', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { name, type, enabled, body, channel, recipientTo, config, time } = req.body;
    if (!name || !type || !body) return res.status(400).json({ error: 'name, type, va body kerak' });
    const rule = await prisma.autoMessageRule.create({
      data: {
        name,
        type,
        enabled: !!enabled,
        body,
        channel: channel || 'BOTH',
        recipientTo: normalizeRecipients(recipientTo),
        config: config || null,
        time: time || '09:00',
        schoolId: req.user.schoolId
      }
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

app.put('/api/messaging/auto-rules/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { name, type, enabled, body, channel, recipientTo, config, time } = req.body;
    const ruleId = parseInt(req.params.id);
    const data = {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(enabled !== undefined && { enabled: !!enabled }),
      ...(body !== undefined && { body }),
      ...(channel !== undefined && { channel }),
      ...(recipientTo !== undefined && { recipientTo: normalizeRecipients(recipientTo) }),
      ...(config !== undefined && { config }),
      ...(time !== undefined && { time })
    };
    const rule = await prisma.autoMessageRule.update({
      where: { id: ruleId },
      data
    });
    res.json(rule);
  } catch (err) { next(err); }
});

app.delete('/api/messaging/auto-rules/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    await prisma.autoMessageRule.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

async function runAutoProcessJobs() {
  const nowUtc = new Date();
  // Uzbekistan offset is UTC+5
  const nowUz = new Date(nowUtc.getTime() + (5 * 60 * 60 * 1000));
  const currentHour = nowUz.getUTCHours();
  const todayStr = `${nowUz.getUTCFullYear()}-${String(nowUz.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUz.getUTCDate()).padStart(2, '0')}`;
  const mmdd = `${String(nowUz.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUz.getUTCDate()).padStart(2, '0')}`;
  const dayOfMonth = nowUz.getUTCDate();

  const rules = await prisma.autoMessageRule.findMany({ where: { enabled: true } });
  const results = [];

  for (const rule of rules) {
    if (rule.lastRunDate === todayStr) {
      results.push({ ruleId: rule.id, name: rule.name, skipped: 'already-run' });
      continue;
    }

    // Check if the current Uzbekistan time has passed the scheduled rule time today
    const [schedH, schedM] = (rule.time || "09:00").split(':').map(Number);
    const currentMin = nowUz.getUTCMinutes();
    const hasPassedScheduledTime = (currentHour > schedH) || (currentHour === schedH && currentMin >= schedM);

    if (!hasPassedScheduledTime) {
      results.push({ ruleId: rule.id, name: rule.name, skipped: 'not-due-yet', currentHour, scheduledHour: schedH });
      continue;
    }

    const schoolId = rule.schoolId;
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const groupsMap = await getStudentGroupsMap(schoolId);

    let targets = [];
    if (rule.type === 'BIRTHDAY') {
      const students = await prisma.student.findMany({ where: { schoolId, status: { in: ['Faol', 'Sinov'] } } });
      targets = students.filter(s => (s.birthDate || '').slice(5, 10) === mmdd);
    } else if (rule.type === 'DEBT_REMINDER') {
      const cfg = (rule.config && typeof rule.config === 'object') ? rule.config : {};
      const ruleDay = Number(cfg.dayOfMonth || 1);
      if (dayOfMonth !== ruleDay) {
        results.push({ ruleId: rule.id, name: rule.name, skipped: 'not-due-day', dayOfMonth, ruleDay });
        continue;
      }
      const minDebt = Number(cfg.minDebt || 0);
      const students = await prisma.student.findMany({ where: { schoolId, status: { in: ['Faol', 'Sinov'] } } });
      targets = students.filter(s => Number(s.balance || 0) < -minDebt);
    } else if (rule.type === 'ABSENCE_REMINDER') {
      const attendances = await prisma.attendance.findMany({
        where: { schoolId, date: todayStr, status: 'Kelmapdi' },
        include: { student: true }
      });
      const uniqueStudentsMap = {};
      for (const att of attendances) {
        if (att.student && att.student.status !== 'Ochirilgan') {
          uniqueStudentsMap[att.studentId] = att.student;
        }
      }
      targets = Object.values(uniqueStudentsMap);
    } else if (rule.type === 'LEAD_WELCOME') {
      const startOfDay = new Date(nowUz);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const leads = await prisma.lead.findMany({
        where: { schoolId, createdAt: { gte: startOfDay }, status: 'Yangi' }
      });
      targets = leads.map(l => ({ id: l.id, name: l.name, phone: l.phone, balance: 0, schoolId }));
    } else if (rule.type === 'GROUP_WELCOME') {
      targets = await prisma.student.findMany({
        where: { schoolId, joinedDate: todayStr, status: { in: ['Faol', 'Sinov'] } }
      });
    } else if (rule.type === 'EXAM_RESULT') {
      const startOfDay = new Date(nowUz);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const resultsToday = await prisma.examResult.findMany({
        where: { schoolId, scannedAt: { gte: startOfDay } },
        include: { student: true, exam: true }
      });
      const uniqueStudentsMap = {};
      for (const er of resultsToday) {
        if (er.student && er.student.status !== 'Ochirilgan') {
          uniqueStudentsMap[er.studentId] = {
            ...er.student,
            customExamName: er.exam.name,
            customExamScore: er.score,
            customExamPercentage: er.percentage
          };
        }
      }
      targets = Object.values(uniqueStudentsMap);
    } else if (rule.type === 'PAYMENT_CONFIRM') {
      const paymentsToday = await prisma.payment.findMany({
        where: { schoolId, date: todayStr },
        include: { student: true }
      });
      const uniqueStudentsMap = {};
      for (const p of paymentsToday) {
        if (p.student && p.student.status !== 'Ochirilgan') {
          uniqueStudentsMap[p.studentId] = {
            ...p.student,
            customPaymentAmount: p.amount
          };
        }
      }
      targets = Object.values(uniqueStudentsMap);
    } else if (rule.type === 'DAILY_SCORE') {
      const scoresToday = await prisma.score.findMany({
        where: { schoolId, date: todayStr },
        include: { student: true }
      });
      const uniqueStudentsMap = {};
      for (const sc of scoresToday) {
        if (sc.student && sc.student.status !== 'Ochirilgan') {
          uniqueStudentsMap[sc.studentId] = {
            ...sc.student,
            customDailyScore: sc.value
          };
        }
      }
      targets = Object.values(uniqueStudentsMap);
    } else if (rule.type === 'TRANSPORT_NOTIFY') {
      targets = await prisma.student.findMany({
        where: { schoolId, transportId: { not: null }, status: { in: ['Faol', 'Sinov'] } }
      });
    } else if (rule.type === 'COURSE_GRADUATION') {
      targets = await prisma.student.findMany({
        where: { schoolId, status: 'Bitirgan' }
      });
    } else if (rule.type === 'LATE_ARRIVAL') {
      const lateAttendances = await prisma.attendance.findMany({
        where: { schoolId, date: todayStr, status: 'Kechikdi' },
        include: { student: true }
      });
      const uniqueMap = {};
      for (const a of lateAttendances) {
        if (a.student && !uniqueMap[a.student.id]) uniqueMap[a.student.id] = a.student;
      }
      targets = Object.values(uniqueMap);
    } else if (rule.type === 'EARLY_LEAVE') {
      const earlyAttendances = await prisma.attendance.findMany({
        where: { schoolId, date: todayStr, status: 'ErtaKetdi' },
        include: { student: true }
      });
      const uniqueMap = {};
      for (const a of earlyAttendances) {
        if (a.student && !uniqueMap[a.student.id]) uniqueMap[a.student.id] = a.student;
      }
      targets = Object.values(uniqueMap);
    }

    let sent = 0, failed = 0;
    let campaign = null;
    if (targets.length > 0) {
      campaign = await prisma.messageCampaign.create({
        data: {
          message: rule.body,
          channel: rule.channel,
          recipientTo: rule.recipientTo,
          filtersJson: { autoRuleId: rule.id, autoType: rule.type },
          totalCount: targets.length,
          schoolId
        }
      });
      
      const concurrencyLimit = 10;
      for (let i = 0; i < targets.length; i += concurrencyLimit) {
        const chunk = targets.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(async (student) => {
          const msg = fillTemplate(rule.body, student, groupsMap[student.id] || [], school);
          const r = await sendToOne({
            student,
            message: msg,
            channel: rule.channel,
            recipientTo: rule.recipientTo,
            type: rule.type === 'BIRTHDAY' ? 'BIRTHDAY' : 'PAYMENT',
            schoolId,
            campaignId: campaign.id
          });
          if (r.success) sent++; else failed++;
        }));
      }

      await prisma.messageCampaign.update({ where: { id: campaign.id }, data: { sentCount: sent, failedCount: failed } });
    }

    await prisma.autoMessageRule.update({ where: { id: rule.id }, data: { lastRunDate: todayStr } });
    results.push({ ruleId: rule.id, name: rule.name, schoolId, targets: targets.length, sent, failed });
  }

  return { date: todayStr, hour: currentHour, results };
}

// Vercel cron: kunlik/soatlik avtomatik xabarlar
app.get('/api/messaging/auto-process', async (req, res, next) => {
  try {
    const cronError = cronRequestRejected(req);
    if (cronError) return res.status(401).json({ error: cronError });
    const results = await runAutoProcessJobs();
    res.json({ success: true, ...results });
  } catch (err) { next(err); }
});

// Local hourly automatic scheduler (only if running locally)
if (!process.env.VERCEL) {
  console.log('[Scheduler] Local hourly scheduler initialized.');
  setInterval(async () => {
    try {
      const nowUtc = new Date();
      const nowUz = new Date(nowUtc.getTime() + (5 * 60 * 60 * 1000));
      const currentMinute = nowUz.getUTCMinutes();
      // Run once an hour when minute is 0
      if (currentMinute === 0) {
        console.log('[Scheduler] Triggering local hourly auto-process rules...');
        const res = await runAutoProcessJobs();
        console.log('[Scheduler] Local run results:', JSON.stringify(res));
      }
    } catch (err) {
      console.error('[Scheduler] Error in local hourly scheduler:', err);
    }
  }, 60 * 1000); // check every minute
}

// API: Failed SMS/Telegram loglarni qaytadan jo'natish
app.post('/api/sms/resend-failed', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { logIds, startDate, endDate } = req.body;
    const schoolId = req.user.schoolId;
    let logsToResend = [];

    if (Array.isArray(logIds) && logIds.length > 0) {
      logsToResend = await prisma.smsLog.findMany({
        where: {
          id: { in: logIds.map(Number) },
          schoolId,
          status: 'FAILED'
        }
      });
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      logsToResend = await prisma.smsLog.findMany({
        where: {
          schoolId,
          status: 'FAILED',
          sentAt: { gte: start, lte: end }
        }
      });
    } else {
      return res.status(400).json({ error: 'logIds yoki startDate va endDate kerak' });
    }

    if (logsToResend.length === 0) {
      return res.json({ success: true, count: 0, message: "Qayta jo'natish uchun xabarlar topilmadi" });
    }

    let successCount = 0;
    let failCount = 0;

    for (const log of logsToResend) {
      if (log.channel === 'TELEGRAM') {
        try {
          const schoolBot = await getTelegramBot(schoolId);
          if (schoolBot) {
            await schoolBot.telegram.sendMessage(log.toPhone, log.message);
            successCount++;
            await prisma.smsLog.update({
              where: { id: log.id },
              data: { status: 'SENT', errorMsg: null, sentAt: new Date() }
            });
          } else {
            failCount++;
            await prisma.smsLog.update({
              where: { id: log.id },
              data: { errorMsg: 'Telegram bot topilmadi', sentAt: new Date() }
            });
          }
        } catch (tgErr) {
          failCount++;
          await prisma.smsLog.update({
            where: { id: log.id },
            data: { errorMsg: tgErr.message, sentAt: new Date() }
          });
        }
      } else if (log.channel === 'SMS') {
        const result = await sendSms(log.toPhone, log.message, log.type, log.studentId, schoolId, log.campaignId);
        if (result.success) {
          successCount++;
          await prisma.smsLog.delete({ where: { id: log.id } }).catch(() => {});
        } else {
          failCount++;
          await prisma.smsLog.update({
            where: { id: log.id },
            data: { errorMsg: JSON.stringify(result.data || result.error || 'SMS failed on resend'), sentAt: new Date() }
          });
        }
      }
    }

    res.json({ success: true, total: logsToResend.length, successCount, failCount });
  } catch (err) { next(err); }
});

// ==================== END MESSAGING MODULE ====================

// ==================== EXAM MODULE ====================

// --- Questions ---
app.get('/api/questions', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const where = { schoolId };
    if (req.query.subject) where.subject = req.query.subject;
    if (req.query.topic) where.topic = req.query.topic;
    const questions = await prisma.question.findMany({ where, orderBy: { id: 'asc' } });
    res.json(questions);
  } catch (err) { next(err); }
});

app.post('/api/questions', authenticate, async (req, res, next) => {
  try {
    let { text, imageUrl, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic, schoolId } = req.body;
    if (!text || !optionA || !optionB || !optionC || !optionD || !correctAnswer || !subject || !topic || !schoolId) {
      return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }
    imageUrl = await rasmQiymatiniTozala(imageUrl, 'question');
    const question = await prisma.question.create({
      data: { text, imageUrl: imageUrl || null, optionA, optionB, optionC, optionD, correctAnswer, difficulty: difficulty || 1, subject, topic, schoolId: parseInt(schoolId) }
    });
    res.status(201).json(question);
  } catch (err) { next(err); }
});

app.post('/api/questions/bulk', authenticate, async (req, res, next) => {
  try {
    const { questions, schoolId } = req.body;
    if (!Array.isArray(questions) || !schoolId) return res.status(400).json({ error: 'questions array va schoolId required' });
    const data = questions.map(q => ({
      text: q.text, imageUrl: q.imageUrl || null,
      optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
      correctAnswer: q.correctAnswer, difficulty: q.difficulty || 1,
      subject: q.subject, topic: q.topic, schoolId: parseInt(schoolId)
    }));
    const result = await prisma.question.createMany({ data, skipDuplicates: false });
    res.status(201).json({ count: result.count });
  } catch (err) { next(err); }
});

app.put('/api/questions/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    let { text, imageUrl, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic } = req.body;
    imageUrl = await rasmQiymatiniTozala(imageUrl, 'question');
    const question = await prisma.question.update({
      where: { id },
      data: { text, imageUrl: imageUrl || null, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic }
    });
    res.json(question);
  } catch (err) { next(err); }
});

app.delete('/api/questions/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    await prisma.question.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Exams ---
app.get('/api/exams', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.query.schoolId);
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const exams = await prisma.exam.findMany({
      where: { schoolId },
      include: { _count: { select: { results: true, assignments: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(exams);
  } catch (err) { next(err); }
});

app.post('/api/exams', authenticate, async (req, res, next) => {
  try {
    const { name, date, duration, status, blocks, totalQuestions, maxScore, schoolId } = req.body;
    if (!name || !date || !duration || !blocks || !schoolId) return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmadi' });
    const exam = await prisma.exam.create({
      data: { name, date, duration: parseInt(duration), status: status || 'Yaqinlashmoqda', blocks, totalQuestions: parseInt(totalQuestions) || 0, maxScore: parseFloat(maxScore) || 0, schoolId: parseInt(schoolId) }
    });
    res.status(201).json(exam);
  } catch (err) { next(err); }
});

app.put('/api/exams/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, date, duration, status, blocks, totalQuestions, maxScore, variants } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (date !== undefined) data.date = date;
    if (duration !== undefined) data.duration = parseInt(duration);
    if (status !== undefined) data.status = status;
    if (blocks !== undefined) data.blocks = blocks;
    if (totalQuestions !== undefined) data.totalQuestions = parseInt(totalQuestions);
    if (maxScore !== undefined) data.maxScore = parseFloat(maxScore);
    if (variants !== undefined) data.variants = variants;
    const exam = await prisma.exam.update({ where: { id }, data });
    res.json(exam);
  } catch (err) { next(err); }
});

app.delete('/api/exams/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    await prisma.exam.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Exam Assignments ---
app.get('/api/exams/:id/assignments', authenticate, async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const assignments = await prisma.examAssignment.findMany({
      where: { examId },
      include: { group: { select: { id: true, name: true } } }
    });
    res.json(assignments);
  } catch (err) { next(err); }
});

app.post('/api/exams/:id/assignments', authenticate, async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { groupIds, schoolId } = req.body;
    if (!Array.isArray(groupIds) || !schoolId) return res.status(400).json({ error: 'groupIds va schoolId required' });
    // Upsert each assignment
    const results = await Promise.all(
      groupIds.map(groupId =>
        prisma.examAssignment.upsert({
          where: { examId_groupId: { examId, groupId: parseInt(groupId) } },
          create: { examId, groupId: parseInt(groupId), schoolId: parseInt(schoolId) },
          update: {}
        })
      )
    );
    res.status(201).json(results);
  } catch (err) { next(err); }
});

app.delete('/api/exams/:id/assignments/:groupId', authenticate, async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const groupId = parseInt(req.params.groupId);
    await prisma.examAssignment.deleteMany({ where: { examId, groupId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Exam Results ---
app.get('/api/exam-results', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.examId) where.examId = parseInt(req.query.examId);
    if (req.query.studentId) where.studentId = parseInt(req.query.studentId);
    if (req.query.schoolId) where.schoolId = parseInt(req.query.schoolId);
    const results = await prisma.examResult.findMany({
      where,
      include: { student: { select: { id: true, name: true, photo: true } }, exam: { select: { id: true, name: true, maxScore: true } } },
      orderBy: { scannedAt: 'desc' }
    });
    res.json(results);
  } catch (err) { next(err); }
});

app.post('/api/exam-results', authenticate, async (req, res, next) => {
  try {
    const { studentId, examId, variantCode, answers, schoolId } = req.body;
    if (!studentId || !examId || !schoolId) return res.status(400).json({ error: 'studentId, examId, schoolId required' });

    // Fetch exam to calculate score server-side
    const exam = await prisma.exam.findUnique({ where: { id: parseInt(examId) } });
    if (!exam) return res.status(404).json({ error: 'Imtihon topilmadi' });

    let score = 0;
    let blockScores = [];

    if (answers && exam.variants && variantCode) {
      const variant = exam.variants.find(v => v.variantCode === variantCode);
      if (variant) {
        // Calculate per-block scores
        const blockMap = {};
        exam.blocks.forEach(block => {
          blockMap[block.subject.toLowerCase()] = { subject: block.subject, earned: 0, max: 0, pointsPerQ: block.pointsPerQuestion || 1 };
        });

        variant.questions.forEach((vq, idx) => {
          const studentAnswer = answers[idx + 1] || answers[idx];
          const subjectKey = (vq.subject || '').toLowerCase();
          const block = blockMap[subjectKey] || Object.values(blockMap)[0];
          if (block) {
            block.max += block.pointsPerQ;
            if (studentAnswer === vq.correctOption) {
              block.earned += block.pointsPerQ;
              score += block.pointsPerQ;
            }
          }
        });

        blockScores = Object.values(blockMap);
      }
    }

    const percentage = exam.maxScore > 0 ? Math.round((score / exam.maxScore) * 100) : 0;

    const result = await prisma.examResult.upsert({
      where: { studentId_examId: { studentId: parseInt(studentId), examId: parseInt(examId) } },
      create: { studentId: parseInt(studentId), examId: parseInt(examId), variantCode, answers: answers || {}, score, percentage, blockScores, schoolId: parseInt(schoolId) },
      update: { variantCode, answers: answers || {}, score, percentage, blockScores, scannedAt: new Date() },
      include: { student: { select: { id: true, name: true, photo: true } }, exam: { select: { id: true, name: true, maxScore: true } } }
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

app.delete('/api/exam-results/:id', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    await prisma.examResult.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Only these image types may be stored. The extension used to come straight from the
// caller's filename and became the stored object's content type, so any string at all
// could be uploaded into a publicly readable bucket.
const ALLOWED_UPLOADS = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
};

// First bytes of each format. The declared extension is a claim; this is the evidence.
function sniffImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/**
 * A photo may still reach a write endpoint as a base64 data URL: the browser uploads to
 * /api/upload first, but compressAndUpload keeps the inline copy when that request fails
 * (src/lib/image.ts). Stored as-is the whole image sits in the row and then rides inside
 * every /api/init response for every user on every load — three such rows once accounted
 * for 68% of a 1.9 MB payload. Moving it here means a row never holds more than a URL.
 *
 * Returns the public URL, or null when the image could not be moved. Callers drop the
 * field on null rather than writing an image into the row: a photo that has to be picked
 * again is a smaller loss than a payload every user pays for on every page load.
 */
async function dataUrlniStoragega(qiymat, nomAsosi) {
  const mos = /^data:image\/[\w+]+;base64,(.*)$/s.exec(qiymat);
  if (!mos) return null;

  try {
    const buffer = Buffer.from(mos[1], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) return null;

    // Trust the bytes, not the declared type — same rule as /api/upload.
    const ext = sniffImageType(buffer);
    if (!ext) return null;

    const nom = `${nomAsosi}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from('uploads')
      .upload(nom, buffer, { contentType: ALLOWED_UPLOADS[ext], upsert: true });
    if (error) throw error;

    const { data } = supabaseAdmin.storage.from('uploads').getPublicUrl(nom);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('[rasm] data URL Storage ga ko\'chmadi:', e.message);
    return null;
  }
}

/**
 * The same conversion for a standalone value rather than a field. Returns the value
 * untouched when it is not a data URL, and undefined when it was one that could not be
 * moved — the caller then leaves the stored photo as it was.
 */
async function rasmQiymatiniTozala(qiymat, nomAsosi) {
  if (typeof qiymat !== 'string' || !qiymat.startsWith('data:')) return qiymat;
  return (await dataUrlniStoragega(qiymat, nomAsosi)) ?? undefined;
}

/** Swaps a base64 photo field for its Storage URL in place. Other values are left alone. */
async function rasmMaydoniniTozala(data, maydon, nomAsosi) {
  const qiymat = data[maydon];
  if (typeof qiymat !== 'string' || !qiymat.startsWith('data:')) return;

  const url = await dataUrlniStoragega(qiymat, nomAsosi);
  if (url) data[maydon] = url;
  else delete data[maydon];
}

// Upload endpoint — Supabase Storage
app.post('/api/upload', authenticate, async (req, res, next) => {
  try {
    const { data, filename } = req.body; // data: base64 string, filename: original name
    if (!data || !filename) return res.status(400).json({ error: 'data va filename required' });

    const base64Data = String(data).replace(/^data:image\/[\w+]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) return res.status(400).json({ error: 'Fayl bo\'sh' });
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'Fayl juda katta (eng ko\'pi 3 MB)' });
    }

    // Trust the bytes, not the name.
    const ext = sniffImageType(buffer);
    if (!ext) {
      return res.status(400).json({ error: 'Faqat rasm yuklash mumkin (JPG, PNG, WEBP, GIF)' });
    }
    const mimeType = ALLOWED_UPLOADS[ext];
    const uniqueName = `q_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('uploads')
      .upload(uniqueName, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseAdmin.storage
      .from('uploads')
      .getPublicUrl(uniqueName);

    res.json({ url: publicData.publicUrl });
  } catch (err) { next(err); }
});

// ==================== END EXAM MODULE ====================

// ==================== BILLING MODULE ====================

// Oylik hisob-kitob mantiqi services/billing.js ga ko'chirildi.

app.post('/api/billing/process-month', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { schoolId, month } = req.body;
    if (!schoolId || !month) return res.status(400).json({ error: 'schoolId and month required' });
    const result = await processMonthlyBilling(parseInt(schoolId), month);
    res.json(result);
  } catch (err) { next(err); }
});

app.post('/api/billing/recalculate-month', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { schoolId, month } = req.body;
    if (!schoolId || !month) return res.status(400).json({ error: 'schoolId and month required' });
    const sid = parseInt(schoolId);

    const allOylik = await prisma.payment.findMany({
      where: { schoolId: sid, type: 'Oylik' }
    });
    const monthPayments = allOylik.filter(p => p.date.startsWith(month) && p.description?.startsWith('[OYLIK HISOB]'));

    for (const p of monthPayments) {
      await prisma.student.update({ where: { id: p.studentId }, data: { balance: { increment: Math.abs(p.amount) } } });
    }
    if (monthPayments.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: monthPayments.map(p => p.id) } } });
    }

    await releaseBillingRun(sid, month);
    await claimBillingRun(sid, month);
    const result = await processMonthlyBilling(sid, month);
    res.json({ recalculated: monthPayments.length, ...result });
  } catch (err) { next(err); }
});

app.get('/api/billing/status', authenticate, async (req, res, next) => {
  try {
    const { schoolId, month } = req.query;
    if (!schoolId || !month) return res.status(400).json({ error: 'schoolId and month required' });
    const sid = parseInt(schoolId);

    // Sinov o'quvchilari bu jadvalga kirmaydi — ularga hisob yozilmaydi.
    const groups = await prisma.group.findMany({
      where: { schoolId: sid },
      include: { course: true, students: { where: { status: 'Faol' } } }
    });

    let billingDone = !!(await prisma.payment.findFirst({
      where: { schoolId: sid, type: 'Oylik', date: { startsWith: month }, description: { startsWith: '[OYLIK HISOB]' } },
      select: { id: true },
    }));

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Billing runs lazily: the first view of a month charges it. Two staff opening the
    // finance screen at once used to run it twice and charge every student twice over,
    // so the run is claimed first and only the winner bills.
    if (!billingDone && month <= currentMonthStr) {
      if (await claimBillingRun(sid, month)) {
        await processMonthlyBilling(sid, month);
      }
      billingDone = true;
    }

    const studentMap = {};
    for (const group of groups) {
      for (const student of group.students) {
        if (!studentMap[student.id]) studentMap[student.id] = { student, groupEntries: [] };
        const cp = (student.customPrices && typeof student.customPrices === 'object') ? student.customPrices : {};
        const price = cp[group.id] !== undefined ? cp[group.id] : group.course.price;
        studentMap[student.id].groupEntries.push({
          groupId: group.id, groupName: group.name, courseName: group.course.name, price
        });
      }
    }

    // Holat "shu oyda qancha to'lagan"ga emas, "shu oyning hisobi yopilganmi"ga
    // qarab chiqadi. Avgustda 2 mln avans bergan o'quvchi sentabrda hech
    // narsa to'lamasa ham "to'langan" — hisobi hamyonidan yopilgan.
    const coverage = await monthCoverage(Object.keys(studentMap).map(Number), month);

    const students = Object.values(studentMap).map(({ student, groupEntries }) => {
      const cov = coverage.get(student.id);
      const expected = cov && cov.due > 0 ? cov.due : groupEntries.reduce((s, g) => s + g.price, 0);
      const paid = cov ? Math.min(cov.covered, expected) : 0;
      const status = expected > 0 && paid >= expected ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      return {
        studentId: student.id, name: student.name, phone: student.phone, balance: student.balance,
        groups: groupEntries.map(g => ({ ...g, ...(cov?.groups.get(g.groupId) || {}) })),
        expected, paid, status,
        debt: cov ? cov.debt : 0, wallet: cov ? cov.wallet : 0,
      };
    });

    const groupBreakdown = groups.map(group => {
      const active = group.students;
      let expected = 0, actual = 0, paidCount = 0;
      for (const st of active) {
        const g = coverage.get(st.id)?.groups.get(group.id);
        if (!g) continue;
        expected += g.due; actual += g.covered;
        if (g.remaining <= 0 && g.due > 0) paidCount++;
      }
      return {
        groupId: group.id, groupName: group.name, courseName: group.course.name,
        totalStudents: active.length, paidCount,
        unpaidCount: active.length - paidCount, expected, actual
      };
    });

    res.json({ billingDone, students, groups: groupBreakdown, month });
  } catch (err) { next(err); }
});

app.post('/api/billing/notify-debtors', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
  try {
    const { schoolId, month, messageTemplate, channel, statusFilter } = req.body;
    if (!schoolId || !month || !messageTemplate || !channel) {
      return res.status(400).json({ error: 'schoolId, month, messageTemplate, and channel are required' });
    }
    const sid = parseInt(schoolId);

    const statusList = statusFilter === 'passive'
      ? ['Passiv', 'Ketgan']
      : statusFilter === 'all'
        ? ['Faol', 'Sinov', 'Passiv', 'Ketgan']
        : ['Faol'];

    const groups = await prisma.group.findMany({
      where: { schoolId: sid },
      include: { course: true, students: { where: { status: { in: statusList } } } }
    });

    const studentMap = {};
    for (const group of groups) {
      for (const student of group.students) {
        if (!studentMap[student.id]) studentMap[student.id] = { student, groupEntries: [] };
        const cp = (student.customPrices && typeof student.customPrices === 'object') ? student.customPrices : {};
        const price = cp[group.id] !== undefined ? cp[group.id] : group.course.price;
        studentMap[student.id].groupEntries.push({
          groupId: group.id, groupName: group.name, courseName: group.course.name, price
        });
      }
    }

    const coverage = await monthCoverage(Object.keys(studentMap).map(Number), month);
    const debtors = Object.values(studentMap).map(({ student, groupEntries }) => {
      const cov = coverage.get(student.id);
      const expected = cov && cov.due > 0 ? cov.due : groupEntries.reduce((s, g) => s + g.price, 0);
      const paid = cov ? Math.min(cov.covered, expected) : 0;
      const status = expected > 0 && paid >= expected ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      // Xabardagi qarz — o'quvchining umumiy yopilmagan hisobi (eski oylar ham).
      const debt = cov ? cov.debt : expected - paid;
      return { student, expected, paid, status, debt };
    }).filter(d => d.status !== 'paid' && d.debt > 0);

    const school = await prisma.school.findUnique({ where: { id: sid } });
    const schoolBot = await getTelegramBot(sid);

    let count = 0;
    const monthsUz = {
      '01': 'Yanvar', '02': 'Fevral', '03': 'Mart', '04': 'Aprel',
      '05': 'May', '06': 'Iyun', '07': 'Iyul', '08': 'Avgust',
      '09': 'Sentabr', '10': 'Oktabr', '11': 'Noyabr', '12': 'Dekabr'
    };
    const [y, m] = month.split('-');
    const formattedMonth = `${monthsUz[m] || m} ${y}`;

    for (const d of debtors) {
      const student = d.student;
      const formattedMessage = messageTemplate
        .replace(/\{ism\}/gi, student.name)
        .replace(/\{oylik\}/gi, formattedMonth)
        .replace(/\{balans\}/gi, student.balance.toLocaleString())
        .replace(/\{qarz\}/gi, d.debt.toLocaleString())
        .replace(/\{markaz\}/gi, school?.name || '');

      let sent = false;

      // Telegram
      const tids = [];
      if (student.telegramId) tids.push({ id: student.telegramId, name: student.name });
      if (student.fatherTelegramId) tids.push({ id: student.fatherTelegramId, name: `${student.name} (Otasi)` });
      if (student.motherTelegramId) tids.push({ id: student.motherTelegramId, name: `${student.name} (Onasi)` });

      if ((channel === 'TELEGRAM' || channel === 'BOTH') && tids.length > 0 && schoolBot) {
        for (const target of tids) {
          try {
            await schoolBot.telegram.sendMessage(target.id, formattedMessage);
            sent = true;
            await prisma.smsLog.create({
              data: {
                toPhone: String(target.id),
                message: formattedMessage,
                status: 'SENT',
                type: 'BILLING_DEBT',
                studentId: student.id,
                channel: 'TELEGRAM',
                schoolId: sid
              }
            });
          } catch (tgErr) {
            console.error(`[Debt Notify TG] Failed for ${student.name} (to ${target.name}):`, tgErr.message);
          }
        }
      }

      // SMS
      if ((channel === 'SMS' || channel === 'BOTH') && !sent) {
        const phone = resolveRecipientPhone(student);
        if (phone) {
          try {
            await sendSms(phone, formattedMessage, 'BILLING_DEBT', student.id, sid);
            sent = true;
          } catch (smsErr) {
            console.error(`[Debt Notify SMS] Failed for ${student.name}:`, smsErr.message);
          }
        }
      }

      if (sent) count++;
    }

    res.json({ success: true, count });
  } catch (err) { next(err); }
});

app.get('/api/billing/auto-process', async (req, res, next) => {
  try {
    const cronError = cronRequestRejected(req);
    if (cronError) return res.status(401).json({ error: cronError });
    const schools = await prisma.school.findMany({ select: { id: true, name: true } });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const results = [];
    for (const school of schools) {
      const result = await processMonthlyBilling(school.id, month);
      results.push({ schoolId: school.id, schoolName: school.name, ...result });
    }
    res.json({ success: true, month, results });
  } catch (err) { next(err); }
});

// ==================== END BILLING MODULE ====================

// Payme: webhook, havola yaratish, ochiq holat sahifasi (routes/payme.js).
registerPaymeRoutes(app);

// Serve static React files
app.use('/uploads', express.static(join(__dirname, 'public', 'uploads')));
app.use(express.static(join(__dirname, 'dist')));

// An unknown API path used to fall through to the SPA and answer 200 with index.html,
// so callers got HTML where they expected JSON and failed in confusing ways.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Bunday manzil topilmadi' });
});

// Handle React Router SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Global error handler — must be registered after every route so that all of them
// reach it. Anything that throws now answers JSON instead of Express's default HTML.
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  try {
    import('fs').then(fs => {
      const logMsg = `\n[${new Date().toISOString()}] ERROR on ${req.method} ${req.url}\n` +
                     `Body: ${JSON.stringify(redactBody(req.body))}\n` +
                     `Error: ${err.message}\n` +
                     `Stack: ${err.stack}\n` +
                     `-------------------------------------------\n`;
      fs.appendFileSync('error.log', logMsg);
    }).catch(e => console.error('Dynamic import of fs failed:', e));
  } catch (e) {
    console.error('Failed to log error to file:', e);
  }
  // Internal details (Prisma queries, column names, stack) stay server-side.
  res.status(500).json({
    error: 'Serverda xatolik yuz berdi',
    ...(process.env.NODE_ENV !== 'production' ? { message: err.message, code: err.code } : {})
  });
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;


