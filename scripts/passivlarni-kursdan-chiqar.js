// O'qimaydigan holatdagi (Passiv, Muzlatilgan, Arxiv, Bitiruvchi,
// Sertifikatli) o'quvchilarni kurslaridan chiqarish — bir martalik.
//
// Egasi (2026-09-29): "passiv qilingan o'quvchi kurs ro'yxatida qolib
// ketayapdi". Endi holat o'zgarganda server o'quvchini kurslardan o'zi
// chiqaradi (lib/oquvchiHolati.js, PUT /api/students/:id). Bu skript shu
// qoidadan OLDIN Passiv qilingan va kursda qolib ketganlar uchun.
// Pulga tegilmaydi — qarz joyida qoladi. Har biri uchun amallar jurnaliga
// "Kurslar: … → —" yoziladi.
//
//   node scripts/passivlarni-kursdan-chiqar.js          — faqat ko'rsatadi
//   node scripts/passivlarni-kursdan-chiqar.js --apply  — yozadi
//
// Qayta ishga tushirilsa hech narsa qilmaydi.

import prisma from '../lib/prisma.js';
import { OQIYDIGAN_HOLATLAR } from '../lib/oquvchiHolati.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const students = await prisma.student.findMany({
    where: { status: { notIn: OQIYDIGAN_HOLATLAR }, groups: { some: {} } },
    select: { id: true, name: true, status: true, schoolId: true, groups: { select: { id: true, name: true } } },
    orderBy: { id: 'asc' },
  });
  if (!students.length) { console.log("Kursda qolib ketgan o'qimaydigan o'quvchi yo'q."); return; }
  for (const s of students) {
    console.log(`${s.status.padEnd(12)} #${s.id} ${s.name} — ${s.groups.map(g => g.name).join(', ')}`);
  }
  if (!APPLY) { console.log(`\n${students.length} ta. Yozish uchun: --apply`); return; }
  for (const s of students) {
    await prisma.$transaction([
      prisma.student.update({ where: { id: s.id }, data: { groups: { set: [] } } }),
      prisma.auditLog.create({
        data: {
          userName: 'Tizim', action: 'update', entity: 'student', entityId: s.id, title: s.name,
          summary: `${s.status} — kursdan chiqarildi`,
          changes: [{ field: 'groups', label: 'Kurslar', from: s.groups.map(g => g.name).join(', '), to: '—' }],
          link: `/students/${s.id}`, schoolId: s.schoolId,
          method: 'SCRIPT', path: 'scripts/passivlarni-kursdan-chiqar.js',
        },
      }),
    ]);
  }
  console.log(`\n${students.length} ta o'quvchi kurslardan chiqarildi.`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
