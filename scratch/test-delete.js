import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all templates...');
  const templates = await prisma.messageTemplate.findMany();
  console.log('Templates in DB:', templates);

  if (templates.length > 0) {
    const targetId = templates[0].id;
    console.log(`Attempting to delete template with ID: ${targetId}...`);
    try {
      const deleted = await prisma.messageTemplate.delete({
        where: { id: targetId }
      });
      console.log('Successfully deleted:', deleted);
    } catch (error) {
      console.error('Delete failed with error:', error);
    }
  } else {
    console.log('No templates found to delete.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
