import prisma from '../lib/prisma.js';
import { hasSchedule, countLessons, lessonPrice, monthBounds, dayBefore } from '../lib/lessons.js';

// O'quvchini guruhlar orasida ko'chirish va o'quv markazidan chiqishda pulni
// qayta hisoblash.
//
// Muammo: o'quvchi oyning o'rtasida boshqa guruhga o'tsa (masalan toq kunlardan
// juft kunlarga), eski guruhda necha dars o'tgani va yangi guruhda necha dars
// qolgani bo'yicha pul qayta taqsimlanishi kerak. Guruhlarning narxi ham har xil
// bo'lishi mumkin. Ilgari bunday hisob umuman yo'q edi: oylik hisob har guruh
// uchun to'liq oylik narxni yozardi.
//
// Bu yerdagi barcha hisob bitta qoidaga tayanadi: bitta dars narxi = oylik narx
// / o'sha oydagi jadval bo'yicha dars kunlari soni.

/** Oylik hisob yozuvlarining izohi shu bilan boshlanadi. */
const CHARGE_PREFIX = '[OYLIK HISOB]';

/** O'quvchining shu guruhdagi oylik narxi (shaxsiy narx bo'lsa — o'sha). */
function monthlyPriceFor(student, group) {
  const custom = (student.customPrices && typeof student.customPrices === 'object')
    ? student.customPrices[group.id]
    : undefined;
  return custom !== undefined ? Number(custom) : Number(group.course?.price || 0);
}

/**
 * Shu oyda shu guruh uchun o'quvchidan allaqachon yechilgan summa.
 * Hisob yozuvlari manfiy, tuzatishlar musbat — yig'indisi sof yechilgan summa.
 *
 * Eski yozuvlarda guruh ko'rsatilmagan (groupId qo'shilishidan oldin yozilgan).
 * Ularni e'tiborsiz qoldirsak, ko'chirishda oy ikkinchi marta hisoblanib
 * ketardi. Shuning uchun summasi shu guruhning oylik narxiga teng bo'lgan
 * guruhsiz yozuvni shu guruhniki deb qabul qilamiz va yozishda unga guruhni
 * biriktiramiz. `claimed` — bir yozuvni ikki guruhga berib yubormaslik uchun.
 */
async function chargedSoFar(studentId, groupId, month, monthlyPrice, claimed) {
  const rows = await prisma.payment.findMany({
    where: { studentId, groupId, date: { startsWith: month }, type: { in: ['Oylik', 'Chegirma'] } },
    select: { amount: true }
  });
  let total = -rows.reduce((s, r) => s + r.amount, 0);
  const legacyIds = [];

  if (monthlyPrice > 0) {
    const legacy = await prisma.payment.findMany({
      where: {
        studentId, groupId: null, type: 'Oylik',
        date: { startsWith: month },
        amount: -monthlyPrice,
      },
      select: { id: true, amount: true },
      orderBy: { id: 'asc' },
    });
    const free = legacy.find(r => !claimed.has(r.id));
    if (free) {
      claimed.add(free.id);
      legacyIds.push(free.id);
      total += -free.amount;
    }
  }

  return { total, legacyIds };
}

/**
 * Bitta guruh uchun oyning bir qismini hisoblash.
 * `from`..`to` — o'quvchi guruhda bo'lgan kunlar oralig'i.
 */
function periodDue(student, group, month, from, to) {
  const price = monthlyPriceFor(student, group);
  const lp = lessonPrice(group.days, month, price);
  if (!lp) return null;
  const lessons = countLessons(group.days, from, to);
  if (lessons === null) return null;
  return {
    monthlyPrice: price,
    lessonsInMonth: lp.total,
    perLesson: Math.round(lp.perLesson),
    lessons,
    due: Math.round(lp.perLesson * lessons),
  };
}

/** Guruhni ma'lumotlari bilan olish. */
async function loadGroup(groupId, schoolId) {
  if (!groupId) return null;
  return prisma.group.findFirst({
    where: { id: Number(groupId), schoolId },
    include: { course: { select: { name: true, price: true } }, teacher: { select: { id: true, name: true } } }
  });
}

/**
 * Ko'chirishni hisoblash. `apply` false bo'lsa hech narsa yozilmaydi —
 * foydalanuvchiga ko'rsatish uchun.
 */
