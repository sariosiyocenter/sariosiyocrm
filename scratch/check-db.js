import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- TOPICS ---');
  const topics = await prisma.topic.findMany();
  console.log(JSON.stringify(topics, null, 2));

  console.log('\n--- ATTENDANCES ---');
  const attendances = await prisma.attendance.findMany();
  console.log(JSON.stringify(attendances, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
