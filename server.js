import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bot, { startBot, notifyAdmins } from './src/bot/bot.js';
import bcrypt from 'bcryptjs';
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

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ limit: '3mb', extended: true }));

// Middleware to authenticate JWT
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

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

app.get('/api/telegram-setup', async (req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN missing in environment variables' });
    }
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;
    
    await bot.telegram.setWebhook(webhookUrl);
    res.json({ success: true, message: `Telegram Webhook set to: ${webhookUrl}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Auth Routes ---
app.post('/api/auth/login', async (req, res, next) => {
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
        { expiresIn: '24h' }
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

    if (user.school && user.school.organization) {
      const org = user.school.organization;
      if (org.status === 'Muzlatilgan') {
        return res.status(403).json({ error: 'Tashkilotingiz obunasi muzlatilgan. Administrator bilan bog\'laning.' });
      }
      if (org.expiresAt && new Date(org.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Tashkilotingiz obuna muddati tugagan. Iltimos, to\'lov qiling.' });
      }
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, schoolId: user.schoolId }, JWT_SECRET, { expiresIn: '24h' });
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

// --- User Management (Admin only) ---
app.get('/api/users', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });

    const { schoolId } = req.query;
    let where = {};

    if (req.user.role === 'MANAGER') {
      where = { schoolId: req.user.schoolId, role: { not: 'ADMIN' } };
    } else if (schoolId && !isNaN(parseInt(schoolId))) {
      where = { schoolId: parseInt(schoolId) };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, phone: true, photo: true, position: true, salary: true, workDays: true, kpiPercent: true, role: true, createdAt: true, schoolId: true }
    });
    res.json(users);
  } catch (error) { next(error); }
});

app.post('/api/users', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Ruhsat yo' });

    let { email, password, name, phone, photo, position, salary, role, schoolId, kpiPercent } = req.body;

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

    // Auto-create Teacher profile for TEACHER and SUPPORT_TEACHER roles
    if ((role === 'TEACHER' || role === 'SUPPORT_TEACHER') && targetSchoolId) {
      try {
        await prisma.teacher.create({
          data: {
            name: user.name,
            phone: user.phone || '',
            salary: user.salary || 0,
            sharePercentage: 0,
            lessonFee: 0,
            birthDate: '',
            hiredDate: new Date().toISOString().split('T')[0],
            status: 'Faol',
            schoolId: targetSchoolId
          }
        });
      } catch (teacherError) {
        console.error('Failed to auto-create teacher profile:', teacherError);
      }
    }

    res.json({ ...user, password: undefined });
  } catch (error) { next(error); }
});

app.put('/api/users/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Faqat ADMIN/MANAGER tahrirlay oladi' });
    const { id } = req.params;
    const { email, name, phone, photo, position, salary, role, password, workDays, kpiPercent } = req.body;
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
    if (password) data.password = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await prisma.user.update({
        where: { id: parseInt(id) },
        data,
        select: { id: true, email: true, name: true, phone: true, photo: true, position: true, salary: true, workDays: true, kpiPercent: true, role: true, createdAt: true, schoolId: true }
      });
    } catch (updateErr) {
      if (updateErr.code === 'P2002') return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
      throw updateErr;
    }
    res.json(user);
  } catch (error) { next(error); }
});

app.delete('/api/users/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Faqat ADMIN o\'chira oladi' });
    const { id } = req.params;
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Staff Attendance ---
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

// --- Salary Payments ---
app.get('/api/salary-payments', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const payments = await prisma.salaryPayment.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { month: 'desc' }
    });
    res.json(payments);
  } catch (error) { next(error); }
});

app.post('/api/salary-payments', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId, month, amount, baseSalary, bonuses, fines, note } = req.body;
    const schoolId = req.user.schoolId;

    // Get employee name for expense description
    const employee = await prisma.user.findUnique({ where: { id: parseInt(userId) }, select: { name: true } });
    const empName = employee?.name || 'Xodim';

    // Create linked expense record in Finance
    const expense = await prisma.expense.create({
      data: {
        amount: parseInt(amount),
        category: 'Ish haqi',
        date: new Date().toISOString().split('T')[0],
        description: `${empName} — ${month} oy maoshi`,
        schoolId
      }
    });

    // Create salary payment
    const payment = await prisma.salaryPayment.create({
      data: {
        userId: parseInt(userId),
        month,
        amount: parseInt(amount),
        baseSalary: parseInt(baseSalary),
        bonuses: parseInt(bonuses) || 0,
        fines: parseInt(fines) || 0,
        note: note || null,
        expenseId: expense.id,
        schoolId
      }
    });

    res.json(payment);
  } catch (error) { next(error); }
});

app.delete('/api/salary-payments/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { id } = req.params;
    const payment = await prisma.salaryPayment.findUnique({ where: { id: parseInt(id) } });
    if (!payment) return res.status(404).json({ error: 'Not found' });

    // Delete linked expense if exists
    if (payment.expenseId) {
      try { await prisma.expense.delete({ where: { id: payment.expenseId } }); } catch {}
    }

    await prisma.salaryPayment.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// KPI calculation from group payments
app.get('/api/kpi-calculation', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });
    const { userId, month } = req.query;
    if (!userId || !month) return res.status(400).json({ error: 'userId and month required' });

    const employee = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { name: true, schoolId: true, kpiPercent: true }
    });
    if (!employee) return res.json({ groups: [], totalPayments: 0, kpiAmount: 0 });

    // Find linked Teacher by name
    const teacher = await prisma.teacher.findFirst({
      where: { name: employee.name, schoolId: employee.schoolId }
    });
    if (!teacher) return res.json({ groups: [], totalPayments: 0, kpiAmount: 0 });

    // Get teacher's groups with students and their payments for the month
    const groups = await prisma.group.findMany({
      where: { teacherId: teacher.id },
      include: {
        students: {
          include: {
            payments: { where: { date: { startsWith: String(month) } } }
          }
        },
        course: { select: { name: true } }
      }
    });

    let totalPayments = 0;
    const groupBreakdown = groups.map(g => {
      const groupTotal = g.students.reduce((sum, s) => {
        return sum + s.payments.reduce((ps, p) => ps + p.amount, 0);
      }, 0);
      totalPayments += groupTotal;
      return {
        id: g.id,
        name: g.name,
        course: g.course?.name || '',
        studentCount: g.students.length,
        total: groupTotal
      };
    });

    const kpiPercent = employee.kpiPercent || 0;
    const kpiAmount  = Math.round(totalPayments * kpiPercent / 100);

    res.json({ groups: groupBreakdown, totalPayments, kpiPercent, kpiAmount });
  } catch (error) { next(error); }
});

// Endpoint to sync missing teacher profiles (one-time fix or utility)
app.post('/api/admin/sync-teachers', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only ADMIN can sync' });

    const users = await prisma.user.findMany({ 
      where: { role: 'TEACHER', schoolId: { not: null } } 
    });
    
    let createdCount = 0;
    for (const user of users) {
      const existing = await prisma.teacher.findFirst({
        where: { name: user.name, schoolId: user.schoolId }
      });
      
      if (!existing) {
        await prisma.teacher.create({
          data: {
            name: user.name,
            phone: user.phone || '',
            salary: 0,
            sharePercentage: 0,
            lessonFee: 0,
            birthDate: '',
            hiredDate: new Date().toISOString().split('T')[0],
            status: 'Faol',
            schoolId: user.schoolId
          }
        });
        createdCount++;
      }
    }
    
    res.json({ success: true, createdCount });
  } catch (error) { next(error); }
});

// --- API Routes ---

// Students
app.get('/api/students', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const students = await prisma.student.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: { groups: { select: { id: true } } }
    });
    res.json(students.map(s => ({ ...s, groups: s.groups.map(g => g.id) })));
  } catch (error) { next(error); }
});
app.post('/api/students', authenticate, async (req, res, next) => {
  try {
    const { groups, schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.balance) data.balance = parseFloat(data.balance);
    const student = await prisma.student.create({
      data: { ...data, schoolId: parseInt(schoolId) }
    });
    if (groups && groups.length > 0) {
      await prisma.student.update({
        where: { id: student.id },
        data: { groups: { connect: groups.map(id => ({ id })) } }
      });
    }
    const updatedStudent = await prisma.student.findUnique({ where: { id: student.id }, include: { groups: { select: { id: true } } } });
    res.json({ ...updatedStudent, groups: updatedStudent.groups.map(g => g.id) });
  } catch (error) { next(error); }
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
        fatherName: item.fatherName ? String(item.fatherName).trim() : null,
        fatherPhone: item.fatherPhone ? String(item.fatherPhone).trim() : null,
        motherName: item.motherName ? String(item.motherName).trim() : null,
        motherPhone: item.motherPhone ? String(item.motherPhone).trim() : null,
        studentSchool: item.studentSchool ? String(item.studentSchool).trim() : null,
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

    const { groups, schoolId, ...data } = req.body;
    console.log(`Updating student ${studentId}:`, data);

    // If status is changing, update statusChangedAt
    if (data.status) {
      const oldStudent = await prisma.student.findUnique({ where: { id: studentId } });
      if (oldStudent && oldStudent.status !== data.status) {
        data.statusChangedAt = new Date();
      }
    }

    if (data.transportId !== undefined) {
      data.transportId = data.transportId ? parseInt(data.transportId) : null;
    }

    await prisma.student.update({
      where: { id: studentId },
      data
    });

    if (groups) {
      console.log(`Setting groups for student ${studentId}:`, groups);
      await prisma.student.update({
        where: { id: studentId },
        data: {
          groups: {
            set: groups.map(gId => ({ id: parseInt(gId) }))
          }
        }
      });
    }

    const updatedStudent = await prisma.student.findUnique({
      where: { id: studentId },
      include: { groups: { select: { id: true } } }
    });

    res.json({
      ...updatedStudent,
      groups: updatedStudent.groups.map(g => g.id)
    });
  } catch (error) {
    console.error(`Error updating student ${req.params.id}:`, error);
    next(error);
  }
});
app.delete('/api/students/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.student.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Teachers
app.get('/api/teachers', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const teachers = await prisma.teacher.findMany({ where: { schoolId: parseInt(schoolId) } });
    res.json(teachers);
  } catch (error) { next(error); }
});
app.post('/api/teachers', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.salary) data.salary = parseFloat(data.salary);
    if (data.sharePercentage) data.sharePercentage = parseFloat(data.sharePercentage);
    if (data.lessonFee) data.lessonFee = parseFloat(data.lessonFee);
    if (!data.salaryType) data.salaryType = 'FIXED';
    const teacher = await prisma.teacher.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    res.json(teacher);
  } catch (error) { next(error); }
});
app.put('/api/teachers/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const teacher = await prisma.teacher.update({ where: { id: parseInt(id) }, data: req.body });
    res.json(teacher);
  } catch (error) { next(error); }
});
app.delete('/api/teachers/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.teacher.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
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
    let { studentIds, schoolId, courseName, name, teacherId, courseId, schedule, days, room } = req.body;
    console.log('Payload:', { studentIds, schoolId, courseName, name, teacherId, courseId, schedule, days, room });

    const sId = parseInt(schoolId);
    if (!sId) {
      console.log('Error: schoolId missing');
      return res.status(400).json({ error: 'schoolId required' });
    }
    
    // Resolve courseId
    if (!courseId && courseName) {
      console.log('Resolving courseName:', courseName);
      let course = await prisma.course.findFirst({
        where: { name: courseName, schoolId: sId }
      });
      if (!course) {
        console.log('Creating new course:', courseName);
        course = await prisma.course.create({
          data: { name: courseName, price: 0, schoolId: sId }
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

    console.log('Prisma create data:', prismaData);

    const group = await prisma.group.create({ data: prismaData });
    console.log('Success: Group created with ID:', group.id);
    
    if (studentIds && studentIds.length > 0) {
      console.log('Connecting students:', studentIds);
      await prisma.group.update({
        where: { id: group.id },
        data: { students: { connect: studentIds.map(id => ({ id })) } }
      });
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
      courseName: updatedGroup.course?.name
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

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { students: { connect: { id: parseInt(studentId) } } },
      include: {
        students: { select: { id: true } },
        course: { select: { name: true } }
      }
    });

    res.json({
      ...updatedGroup,
      studentIds: updatedGroup.students.map(s => s.id),
      courseName: updatedGroup.course?.name
    });
  } catch (error) {
    console.error('Error connecting student to group:', error);
    next(error);
  }
});

// Atomic endpoint: disconnect a single student from a group
app.delete('/api/groups/:id/students/:studentId', authenticate, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { students: { disconnect: { id: studentId } } },
      include: {
        students: { select: { id: true } },
        course: { select: { name: true } }
      }
    });

    res.json({
      ...updatedGroup,
      studentIds: updatedGroup.students.map(s => s.id),
      courseName: updatedGroup.course?.name
    });
  } catch (error) {
    console.error('Error disconnecting student from group:', error);
    next(error);
  }
});

app.put('/api/groups/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    let { studentIds, schoolId, name, teacherId, courseId, schedule, days, room } = req.body;
    
    // Prepare data for Prisma - ONLY include fields that are in the schema
    const prismaData = {};
    if (name !== undefined) prismaData.name = name;
    if (teacherId !== undefined) prismaData.teacherId = parseInt(teacherId);
    if (courseId !== undefined) prismaData.courseId = parseInt(courseId);
    if (schedule !== undefined) prismaData.schedule = schedule;
    if (days !== undefined) prismaData.days = days;
    
    if (room !== undefined) {
      prismaData.room = (room === null || room === '') ? null : parseInt(room);
    }

    const group = await prisma.group.update({
      where: { id: parseInt(id) },
      data: prismaData
    });

    if (studentIds) {
      await prisma.group.update({
        where: { id: group.id },
        data: { 
          students: { 
            set: studentIds.map(sid => ({ id: sid })) 
          } 
        }
      });
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
      courseName: updatedGroup.course?.name
    });
  } catch (error) {
    console.error('Error updating group:', error);
    next(error);
  }
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
    const lead = await prisma.lead.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    
    // Telegram Notification
    notifyAdmins(`🆕 Yangi lid: ${lead.name}\n📞 ${lead.phone}\n📚 Kurs: ${lead.course}`, parseInt(schoolId));

    res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
  } catch (error) { next(error); }
});
// Public endpoint for landing page form submissions (no auth required)
app.post('/api/public/leads', async (req, res, next) => {
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

    const courses = await prisma.course.findMany({
      where: { schoolId },
      select: { id: true, name: true, price: true }
    });
    res.json(courses);
  } catch (error) { next(error); }
});

// POST create single-use registration token (Authenticated)
app.post('/api/public/schools/:schoolId/tokens', authenticate, async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Mavjud bo\'lmagan filial ID' });

    const token = await prisma.applyToken.create({
      data: { schoolId }
    });
    res.json({ token: token.id });
  } catch (error) { next(error); }
});

// GET check if a registration token is valid
app.get('/api/public/tokens/:tokenId', async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const token = await prisma.applyToken.findUnique({
      where: { id: tokenId }
    });

    if (!token || token.used) {
      return res.json({ valid: false });
    }

    res.json({ valid: true, schoolId: token.schoolId });
  } catch (error) { next(error); }
});

// POST register lead via public apply form using unique token
app.post('/api/public/schools/:schoolId/leads', async (req, res, next) => {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) return res.status(400).json({ error: 'Mavjud bo\'lmagan filial ID' });

    const { 
      name, phone, course, source, token,
      birthDate, address, studentSchool,
      fatherName, fatherPhone, motherName, motherPhone,
      preferredTime, notes, photo
    } = req.body;

    if (!name || !phone) return res.status(400).json({ error: 'Ism va telefon raqami majburiy' });
    if (!token) return res.status(400).json({ error: 'Havola tokeni kiritilmagan yoki noto\'g\'ri' });

    // Validate the token
    const applyToken = await prisma.applyToken.findUnique({
      where: { id: token }
    });

    if (!applyToken || applyToken.used || applyToken.schoolId !== schoolId) {
      return res.status(400).json({ error: 'Ushbu ro\'yxatdan o\'tish havolasi eskirgan, noto\'g\'ri yoki allaqachon ishlatilgan.' });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    // Check duplicate lead
    const duplicateLead = await prisma.lead.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
        phone: cleanPhone,
        schoolId
      }
    });

    if (duplicateLead) {
      return res.status(400).json({ error: 'Siz kiritgan ism va telefon raqami bilan allaqachon ariza topshirilgan.' });
    }

    // Check duplicate student
    const duplicateStudent = await prisma.student.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
        phone: cleanPhone,
        schoolId
      }
    });

    if (duplicateStudent) {
      return res.status(400).json({ error: 'Siz kiritgan ma\'lumotlar bilan o\'quvchi allaqachon mavjud.' });
    }

    // Mark token as used
    await prisma.applyToken.update({
      where: { id: token },
      data: { used: true }
    });

    const lead = await prisma.lead.create({
      data: {
        name: cleanName,
        phone: cleanPhone,
        course: course || 'Aniqlanmagan',
        source: source || 'Bir martalik QR Havola',
        status: 'Yangi',
        birthDate: birthDate || null,
        address: address || null,
        studentSchool: studentSchool || null,
        fatherName: fatherName || null,
        fatherPhone: fatherPhone || null,
        motherName: motherName || null,
        motherPhone: motherPhone || null,
        preferredTime: preferredTime || null,
        notes: notes || null,
        photo: photo || null,
        schoolId
      }
    });

    notifyAdmins(`🆕 Bir martalik QR Formadan yangi ariza:\n👤 ${lead.name}\n📞 ${lead.phone}\n📚 Kurs: ${lead.course}`, schoolId);
    res.json({ success: true, id: lead.id });
  } catch (error) { next(error); }
});

app.put('/api/leads/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    const lead = await prisma.lead.update({ where: { id: parseInt(id) }, data });
    res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
  } catch (error) { next(error); }
});

app.delete('/api/leads/:id', authenticate, async (req, res, next) => {
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
app.post('/api/payments', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.amount) data.amount = parseFloat(data.amount);
    if (data.studentId) data.studentId = parseInt(data.studentId);
    const payment = await prisma.payment.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    await prisma.student.update({
      where: { id: payment.studentId },
      data: { balance: { increment: payment.amount } }
    });
    res.json(payment);
  } catch (error) { next(error); }
});

// Expenses
app.get('/api/expenses', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const expenses = await prisma.expense.findMany({ where: { schoolId: parseInt(schoolId) } });
    res.json(expenses);
  } catch (error) { next(error); }
});

app.post('/api/expenses', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.amount) data.amount = parseFloat(data.amount);
    const expense = await prisma.expense.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    res.json(expense);
  } catch (error) { next(error); }
});

app.delete('/api/expenses/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Transports
app.get('/api/transports', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const transports = await prisma.transport.findMany({ where: { schoolId: parseInt(schoolId) } });
    res.json(transports);
  } catch (error) { next(error); }
});

app.post('/api/transports', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.capacity) data.capacity = parseInt(data.capacity);
    const transport = await prisma.transport.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    res.json(transport);
  } catch (error) { next(error); }
});

app.put('/api/transports/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.capacity) data.capacity = parseInt(data.capacity);
    if (data.schoolId) data.schoolId = parseInt(data.schoolId);
    const transport = await prisma.transport.update({ where: { id: parseInt(id) }, data });
    res.json(transport);
  } catch (error) { next(error); }
});

app.delete('/api/transports/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.transport.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Specific Types API
app.get('/api/courses', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    res.json(await prisma.course.findMany({ where: { schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});
app.post('/api/courses', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.price) data.price = parseFloat(data.price);
    res.json(await prisma.course.create({ data: { ...data, schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});
app.delete('/api/courses/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: parseInt(req.params.id) } });
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

app.post('/api/rooms', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.capacity) data.capacity = parseInt(data.capacity);
    res.json(await prisma.room.create({ data: { ...data, schoolId: parseInt(schoolId) } }));
  } catch (error) { next(error); }
});

app.delete('/api/rooms/:id', authenticate, async (req, res, next) => {
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
      settings, attendances, scores, teacherAttendances, expenses,
      transports, routes, users, questions, exams, examResults, schools
    ] = await Promise.all([
      prisma.student.findMany({
        where: whereQuery,
        include: { groups: { select: { id: true } } }
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
      prisma.attendance.findMany({ where: whereQuery }),
      prisma.score.findMany({ where: whereQuery }),
      prisma.teacherAttendance.findMany({ where: whereQuery }),
      prisma.expense.findMany({ where: whereQuery }),
      prisma.transport.findMany({
        where: whereQuery,
        include: { driver: true }
      }),
      prisma.route.findMany({
        where: whereQuery,
        include: {
          transport: true,
          driver: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.user.findMany({ where: whereQuery }),
      prisma.question.findMany({ where: whereQuery }),
      prisma.exam.findMany({ where: whereQuery }),
      prisma.examResult.findMany({ where: whereQuery }),
      prisma.school.findMany({ where: schoolsWhere }),
    ]);

    // Map relations to flat IDs / names just like individual endpoints do
    const mappedStudents = students.map(s => ({
      ...s,
      groups: s.groups.map(g => g.id)
    }));
    const mappedGroups = groups.map(g => ({
      ...g,
      studentIds: g.students.map(s => s.id),
      courseName: g.course?.name
    }));

    res.json({
      students: mappedStudents,
      teachers,
      groups: mappedGroups,
      leads, payments, courses, rooms,
      settings, attendances, scores, teacherAttendances, expenses,
      transports, routes, users, questions, exams, examResults, schools
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

    // Cascade delete related records to avoid database foreign key violations
    await prisma.$transaction([
      prisma.student.deleteMany({ where: { schoolId } }),
      prisma.teacher.deleteMany({ where: { schoolId } }),
      prisma.group.deleteMany({ where: { schoolId } }),
      prisma.lead.deleteMany({ where: { schoolId } }),
      prisma.payment.deleteMany({ where: { schoolId } }),
      prisma.course.deleteMany({ where: { schoolId } }),
      prisma.room.deleteMany({ where: { schoolId } }),
      prisma.setting.deleteMany({ where: { schoolId } }),
      prisma.user.deleteMany({ where: { schoolId } }),
      prisma.school.delete({ where: { id: schoolId } })
    ]);

    res.json({ success: true });
  } catch (error) { next(error); }
});


// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Serverda xatolik yuz berdi',
    message: err.message,
    code: err.code
  });
});

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
    res.json(settings);
  } catch (error) { next(error); }
});

app.put('/api/settings', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

    const settings = await prisma.setting.upsert({
      where: { schoolId: parseInt(schoolId) },
      update: data,
      create: { ...data, schoolId: parseInt(schoolId) }
    });
    res.json(settings);
  } catch (error) { next(error); }
});

// Attendances
app.get('/api/attendances', authenticate, async (req, res, next) => {
  try {
    const { schoolId, studentId, groupId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

    let where = { schoolId: parseInt(schoolId) };
    if (studentId) where.studentId = parseInt(studentId);
    if (groupId) where.groupId = parseInt(groupId);

    const attendances = await prisma.attendance.findMany({ where });
    res.json(attendances);
  } catch (error) { next(error); }
});
app.post('/api/attendances', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const attendance = await prisma.attendance.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    
    // Telegram Notification
    try {
      const student = await prisma.student.findUnique({ where: { id: parseInt(data.studentId) } });
      if (student && student.telegramId) {
        const icon = attendance.status === 'Keldi' ? '✅' : (attendance.status === 'Kelmapdi' ? '❌' : '⚠️');
        bot.telegram.sendMessage(student.telegramId, 
          `${icon} Davomat xabarnomasi:\n\n` +
          `👤 O'quvchi: ${student.name}\n` +
          `📌 Holat: ${attendance.status}\n` +
          `📅 Sana: ${attendance.date}`
        ).catch(e => console.error('Telegram error:', e));
      }
    } catch (e) {
      console.error('Notification error:', e);
    }

    res.json(attendance);
  } catch (error) { next(error); }
});