export async function transferStudent({ studentId, fromGroupId, toGroupId, date, schoolId, apply }) {
  const month = String(date).slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return { error: "Sana noto'g'ri" };

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), schoolId },
    include: { groups: { select: { id: true } } }
  });
  if (!student) return { error: 'O\'quvchi topilmadi' };

  const from = await loadGroup(fromGroupId, schoolId);
  const to = await loadGroup(toGroupId, schoolId);
  if (fromGroupId && !from) return { error: 'Eski guruh topilmadi' };
  if (!to) return { error: 'Yangi guruh topilmadi' };
  if (from && from.id === to.id) return { error: 'Guruhlar bir xil' };

  // Jadvalsiz guruhda dars sonini bilib bo'lmaydi — taxmin qilish pul
  // masalasida yaramaydi, shuning uchun aniq aytamiz.
  const noSchedule = [from, to].filter(g => g && !hasSchedule(g.days));
  if (noSchedule.length) {
    return {
      error: 'Jadval to\'ldirilmagan guruh bor: ' + noSchedule.map(g => g.name).join(', ') +
        '. Hisob dars kunlari bo\'yicha yuritiladi, shuning uchun avval guruh kunlarini (Toq / Juft / Har kuni) belgilang.',
      needsSchedule: noSchedule.map(g => ({ id: g.id, name: g.name })),
    };
  }

  const lines = [];
  let balanceDelta = 0;
  const writes = [];
  const claimed = new Set();
  const claimIds = [];

  // Eski guruh: faqat ko'chirish kunigacha bo'lgan darslar uchun haq.
  if (from) {
    const used = periodDue(student, from, month, bounds.first, dayBefore(date));
    const ch = await chargedSoFar(student.id, from.id, month, used.monthlyPrice, claimed);
    const charged = ch.total;
    claimIds.push(...ch.legacyIds.map(id => ({ id, groupId: from.id, courseId: from.courseId })));
    const adjust = charged - used.due;   // musbat bo'lsa — ortiqcha yechilgan, qaytariladi
    lines.push({
      groupId: from.id, groupName: from.name, teacher: from.teacher?.name || null,
      role: 'from', ...used, alreadyCharged: charged, adjust,
    });
    if (adjust !== 0) {
      balanceDelta += adjust;
      writes.push({
        studentId: student.id, groupId: from.id, courseId: from.courseId,
        amount: adjust, type: 'Oylik', date,
        description: `${CHARGE_PREFIX} ${from.name} — ko'chirish bo'yicha qayta hisob (${used.lessons} dars)`,
        schoolId,
      });
    }
  }

  // Yangi guruh: ko'chirish kunidan oy oxirigacha.
  const rest = periodDue(student, to, month, date, bounds.last);
  const chTo = await chargedSoFar(student.id, to.id, month, rest.monthlyPrice, claimed);
  const chargedTo = chTo.total;
  claimIds.push(...chTo.legacyIds.map(id => ({ id, groupId: to.id, courseId: to.courseId })));
  const chargeTo = rest.due - chargedTo;
  lines.push({
    groupId: to.id, groupName: to.name, teacher: to.teacher?.name || null,
    role: 'to', ...rest, alreadyCharged: chargedTo, adjust: -chargeTo,
  });
  if (chargeTo !== 0) {
    balanceDelta -= chargeTo;
    writes.push({
      studentId: student.id, groupId: to.id, courseId: to.courseId,
      amount: -chargeTo, type: 'Oylik', date,
      description: `${CHARGE_PREFIX} ${to.name} — ko'chirish bo'yicha hisob (${rest.lessons} dars)`,
      schoolId,
    });
  }

  const result = {
    month, date,
    student: { id: student.id, name: student.name, balanceBefore: student.balance },
    lines,
    balanceDelta,
    balanceAfter: student.balance + balanceDelta,
    applied: false,
  };

  if (!apply) return result;

  await prisma.$transaction(async (tx) => {
    // Guruhsiz eski yozuvlarni o'z guruhiga biriktiramiz — shunda hisob
    // keyingi safar ham to'g'ri chiqadi.
    for (const c of claimIds) {
      await tx.payment.updateMany({
        where: { id: c.id, groupId: null },
        data: { groupId: c.groupId, courseId: c.courseId },
      });
    }
    if (writes.length) await tx.payment.createMany({ data: writes });
    await tx.student.update({
      where: { id: student.id },
      data: {
        balance: { increment: balanceDelta },
        groups: {
          ...(from ? { disconnect: { id: from.id } } : {}),
          connect: { id: to.id },
        },
      },
    });
  });

  result.applied = true;
  return result;
}

