// DEMO guruh va sinov o'quvchisini oylik hisobdan chiqarish.
//
// "DEMO Kechki guruh" (id 23) logistika demosi uchun yaratilgan, lekin unga
// 20 ta haqiqiy o'quvchi a'zo qilingan. Oylik hisob (1-kundagi cron yoki
// Moliya sahifasi ochilganda /api/billing/status) ularning har biriga demo
// guruh uchun kurs narxini (50 000) yozib qo'yadi. 2026-09-11 da shunday
// bo'lib, 24 qator qaytarildi.
//
// Skript demo guruh a'zolariga shu guruh uchun narxni 0 qiladi
// (Student.customPrices["23"] = 0 — processMonthlyBilling 0 narxni o'tkazib
// yuboradi), demo esa saqlanadi. "Sinovov Sinov" (id 299) test o'quvchisini
// esa "Sinov" holatiga o'tkazadi — sinov o'quvchisi hech qachon hisoblanmaydi.
//
//   node scripts/demo-guruh-bepul.js          — faqat ko'rsatadi
//   node scripts/demo-guruh-bepul.js --apply  — yozadi
//
// Qayta ishga tushirilsa hech narsa qilmaydi (allaqachon 0 / Sinov bo'lganlar
// o'tkazib yuboriladi).

import prisma from '../lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const DEMO_GROUP_ID = 23;
const TEST_STUDENT = { id: 299, name: 'Sinovov Sinov' };

async function main() {
  const group = await prisma.group.findUnique({
    where: { id: DEMO_GROUP_ID },
    select: { name: true, students: { select: { id: true, name: true, customPrices: true } } },
  });
  if (!group) { console.log(`Guruh ${DEMO_GROUP_ID} topilmadi`); return; }
  if (!group.name.startsWith('DEMO')) { console.log(`Guruh ${DEMO_GROUP_ID} DEMO emas: "${group.name}" — to'xtatildi`); return; }

  const todo = group.students.filter(s => {
    const cp = (s.customPrices && typeof s.customPrices === 'object' && !Array.isArray(s.customPrices)) ? s.customPrices : {};
    return cp[String(DEMO_GROUP_ID)] !== 0;
  });
  console.log(`"${group.name}": ${group.students.length} a'zo, narxi 0 qilinadigan: ${todo.length}`);
  for (const s of todo) console.log(`  ${s.id}  ${s.name}`);

  const test = await prisma.student.findUnique({ where: { id: TEST_STUDENT.id }, select: { name: true, status: true } });
  const testTodo = test && test.name === TEST_STUDENT.name && test.status !== 'Sinov';
  console.log(`Test o'quvchi ${TEST_STUDENT.id} (${test?.name || 'yo\'q'}): ${test ? test.status : '-'}${testTodo ? ' → Sinov' : ' (o\'zgarmaydi)'}`);

  if (!APPLY) { console.log('\n--apply berilmadi, hech narsa yozilmadi.'); return; }

  for (const s of todo) {
    const cp = (s.customPrices && typeof s.customPrices === 'object' && !Array.isArray(s.customPrices)) ? s.customPrices : {};
    await prisma.student.update({ where: { id: s.id }, data: { customPrices: { ...cp, [String(DEMO_GROUP_ID)]: 0 } } });
  }
  if (testTodo) await prisma.student.update({ where: { id: TEST_STUDENT.id }, data: { status: 'Sinov' } });
  console.log(`\nYozildi: ${todo.length} ta narx, ${testTodo ? 1 : 0} ta holat.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