// Batch attendance — mark all students at once for a group/date
app.post('/api/attendances/batch', authenticate, async (req, res, next) => {
  try {
    const { schoolId, groupId, date, records } = req.body;
    if (!schoolId || !groupId || !date || !records) return res.status(400).json({ error: 'Missing fields' });
    
    const results = [];
    const group = await prisma.group.findUnique({ where: { id: parseInt(groupId) } });

    for (const record of records) {
      const existing = await prisma.attendance.findFirst({
        where: { studentId: record.studentId, groupId: parseInt(groupId), date, schoolId: parseInt(schoolId) }
      });
      let updatedOrCreated;
      let shouldNotify = false;

      if (existing) {
        if (existing.status !== record.status) {
          updatedOrCreated = await prisma.attendance.update({
            where: { id: existing.id },
            data: { status: record.status }
          });
          shouldNotify = true;
        } else {
          updatedOrCreated = existing;
        }
      } else {
        updatedOrCreated = await prisma.attendance.create({
          data: { studentId: record.studentId, groupId: parseInt(groupId), date, status: record.status, schoolId: parseInt(schoolId) }
        });
        shouldNotify = true;
      }
      results.push(updatedOrCreated);

      // Telegram notification for batch attendance
      if (shouldNotify) {
        try {
          const student = await prisma.student.findUnique({ where: { id: record.studentId } });
          if (student && student.telegramId) {
            const icon = record.status === 'Keldi' ? '✅' : (record.status === 'Kelmapdi' ? '❌' : '⚠️');
            bot.telegram.sendMessage(student.telegramId, 
              `${icon} Davomat xabarnomasi:\n\n` +
              `👤 O'quvchi: ${student.name}\n` +
              `📌 Holat: ${record.status}\n` +
              `📅 Sana: ${date}\n` +
              `📚 Guruh: ${group ? group.name : ''}`
            ).catch(e => console.error('[Telegram Batch Notify] Error sending message:', e));
          }
        } catch (e) {
          console.error('[Telegram Batch Notify] Error:', e);
        }
      }
    }
    res.json(results);
  } catch (error) { next(error); }
});

