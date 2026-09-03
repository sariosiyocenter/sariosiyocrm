import prisma from '../lib/prisma.js';

// Monthly billing: charge every active student for each group they are in.
// Split out of server.js so the money-handling logic sits on its own and can be read
// (and tested) without scrolling past a hundred route handlers.

// Claims the right to bill one (school, month). Returns false when another request
// already holds the claim, so concurrent callers cannot charge the same month twice.
export async function claimBillingRun(schoolId, month) {
  try {
    await prisma.billingRun.create({ data: { schoolId, month } });
    return true;
  } catch (err) {
    if (err.code === 'P2002') return false;   // unique violation — someone else won
    throw err;
  }
}

// Recalculation deliberately re-bills a month, so the old claim has to go first.
export async function releaseBillingRun(schoolId, month) {
  await prisma.billingRun.deleteMany({ where: { schoolId, month } });
}

export async function processMonthlyBilling(schoolId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new Error(`Noto'g'ri oy formati: ${month} (kutilgan "YYYY-MM")`);
  }
  const lastDay = new Date(year, monthNum, 0).getDate();
  const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
  const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const monthLabel = `${monthNames[monthNum - 1]} ${year}`;

  const existing = await prisma.payment.findFirst({
    where: { schoolId, type: 'Oylik', date: { startsWith: month } }
  });
  if (existing) return { alreadyDone: true, month };

  const groups = await prisma.group.findMany({
    where: { schoolId },
    include: { course: true, students: { where: { status: { in: ['Faol', 'Sinov'] } } } }
  });

  // Work out every charge first, then write once. The previous version issued two
  // queries per student per group — around 530 sequential round trips to Singapore for
  // 266 students, slow enough to risk a function timeout, and a crash halfway through
  // left some students charged and others not.
  const results = [];
  const charges = [];
  const totalPerStudent = new Map();

  for (const group of groups) {
    for (const student of group.students) {
      const customPrices = (student.customPrices && typeof student.customPrices === 'object') ? student.customPrices : {};
      const customPrice = customPrices[group.id];
      const price = customPrice !== undefined ? customPrice : group.course.price;
      if (!price || price <= 0) continue;

      charges.push({
        studentId: student.id,
        amount: -price,
        type: 'Oylik',
        date: dateStr,
        description: `[OYLIK HISOB] ${group.course.name} — ${monthLabel}`,
        schoolId
      });
      totalPerStudent.set(student.id, (totalPerStudent.get(student.id) || 0) + price);
      results.push({ studentId: student.id, groupId: group.id, amount: price });
    }
  }

  if (charges.length) {
    // One transaction: either the whole month is billed or none of it is.
    await prisma.$transaction([
      prisma.payment.createMany({ data: charges }),
      ...[...totalPerStudent].map(([studentId, total]) =>
        prisma.student.update({ where: { id: studentId }, data: { balance: { decrement: total } } })
      ),
    ]);
  }

  return { processed: results.length, total: results.reduce((s, r) => s + r.amount, 0), month };
}
