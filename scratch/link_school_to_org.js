import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { id: 'asc' }
  });

  if (!org) {
    console.log('No organization found. Creating a default one...');
    const newOrg = await prisma.organization.create({
      data: {
        name: "Sariosiyo o'quv markazi",
        status: "Faol",
        maxSchools: 3
      }
    });
    console.log('Created organization:', newOrg);
    
    // Link all orphan schools to this new organization
    const updated = await prisma.school.updateMany({
      where: { organizationId: null },
      data: { organizationId: newOrg.id }
    });
    console.log(`Linked ${updated.count} schools to organization ID ${newOrg.id}`);
  } else {
    console.log('Found organization:', org);
    const updated = await prisma.school.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id }
    });
    console.log(`Linked ${updated.count} schools to organization ID ${org.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