app.delete('/api/attendances/batch', authenticate, async (req, res, next) => {
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
app.get('/api/transports', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const transports = await prisma.transport.findMany({ 
      where: { schoolId: parseInt(schoolId) },
      include: { driver: true }
    });
    res.json(transports);
  } catch (error) { next(error); }
});
app.post('/api/transports', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.capacity) data.capacity = parseInt(data.capacity);
    if (data.driverId) data.driverId = parseInt(data.driverId);
    const transport = await prisma.transport.create({ 
      data: { ...data, schoolId: parseInt(schoolId) },
      include: { driver: true }
    });
    res.json(transport);
  } catch (error) { next(error); }
});
app.put('/api/transports/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.capacity) data.capacity = parseInt(data.capacity);
    if (data.driverId !== undefined) data.driverId = data.driverId ? parseInt(data.driverId) : null;
    delete data.schoolId;
    const transport = await prisma.transport.update({ 
      where: { id: parseInt(id) }, 
      data,
      include: { driver: true }
    });
    res.json(transport);
  } catch (error) { next(error); }
});
app.delete('/api/transports/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
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

// ========== MARSHRUT ROUTES (LOGISTICS) ==========
app.get('/api/routes', authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const routes = await prisma.route.findMany({ 
      where: { schoolId: parseInt(schoolId) },
      include: {
        transport: true,
        driver: { select: { id: true, name: true, phone: true } }
      }
    });
    res.json(routes);
  } catch (error) { next(error); }
});

