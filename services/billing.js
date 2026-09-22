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

/** Oylik hisob kuni: 1–28 (29–31 hamma oyda yo'q). Sukut — oyning 1-kuni. */
export const DEFAULT_BILLING_DAY = 1;

export function normalizeBillingDay(value) {
  const day = parseInt(value);
  if (!Number.isInteger(day)) return DEFAULT_BILLING_DAY;
  return Math.min(28, Math.max(1, day));
}

/**
 * Markazning oylik hisob kuni. Egasi (2026-09-22) "har doim oyni boshida"
 * dedi, shuning uchun sukut bo'yicha 1-kun; Sozlamalardan o'zgartiriladi.
 */
export async function billingDayOf(schoolId) {
  try {
    const s = await prisma.setting.findUnique({
      where: { schoolId: Number(schoolId) },
      select: { billingDay: true },
    });
    return normalizeBillingDay(s?.billingDay);
  } catch {
    return DEFAULT_BILLING_DAY;
  }
}

/** Bugun (Toshkent vaqti) shu filialning oylik hisob kuni keldimi. */
export async function billingDayReached(schoolId, todayStr) {
  const day = await billingDayOf(schoolId);
  return parseInt(String(todayStr).slice(8, 10)) >= day;
}

export async function processMonthlyBilling(schoolId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new Error(`Noto'g'ri oy formati: ${month} (kutilgan "YYYY-MM")`);
  }
  const lastDay = new Date(year, monthNum, 0).getDate();
  // Hisob yozuvining sanasi — markazning oylik hisob kuni ("Oylik hisoblandi
  // 01.10.2026"). Ilgari bu doim oyning oxirgi kuni edi: hisob 1-sanada
  // yozilsa ham tarixda 31-sana ko'rinardi.
  const day = Math.min(await billingDayOf(schoolId), lastDay);
  const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const monthLabel = `${monthNames[monthNum - 1]} ${year}`;

  // Shu oyda allaqachon hisoblangan (o'quvchi, guruh) juftliklari. Guruhlar
  // orasida ko'chirishda hisob o'sha zahoti yozilgani uchun, oy yopilganda
  // ularni ikkinchi marta hisoblab yubormaslik kerak.
  const already = await prisma.payment.findMany({
    where: { schoolId, type: 'Oylik', date: { startsWith: month }, groupId: { not: null } },
    select: { studentId: true, groupId: true }
  });
  const alreadyBilled = new Set(already.map(r => r.studentId + ':' + r.groupId));

  // Eski yozuvlarda guruh ko'rsatilmagan — ular bo'yicha oy allaqachon yopilgan.
  const legacy = await prisma.payment.findFirst({
    where: { schoolId, type: 'Oylik', date: { startsWith: month }, groupId: null }
  });
  if (legacy) return { alreadyDone: true, month };

  const groups = await prisma.group.findMany({
    where: { schoolId },
    // Sinov o'quvchilari hisoblanmaydi: sinov darsi bepul, "Faol" bo'lganda
    // o'sha kundan boshlab yoziladi (services/enrollment.js → activateStudent).
    include: { course: true, students: { where: { status: 'Faol' } } }
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
      if (alreadyBilled.has(student.id + ':' + group.id)) continue;

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
        groupId: group.id,
        courseId: group.courseId,
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
