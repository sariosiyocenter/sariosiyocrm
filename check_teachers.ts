import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ where: { role: 'TEACHER' } });
  const teachers = await prisma.teacher.findMany();

  console.log('JSON_START');
  console.log(JSON.stringify({
    users: users.map(u => ({ id: u.id, name: u.name, schoolId: u.schoolId })),
    teachers: teachers.map(t => ({ id: t.id, name: t.name, schoolId: t.schoolId }))
  }, null, 2));
  console.log('JSON_END');

  await prisma.$disconnect();
}

check();
