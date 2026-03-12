import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function sync() {
  const users = await prisma.user.findMany({ 
    where: { role: 'TEACHER', schoolId: { not: null } } 
  });
  
  console.log(`Found ${users.length} teacher users to check.`);
  
  let createdCount = 0;
  for (const user of users) {
    const existing = await prisma.teacher.findFirst({
      where: { name: user.name, schoolId: user.schoolId! }
    });
    
    if (!existing) {
      console.log(`Creating teacher profile for ${user.name}`);
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
          schoolId: user.schoolId!
        }
      });
      createdCount++;
    } else {
      console.log(`Teacher profile already exists for ${user.name}`);
    }
  }
  
  console.log(`Sync complete. Created ${createdCount} teacher profiles.`);
  await prisma.$disconnect();
}

sync();
