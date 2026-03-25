import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import bot, { startBot, notifyAdmins } from './src/bot/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

if (process.env.TELEGRAM_BOT_TOKEN) {
  startBot();
} else {
  console.warn('TELEGRAM_BOT_TOKEN mavjud emas. Bot ishga tushmadi.');
}

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

app.use(express.json());

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

// --- Auth Routes ---
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email va parol kiritilishi shart' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email yoki parol xato' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, schoolId: user.schoolId }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId } });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
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
      where = { schoolId: req.user.schoolId };
      where.role = { not: 'ADMIN' };
    } else if (schoolId && !isNaN(parseInt(schoolId))) {
      where = { schoolId: parseInt(schoolId) };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, schoolId: true }
    });
    res.json(users);
  } catch (error) { next(error); }
});

app.post('/api/users', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Ruhsat yo' });

    const { email, password, name, phone, role, schoolId } = req.body;

    if (req.user.role === 'MANAGER' && (role === 'ADMIN' || role === 'MANAGER')) {
      return res.status(403).json({ error: 'Menejer faqat o\'qituvchi va resepshn qo\'sha oladi' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const targetSchoolId = req.user.role === 'MANAGER' ? req.user.schoolId : (schoolId ? parseInt(schoolId) : null);

    if (isNaN(targetSchoolId) && targetSchoolId !== null) return res.status(400).json({ error: 'Invalid schoolId' });

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        schoolId: targetSchoolId
      }
    });

    // Automatically create a Teacher profile if the role is TEACHER
    if (role === 'TEACHER') {
      try {
        // We MUST have a schoolId for a Teacher profile
        if (targetSchoolId) {
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
              schoolId: targetSchoolId
            }
          });
        }
      } catch (teacherError) {
        console.error('Failed to auto-create teacher profile:', teacherError);
      }
    }

    res.json(user);
  } catch (error) { next(error); }
});

app.put('/api/users/:id', authenticate, async (req, res, next) => {
  try {
    console.log(`PUT /api/users/${req.params.id} request from role: ${req.user.role}`);
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Faqat ADMIN tahrirlay oladi' });
    const { id } = req.params;
    const { email, name, phone, role, password } = req.body;
    const data = { email, name, phone, role };
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data
    });
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
app.put('/api/leads/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    const lead = await prisma.lead.update({ where: { id: parseInt(id) }, data });
    res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
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

// Delivery Logs
app.get('/api/delivery-logs', authenticate, async (req, res, next) => {
  try {
    const { schoolId, date } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    let where = { schoolId: parseInt(schoolId) };
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
    
    // Upsert logic for delivery logs
    const existing = await prisma.deliveryLog.findFirst({
      where: { studentId: data.studentId, date: data.date, schoolId: parseInt(schoolId) }
    });

    if (existing) {
      const updated = await prisma.deliveryLog.update({
        where: { id: existing.id },
        data: { status: data.status, transportId: data.transportId }
      });
      return res.json(updated);
    }

    const log = await prisma.deliveryLog.create({
      data: { ...data, schoolId: parseInt(schoolId) }
    });
    res.json(log);
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

app.get('/api/schools', async (req, res, next) => {
  try {
    res.json(await prisma.school.findMany());
  } catch (error) { next(error); }
});
app.post('/api/schools', async (req, res, next) => {
  try {
    res.json(await prisma.school.create({ data: req.body }));
  } catch (error) { next(error); }
});
app.delete('/api/schools/:id', async (req, res, next) => {
  try {
    await prisma.school.delete({ where: { id: parseInt(req.params.id) } });
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
        data: { schoolId: parseInt(schoolId), orgName: "SARIOSIYO" }
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
    
    // Telegram Notification for Student/Parent
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
    } catch (e) { console.error('Notification error:', e); }

    res.json(attendance);
  } catch (error) { next(error); }
});

// Batch attendance — mark all students at once for a group/date
app.post('/api/attendances/batch', authenticate, async (req, res, next) => {
  try {
    const { schoolId, groupId, date, records } = req.body;
    if (!schoolId || !groupId || !date || !records) return res.status(400).json({ error: 'Missing fields' });
    
    const results = [];
    for (const record of records) {
      const existing = await prisma.attendance.findFirst({
        where: { studentId: record.studentId, groupId: parseInt(groupId), date, schoolId: parseInt(schoolId) }
      });
      if (existing) {
        const updated = await prisma.attendance.update({
          where: { id: existing.id },
          data: { status: record.status }
        });
        results.push(updated);
      } else {
        const created = await prisma.attendance.create({
          data: { studentId: record.studentId, groupId: parseInt(groupId), date, status: record.status, schoolId: parseInt(schoolId) }
        });
        results.push(created);
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


// ========== TRANSPORT ROUTES ==========
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
    delete data.schoolId;
    const transport = await prisma.transport.update({ where: { id: parseInt(id) }, data });
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
// Serve static React files
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
