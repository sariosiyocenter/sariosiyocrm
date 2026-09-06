// Boshlang'ich qoldiq yozuvlari.
//
// O'quvchilar bazaga tayyor balans bilan kiritilgan (import), lekin o'sha
// balansni tashkil qilgan eski hisoblar yozuv sifatida yo'q: daftarda faqat
// to'lovlar bor, hisoblar esa 2026-sentabrdan boshlangan. Natijada
// Student.balance bilan Payment yozuvlarining yig'indisi 225 o'quvchida mos
// kelmaydi, taqsimlash (lib/allocation.js) esa yozuvlarga tayanadi.
//
// Bu skript har bir o'quvchi uchun farqni bitta "[BOSHLANG'ICH QOLDIQ]"
// yozuvi bilan yopadi (2026-08-31 sanasi bilan — sentabr hisobidan oldin).
// Shundan keyin: balans == yozuvlar yig'indisi.
//
//   node scripts/opening-balance.js          — faqat ko'rsatadi
//   node scripts/opening-balance.js --apply  — yozadi
//
// Qayta ishga tushirilsa hech narsa qilmaydi: farq nol bo'lganlar o'tkazib
// yuboriladi, farqi bor bo'lsa yangi tuzatish yozuvi qo'shiladi.

import prisma from '../lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const DATE = '2026-08-31';
const DESC = "[BOSHLANG'ICH QOLDIQ] 01.09.2026 holatiga ko'ra";

async function main() {
  const sums = await prisma.payment.groupBy({ by: ['studentId'], _sum: { amount: true } });
  const ledger = new Map(sums.map(s => [s.studentId, s._sum.amount || 0]));
  const students = await prisma.student.findMany({ select: { id: true, name: true, balance: true, schoolId: true, status: true } });

  const writes = [];
  for (const st of students) {
    const diff = Math.round(st.balance - (ledger.get(st.id) || 0));
    if (Math.abs(diff) < 1) continue;
    writes.push({
      studentId: st.id, amount: diff, type: 'Oylik', date: DATE,
      description: DESC, schoolId: st.schoolId, groupId: null, courseId: null,
      _name: st.name, _status: st.status,
    });
  }

  const debt = writes.filter(w => w.amount < 0);
  const credit = writes.filter(w => w.amount > 0);
  console.log(`O'quvchilar: ${students.length}, farqi borlar: ${writes.length}`);
  console.log(`  qarz bilan boshlaydi: ${debt.length} ta, jami ${Math.round(-debt.reduce((s, w) => s + w.amount, 0)).toLocaleString('ru-RU')} so'm`);
  console.log(`  avans bilan boshlaydi: ${credit.length} ta, jami ${Math.round(credit.reduce((s, w) => s + w.amount, 0)).toLocaleString('ru-RU')} so'm`);
  writes.slice(0, 5).forEach(w => console.log('   ', w._name, w._status, w.amount));

  if (!APPLY) { console.log('\n(--apply berilmadi, hech narsa yozilmadi)'); return; }

  const data = writes.map(({ _name, _status, ...w }) => w);
  const r = await prisma.payment.createMany({ data });
  console.log(`\nYozildi: ${r.count} ta yozuv`);

  // Tekshiruv
  const after = await prisma.payment.groupBy({ by: ['studentId'], _sum: { amount: true } });
  const led2 = new Map(after.map(s => [s.studentId, s._sum.amount || 0]));
  const bad = students.filter(st => Math.abs(st.balance - (led2.get(st.id) || 0)) >= 1);
  console.log(`Tekshiruv: mos kelmaydiganlar qoldi — ${bad.length}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
