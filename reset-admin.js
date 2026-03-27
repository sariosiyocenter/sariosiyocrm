import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@sariosiyo.uz';
  const newPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword }
  });

  console.log(`Password for ${email} has been reset to: ${newPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
