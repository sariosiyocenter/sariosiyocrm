import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.student.count();
  console.log('STUDENT_COUNT:', count);
  if (count === 0) {
    const school = await prisma.school.findFirst();
    if (!school) {
        console.log('No school found, cannot create student');
        return;
    }
    const student = await prisma.student.create({
      data: {
        name: 'Test O\'quvchi',
        phone: '+998901234567',
        status: 'Faol',
        joinedDate: new Date().toISOString().split('T')[0],
        balance: 0,
        schoolId: school.id
      }
    });
    console.log('Created student:', student.id);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
