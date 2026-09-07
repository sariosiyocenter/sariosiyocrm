/**
 * Ustoz yozuvlarini (Teacher) xodim yozuvlari (User) bilan bog'laydi.
 *
 * Ilgari ular faqat ism bo'yicha topishardi va xodim yozuvi bo'lmagan ustoz
 * "yarim odam" bo'lib qolardi: profili boshqacha ochilar, oylik berib
 * bo'lmasdi, davomat ham, Telegram xabari ham yo'q edi. Server bu ishni
 * birinchi /api/init da o'zi ham bajaradi; bu skript qo'lda ishga tushirish uchun:
 *
 *   node scripts/link-teachers.js
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const bogsizlar = await prisma.teacher.findMany({ where: { userId: null } });
  console.log("Xodim yozuvi yo'q ustozlar:", bogsizlar.length);

  let boglandi = 0, yaratildi = 0;
  for (const ustoz of bogsizlar) {
    const mavjud = await prisma.user.findFirst({
      where: { name: ustoz.name, schoolId: ustoz.schoolId, teacherProfile: { is: null } }
    });
    if (mavjud) {
      await prisma.teacher.update({ where: { id: ustoz.id }, data: { userId: mavjud.id } });
      console.log("  bog'landi:", ustoz.name, '-> user', mavjud.id);
      boglandi++;
      continue;
    }
    const belgi = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const user = await prisma.user.create({
      data: {
        email: 'ustoz_' + ustoz.id + '_' + belgi + '@internal.local',
        password: await bcrypt.hash(Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), 10),
        name: ustoz.name,
        phone: ustoz.phone || null,
        photo: ustoz.photo || null,
        position: "O'qituvchi",
        salary: Math.round(Number(ustoz.salary) || 0),
        kpiPercent: Math.round(Number(ustoz.sharePercentage) || 0),
        role: 'TEACHER',
        status: ustoz.status === 'Arxiv' ? 'Arxiv' : 'Faol',
        schoolId: ustoz.schoolId
      }
    });
    await prisma.teacher.update({ where: { id: ustoz.id }, data: { userId: user.id } });
    console.log('  yaratildi:', ustoz.name, '-> user', user.id);
    yaratildi++;
  }

  // Ustoz yozuvi yo'q o'qituvchi-xodimlar.
  const xodimlar = await prisma.user.findMany({
    where: { role: { in: ['TEACHER', 'SUPPORT_TEACHER'] }, schoolId: { not: null }, teacherProfile: { is: null } }
  });
  for (const x of xodimlar) {
    await prisma.teacher.create({
      data: {
        name: x.name, phone: x.phone || '', salary: x.salary || 0,
        sharePercentage: x.kpiPercent || 0, lessonFee: 0, birthDate: '',
        hiredDate: new Date().toISOString().split('T')[0],
        status: x.status === 'Arxiv' ? 'Arxiv' : 'Faol',
        schoolId: x.schoolId, userId: x.id
      }
    });
    console.log('  ustoz yozuvi ochildi:', x.name);
    yaratildi++;
  }

  console.log("Tayyor. Bog'landi: " + boglandi + ', yaratildi: ' + yaratildi);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
