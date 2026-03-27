import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const school = await prisma.school.findFirst();
  const user = await prisma.user.findUnique({ where: { email: 'admin@sariosiyo.uz' } });
  console.log('User schoolId:', user.schoolId, 'First schoolId:', school.id);
  if (user.schoolId !== school.id) {
    await prisma.user.update({
        where: { email: 'admin@sariosiyo.uz' },
        data: { schoolId: school.id }
    });
    console.log('Updated user schoolId to', school.id);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
