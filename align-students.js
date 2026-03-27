import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const students = await prisma.student.findMany({
    select: { id: true, name: true, schoolId: true }
  });
  console.log('Students:', JSON.stringify(students, null, 2));
  const school = await prisma.school.findFirst();
  if (school) {
    for (const s of students) {
        if (s.schoolId !== school.id) {
            await prisma.student.update({
                where: { id: s.id },
                data: { schoolId: school.id }
            });
            console.log('Updated student', s.id, 'to schoolId', school.id);
        }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