/**
 * O'quv markazidan chiqish: o'tilmagan darslar uchun pulni qaytarish.
 * mode: 'balance' — faqat balansga qaytariladi; 'cash' — kassadan chiqim ham
 * yoziladi.
 */
export async function refundStudent({ studentId, date, schoolId, mode, apply, groupIds }) {
  const month = String(date).slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return { error: "Sana noto'g'ri" };

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), schoolId },
    include: {
      groups: {
        include: { course: { select: { name: true, price: true } }, teacher: { select: { id: true, name: true } } }
      }
    }
  });
  if (!student) return { error: 'O\'quvchi topilmadi' };

  const wanted = Array.isArray(groupIds) && groupIds.length
    ? student.groups.filter(g => groupIds.map(Number).includes(g.id))
    : student.groups;

  const noSchedule = wanted.filter(g => !hasSchedule(g.days));
  if (noSchedule.length) {
    return {
      error: 'Jadval to\'ldirilmagan guruh bor: ' + noSchedule.map(g => g.name).join(', ') +
        '. Avval guruh kunlarini belgilang.',
      needsSchedule: noSchedule.map(g => ({ id: g.id, name: g.name })),
    };
  }

  const lines = [];
  let balanceDelta = 0;
  const writes = [];
  const claimed = new Set();
  const claimIds = [];

  for (const group of wanted) {
    const used = periodDue(student, group, month, bounds.first, dayBefore(date));
    const ch = await chargedSoFar(student.id, group.id, month, used.monthlyPrice, claimed);
    const charged = ch.total;
    claimIds.push(...ch.legacyIds.map(id => ({ id, groupId: group.id, courseId: group.courseId })));
    const adjust = charged - used.due;
    lines.push({
      groupId: group.id, groupName: group.name, teacher: group.teacher?.name || null,
      ...used, alreadyCharged: charged, adjust,
    });
    if (adjust !== 0) {
      balanceDelta += adjust;
      writes.push({
        studentId: student.id, groupId: group.id, courseId: group.courseId,
        amount: adjust, type: 'Oylik', date,
        description: `${CHARGE_PREFIX} ${group.name} — chiqish bo'yicha qayta hisob (${used.lessons} dars)`,
        schoolId,
      });
    }
  }

  const balanceAfterRecalc = student.balance + balanceDelta;
  // Naqd qaytarish faqat musbat qoldiq bo'lsa mumkin.
  const cashOut = mode === 'cash' ? Math.max(0, Math.round(balanceAfterRecalc)) : 0;

  const result = {
    month, date, mode,
    student: { id: student.id, name: student.name, balanceBefore: student.balance },
    lines,
    balanceDelta,
    balanceAfterRecalc,
    cashOut,
    balanceAfter: balanceAfterRecalc - cashOut,
    applied: false,
  };

  if (!apply) return result;

  await prisma.$transaction(async (tx) => {
    for (const c of claimIds) {
      await tx.payment.updateMany({
        where: { id: c.id, groupId: null },
        data: { groupId: c.groupId, courseId: c.courseId },
      });
    }
    if (writes.length) await tx.payment.createMany({ data: writes });

    if (cashOut > 0) {
      // Kassadan pul chiqadi: xarajat yozuvi + o'quvchining balansidan yechish.
      await tx.expense.create({
        data: {
          amount: cashOut,
          category: 'Qaytarilgan pul',
          date,
          description: `${student.name} — o'qishni to'xtatgani uchun qaytarildi`,
          schoolId,
        },
      });
      await tx.payment.create({
        data: {
          studentId: student.id, amount: -cashOut, type: 'Qaytarish', date,
          description: `[QAYTARISH] ${student.name} ga naqd qaytarildi`,
          schoolId,
        },
      });
    }

    await tx.student.update({
      where: { id: student.id },
      data: { balance: { increment: balanceDelta - cashOut } },
    });
  });

  result.applied = true;
  return result;
}
