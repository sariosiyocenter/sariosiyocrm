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
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email yoki parol xato' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// --- User Management (Admin only) ---
app.get('/api/users', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Ruhsat yo' });
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } });
  res.json(users);
});

app.post('/api/users', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Ruhsat yo' });
  const { email, password, name, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role }
  });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// --- API Routes ---

// Students
app.get('/api/students', async (req, res) => {
  const students = await prisma.student.findMany({ include: { groups: { select: { id: true } } } });
  res.json(students.map(s => ({ ...s, groups: s.groups.map(g => g.id) })));
});
app.post('/api/students', async (req, res) => {
  const { groups, ...data } = req.body;
  const student = await prisma.student.create({ data });
  if (groups && groups.length > 0) {
    await prisma.student.update({
      where: { id: student.id },
      data: { groups: { connect: groups.map(id => ({ id })) } }
    });
  }
  const updatedStudent = await prisma.student.findUnique({ where: { id: student.id }, include: { groups: { select: { id: true } } } });
  res.json({ ...updatedStudent, groups: updatedStudent.groups.map(g => g.id) });
});
app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  const { groups, ...data } = req.body;
  await prisma.student.update({ where: { id: parseInt(id) }, data });
  if (groups) {
    await prisma.student.update({
      where: { id: parseInt(id) },
      data: { groups: { set: groups.map(gId => ({ id: gId })) } }
    });
  }
  const updatedStudent = await prisma.student.findUnique({ where: { id: parseInt(id) }, include: { groups: { select: { id: true } } } });
  res.json({ ...updatedStudent, groups: updatedStudent.groups.map(g => g.id) });
});
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.student.delete({ where: { id: parseInt(id) } });
  res.json({ success: true });
});

// Teachers
app.get('/api/teachers', async (req, res) => {
  const teachers = await prisma.teacher.findMany();
  res.json(teachers);
});
app.post('/api/teachers', async (req, res) => {
  const teacher = await prisma.teacher.create({ data: req.body });
  res.json(teacher);
});
app.put('/api/teachers/:id', async (req, res) => {
  const { id } = req.params;
  const teacher = await prisma.teacher.update({ where: { id: parseInt(id) }, data: req.body });
  res.json(teacher);
});
app.delete('/api/teachers/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.teacher.delete({ where: { id: parseInt(id) } });
  res.json({ success: true });
});

// Groups
app.get('/api/groups', async (req, res) => {
  const groups = await prisma.group.findMany({ include: { students: { select: { id: true } } } });
  res.json(groups.map(g => ({ ...g, studentIds: g.students.map(s => s.id) })));
});
app.post('/api/groups', async (req, res) => {
  const { studentIds, ...data } = req.body;
  const group = await prisma.group.create({ data });
  if (studentIds && studentIds.length > 0) {
    await prisma.group.update({
      where: { id: group.id },
      data: { students: { connect: studentIds.map(id => ({ id })) } }
    });
  }
  const updatedGroup = await prisma.group.findUnique({ where: { id: group.id }, include: { students: { select: { id: true } } } });
  res.json({ ...updatedGroup, studentIds: updatedGroup.students.map(s => s.id) });
});
app.put('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  const { studentIds, ...data } = req.body;
  await prisma.group.update({ where: { id: parseInt(id) }, data });
  if (studentIds) {
    await prisma.group.update({
      where: { id: parseInt(id) },
      data: { students: { set: studentIds.map(sId => ({ id: sId })) } }
    });
  }
  const updatedGroup = await prisma.group.findUnique({ where: { id: parseInt(id) }, include: { students: { select: { id: true } } } });
  res.json({ ...updatedGroup, studentIds: updatedGroup.students.map(s => s.id) });
});

// Leads
app.get('/api/leads', async (req, res) => {
  const leads = await prisma.lead.findMany();
  res.json(leads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
});
app.post('/api/leads', async (req, res) => {
  // Allow client to send createdAt string
  const data = { ...req.body };
  if (data.createdAt) data.createdAt = new Date(data.createdAt);
  const lead = await prisma.lead.create({ data });
  res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
});
app.put('/api/leads/:id', async (req, res) => {
  const { id } = req.params;
  const data = { ...req.body };
  if (data.createdAt) data.createdAt = new Date(data.createdAt);
  const lead = await prisma.lead.update({ where: { id: parseInt(id) }, data });
  res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
});

// Payments
app.get('/api/payments', async (req, res) => {
  const payments = await prisma.payment.findMany();
  res.json(payments);
});
app.post('/api/payments', async (req, res) => {
  const payment = await prisma.payment.create({ data: req.body });
  await prisma.student.update({
    where: { id: payment.studentId },
    data: { balance: { increment: payment.amount } }
  });
  res.json(payment);
});

// Specific Types API
app.get('/api/courses', async (req, res) => res.json(await prisma.course.findMany()));
app.post('/api/courses', async (req, res) => res.json(await prisma.course.create({ data: req.body })));
app.delete('/api/courses/:id', async (req, res) => {
  await prisma.course.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/rooms', async (req, res) => res.json(await prisma.room.findMany()));
app.post('/api/rooms', async (req, res) => res.json(await prisma.room.create({ data: req.body })));
app.delete('/api/rooms/:id', async (req, res) => {
  await prisma.room.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/schools', async (req, res) => res.json(await prisma.school.findMany()));
app.post('/api/schools', async (req, res) => res.json(await prisma.school.create({ data: req.body })));
app.delete('/api/schools/:id', async (req, res) => {
  await prisma.school.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Settings
app.get('/api/settings', async (req, res) => {
  let settings = await prisma.setting.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.setting.create({
      data: { paymentMethods: "Naqd,Karta,Peyme,Klik" }
    });
  }
  res.json({ ...settings, paymentMethods: settings.paymentMethods.split(',') });
});

app.put('/api/settings', async (req, res) => {
  const data = { ...req.body };
  if (data.paymentMethods) data.paymentMethods = data.paymentMethods.join(',');
  const settings = await prisma.setting.upsert({
    where: { id: "default" },
    update: data,
    create: { ...data, id: "default" }
  });
  res.json({ ...settings, paymentMethods: settings.paymentMethods.split(',') });
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
