import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all attendance records...');
  const attendances = await prisma.attendance.findMany();
  console.log(`Loaded ${attendances.length} records.`);

  const groups = {};
  for (const att of attendances) {
    const key = `${att.studentId}_${att.groupId}_${att.date}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(att);
  }

  const duplicatesToDelete = [];
  let duplicateCount = 0;

  for (const key in groups) {
    const records = groups[key];
    if (records.length > 1) {
      // Sort by ID ascending (lowest ID first)
      records.sort((a, b) => a.id - b.id);
      
      // Keep the last record (most recent status), delete all previous ones
      const toKeep = records[records.length - 1];
      const toDelete = records.slice(0, records.length - 1);
      
      console.log(`Duplicate found for key ${key}: keeping ID ${toKeep.id}, deleting IDs: ${toDelete.map(r => r.id).join(', ')}`);
      duplicatesToDelete.push(...toDelete.map(r => r.id));
      duplicateCount += toDelete.length;
    }
  }

  if (duplicatesToDelete.length > 0) {
    console.log(`Deleting ${duplicatesToDelete.length} duplicate records...`);
    const deleteResult = await prisma.attendance.deleteMany({
      where: {
        id: {
          in: duplicatesToDelete
        }
      }
    });
    console.log(`Successfully deleted ${deleteResult.count} records.`);
  } else {
    console.log('No duplicate attendance records found.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
