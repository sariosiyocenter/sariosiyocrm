import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const { groups, schoolId, ...data } = req.body;
    await prisma.student.update({ where: { id: parseInt(id) }, data });
    if (groups) {
      await prisma.student.update({
        where: { id: parseInt(id) },
        data: { groups: { set: groups.map(gId => ({ id: gId })) } }
      });
    }
    const updatedStudent = await prisma.student.findUnique({ where: { id: parseInt(id) }, include: { groups: { select: { id: true } } } });
    res.json({ ...updatedStudent, groups: updatedStudent.groups.map(g => g.id) });
  } catch (error) { next(error); }
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
      include: { students: { select: { id: true } } }
    });
    res.json(groups.map(g => ({ ...g, studentIds: g.students.map(s => s.id) })));
  } catch (error) { next(error); }
});
app.post('/api/groups', authenticate, async (req, res, next) => {
  try {
    const { studentIds, schoolId, ...data } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    
    // Defensive parsing for numeric fields
    if (data.teacherId) data.teacherId = parseInt(data.teacherId);
    if (data.courseId) data.courseId = parseInt(data.courseId);
    if (data.room !== undefined && data.room !== null && data.room !== '') {
      data.room = parseInt(data.room);
    } else {
      delete data.room; // Prisma might fail on empty string
    }

    const group = await prisma.group.create({ data: { ...data, schoolId: parseInt(schoolId) } });
    if (studentIds && studentIds.length > 0) {
      await prisma.group.update({
        where: { id: group.id },
        data: { students: { connect: studentIds.map(id => ({ id })) } }
      });
    }
    const updatedGroup = await prisma.group.findUnique({ where: { id: group.id }, include: { students: { select: { id: true } } } });
    res.json({ ...updatedGroup, studentIds: updatedGroup.students.map(s => s.id) });
  } catch (error) { next(error); }
});
app.put('/api/groups/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentIds, ...data } = req.body;

    // Defensive parsing for numeric fields
    if (data.teacherId) data.teacherId = parseInt(data.teacherId);
    if (data.courseId) data.courseId = parseInt(data.courseId);
    if (data.room !== undefined && data.room !== null && data.room !== '') {
      data.room = parseInt(data.room);
    } else if (data.hasOwnProperty('room')) {
      data.room = null;
    }

    await prisma.group.update({ where: { id: parseInt(id) }, data });
    if (studentIds) {
      await prisma.group.update({
        where: { id: parseInt(id) },
        data: { students: { set: studentIds.map(sId => ({ id: sId })) } }
      });
    }
    const updatedGroup = await prisma.group.findUnique({ where: { id: parseInt(id) }, include: { students: { select: { id: true } } } });
    res.json({ ...updatedGroup, studentIds: updatedGroup.students.map(s => s.id) });
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
    const lead = await prisma.lead.create({ data: { ...data, schoolId: parseInt(schoolId) } });
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

// Serve static React files
app.use(express.static(join(__dirname, 'dist')));

// Handle React Router SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