app.post('/api/routes', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const route = await prisma.route.create({ 
      data: { ...data, schoolId: parseInt(schoolId) },
      include: {
        transport: true,
        driver: { select: { id: true, name: true, phone: true } }
      }
    });
    res.json(route);
  } catch (error) { next(error); }
});

app.put('/api/routes/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { schoolId, ...data } = req.body;
    const route = await prisma.route.update({ 
      where: { id: parseInt(id) }, 
      data,
      include: {
        transport: true,
        driver: { select: { id: true, name: true, phone: true } }
      }
    });
    res.json(route);
  } catch (error) { next(error); }
});

app.delete('/api/routes/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.route.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ========== DELIVERY LOG ROUTES ==========
app.get('/api/delivery-logs', authenticate, async (req, res, next) => {
  try {
    const { schoolId, date } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const where = { schoolId: parseInt(schoolId) };
    if (date) where.date = date;
    const logs = await prisma.deliveryLog.findMany({ where });
    res.json(logs);
  } catch (error) { next(error); }
});
app.post('/api/delivery-logs', authenticate, async (req, res, next) => {
  try {
    const { schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    if (data.transportId) data.transportId = parseInt(data.transportId);
    if (data.studentId) data.studentId = parseInt(data.studentId);
    const existing = await prisma.deliveryLog.findFirst({ where: { studentId: data.studentId, date: data.date, schoolId: parseInt(schoolId) } });
    if (existing) {
      const updated = await prisma.deliveryLog.update({ where: { id: existing.id }, data: { status: data.status, transportId: data.transportId } });
      return res.json(updated);
    }
    const log = await prisma.deliveryLog.create({ data: { ...data, schoolId: parseInt(schoolId) } });
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

let eskizToken = null;
let eskizTokenExpiry = null;

async function getEskizToken() {
  if (eskizToken && eskizTokenExpiry && Date.now() < eskizTokenExpiry) {
    return eskizToken;
  }
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  if (!email || !password) throw new Error('ESKIZ_EMAIL yoki ESKIZ_PASSWORD .env da yo\'q');

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
        eskizToken = data.data.token;
        eskizTokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
        console.log(`[Eskiz] Token muvaffaqiyatli olindi (Source: ${url})`);
        return eskizToken;
      }
      console.warn(`[Eskiz] ${url} muvaffaqiyatsiz:`, JSON.stringify(data));
      lastError = data.message || JSON.stringify(data);
    } catch (err) {
      console.error(`[Eskiz] ${url} xatosi: ${err.name === 'AbortError' ? 'Timeout' : err.message}`);
      lastError = err.name === 'AbortError' ? 'Ulanishda kutish vaqti tugadi (Timeout)' : err.message;
    }
  }

  throw new Error('Eskiz token olish barcha endpointlarda muvaffaqiyatsiz tugadi: ' + lastError);
}

// Ota-ona raqamini aniqlash yordamchisi
function resolveRecipientPhone(student) {
  return student.fatherPhone || student.motherPhone || student.phone;
}

// Bitta raqamga SMS yuborish
async function sendSms(phone, message, type, studentId, schoolId) {
  const from = process.env.ESKIZ_FROM || '4546';
  try {
    const token = await getEskizToken();
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
          studentId: studentId || null, errorMsg: err.message, schoolId
        }
      });
    } catch (_) {}
    return { success: false, error: err.message };
  }
}

