import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@sariosiyo.uz';
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    console.log('User found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Password hash:', user.password);
  } else {
    console.log('User admin@sariosiyo.uz NOT found in database.');
    const allUsers = await prisma.user.findMany({ take: 5 });
    console.log('Existing users (first 5):', allUsers.map(u => ({ email: u.email, role: u.role })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