// API: Bitta SMS yuborish (qo'lda)
app.post('/api/sms/send', authenticate, async (req, res, next) => {
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
        await bot.telegram.sendMessage(student.telegramId, message);
        telegramSent = true;
      } catch (tgErr) {
        console.error('[Telegram Manual Send] Error sending to student:', tgErr.message);
      }
    }

    const result = await sendSms(phone, message, type || 'MANUAL', studentId ? Number(studentId) : null, req.user.schoolId);
    res.json({ ...result, telegramSent });
  } catch (err) { next(err); }
});

// API: Davomatga kelmagan o'quvchilarga SMS yuborish
app.post('/api/sms/attendance', authenticate, async (req, res, next) => {
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
    const token = await getEskizToken();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'Eskiz API muvaffaqiyatli bog\'landi', token });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== END ESKIZ SMS ====================

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
    const { text, imageUrl, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic, schoolId } = req.body;
    if (!text || !optionA || !optionB || !optionC || !optionD || !correctAnswer || !subject || !topic || !schoolId) {
      return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }
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
    const { text, imageUrl, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic } = req.body;
    const question = await prisma.question.update({
      where: { id },
      data: { text, imageUrl: imageUrl || null, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic }
    });
    res.json(question);
  } catch (err) { next(err); }
});

app.delete('/api/questions/:id', authenticate, async (req, res, next) => {
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

app.delete('/api/exams/:id', authenticate, async (req, res, next) => {
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

app.delete('/api/exam-results/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.examResult.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Upload endpoint — Supabase Storage
app.post('/api/upload', authenticate, async (req, res, next) => {
  try {
    const { data, filename } = req.body; // data: base64 string, filename: original name
    if (!data || !filename) return res.status(400).json({ error: 'data va filename required' });

    const ext = filename.split('.').pop() || 'jpg';
    const uniqueName = `q_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const base64Data = data.replace(/^data:image\/[\w+]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

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

// Serve static React files
app.use('/uploads', express.static(join(__dirname, 'public', 'uploads')));
app.use(express.static(join(__dirname, 'dist')));

// Handle React Router SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
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
