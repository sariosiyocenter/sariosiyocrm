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

  // Sinov o'quvchisi guruhdan guruhga o'tsa — hisob yo'q, faqat a'zolik.
  if (student.status === 'Sinov') {
    const result = {
      month, date, trial: true,
      student: { id: student.id, name: student.name, balanceBefore: student.balance },
      lines: [], balanceDelta: 0, balanceAfter: student.balance, applied: false,
    };
    if (!apply) return result;
    await prisma.student.update({
      where: { id: student.id },
      data: { groups: { ...(from ? { disconnect: { id: from.id } } : {}), connect: { id: to.id } } },
    });
    result.applied = true;
    return result;
  }

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
  }, { timeout: 20000, maxWait: 10000 });

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
  // Sinov o'quvchisidan hech narsa yechilmagan — qaytarish ham, hisob ham yo'q.
  const trial = student.status === 'Sinov';

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
    const adjust = trial ? 0 : charged - used.due;
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
  }, { timeout: 20000, maxWait: 10000 });

  result.applied = true;
  return result;
}

/** Bugungi sana Toshkent vaqti bilan (server UTC da ishlaydi). */
export function todayTashkent() {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Shu kundan oy oxirigacha bo'lgan darslar uchun hisob (yozuv tayyorlanadi,
 * bazaga yozilmaydi). Shu oyda shu guruh uchun allaqachon yechilgan qism
 * ayiriladi — chiqib qayta kirgan yoki oylik hisob o'tib bo'lgan
 * o'quvchidan ikki marta olinmaydi.
 */
async function remainingMonthCharge(student, group, day, reason) {
  const month = day.slice(0, 7);
  const bounds = monthBounds(month);
  const out = { write: null, warning: null, info: { charge: 0, lessons: 0 } };
  if (!bounds) return out;
  if (!hasSchedule(group.days)) {
    out.warning = `${group.name} guruhining jadvali belgilanmagan — bu oy uchun hisob yozilmadi. Guruh kunlarini (Toq / Juft / Har kuni) belgilang.`;
    return out;
  }
  const rest = periodDue(student, group, month, day, bounds.last);
  if (!rest || rest.due <= 0) return out;
  const ch = await chargedSoFar(student.id, group.id, month, rest.monthlyPrice, new Set());
  const charge = Math.max(0, rest.due - ch.total);
  out.info = { charge, lessons: rest.lessons, lessonsInMonth: rest.lessonsInMonth, perLesson: rest.perLesson, alreadyCharged: ch.total };
  if (charge > 0) {
    out.write = {
      studentId: student.id, groupId: group.id, courseId: group.courseId,
      amount: -charge, type: 'Oylik', date: day,
      description: `${CHARGE_PREFIX} ${group.name} — ${reason} ${day.slice(8, 10)}.${day.slice(5, 7)} dan (${rest.lessons} dars)`,
      schoolId: student.schoolId,
    };
  }
  return out;
}

/**
 * O'quvchini guruhga qo'shish — va o'sha zahoti oyning qolgan darslari uchun
 * hisob yozish. 7-sentabrda qo'shilsa, 7-sidan oy oxirigacha nechta dars
 * bo'lsa, shuncha dars uchun. Hamyonida avans bo'lsa hisob o'zi shundan
 * yopiladi (lib/allocation.js), bo'lmasa o'quvchi darhol qarzdor ko'rinadi.
 *
 * Ilgari guruhga qo'shish faqat bog'lanish edi: oy o'rtasida kelgan o'quvchi
 * keyingi oyning 1-sanasigacha hech narsa to'lamasdi, ustozga ham hech narsa
 * hisoblanmasdi.
 *
 * Jadvali belgilanmagan guruh uchun dars sonini bilib bo'lmaydi — o'quvchi
 * qo'shiladi, lekin hisob yozilmaydi va `warning` qaytadi.
 */
export async function enrollStudent({ studentId, groupId, date, schoolId, apply = true }) {
  const day = date || todayTashkent();
  const month = day.slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return { error: "Sana noto'g'ri" };

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), ...(schoolId ? { schoolId } : {}) },
    include: { groups: { select: { id: true } } },
  });
  if (!student) return { error: "O'quvchi topilmadi" };
  const group = await loadGroup(groupId, student.schoolId);
  if (!group) return { error: 'Guruh topilmadi' };

  const already = student.groups.some(g => g.id === group.id);
  const result = { studentId: student.id, groupId: group.id, groupName: group.name, date: day, charge: 0, lessons: 0, warning: null, applied: false };

  let write = null;
  if (!already) {
    if (student.status === 'Sinov') {
      // Sinov darsiga kelgan o'quvchi — hisob yozilmaydi. "Faol" qilinganda
      // o'sha kundan oy oxirigacha bo'lgan darslar uchun yoziladi
      // (activateStudent).
      result.trial = true;
    } else {
      const c = await remainingMonthCharge(student, group, day, "qo'shilish");
      Object.assign(result, c.info);
      result.warning = c.warning;
      write = c.write;
    }
  }

  if (!apply) return result;

  // Interaktiv tranzaksiya uzoq (Singapur) bazada 5 soniyada yopilib
  // qolardi (P2028). Ro'yxat shaklida bitta paketda yuboriladi.
  const ops = [];
  if (!already || write) {
    ops.push(prisma.student.update({
      where: { id: student.id },
      data: {
        ...(already ? {} : { groups: { connect: { id: group.id } } }),
        ...(write ? { balance: { decrement: -write.amount } } : {}),
      },
    }));
  }
  if (write) ops.push(prisma.payment.create({ data: write }));
  if (ops.length) await prisma.$transaction(ops);
  result.applied = true;
  return result;
}

/**
 * O'quvchini guruhdan chiqarish — o'tilmagan darslar puli hisobiga
 * qaytariladi (chiqarilgan kundan oy oxirigacha bo'lgan darslar).
 */
export async function unenrollStudent({ studentId, groupId, date, schoolId, apply = true }) {
  const day = date || todayTashkent();
  const month = day.slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return { error: "Sana noto'g'ri" };

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), ...(schoolId ? { schoolId } : {}) },
    include: { groups: { select: { id: true } } },
  });
  if (!student) return { error: "O'quvchi topilmadi" };
  const group = await loadGroup(groupId, student.schoolId);
  if (!group) return { error: 'Guruh topilmadi' };

  const member = student.groups.some(g => g.id === group.id);
  const result = { studentId: student.id, groupId: group.id, groupName: group.name, date: day, refund: 0, lessons: 0, warning: null, applied: false };

  let write = null;
  if (member) {
    if (!hasSchedule(group.days)) {
      result.warning = `${group.name} guruhining jadvali belgilanmagan — o'tilmagan darslar puli qayta hisoblanmadi.`;
    } else {
      const used = periodDue(student, group, month, bounds.first, dayBefore(day));
      const ch = await chargedSoFar(student.id, group.id, month, used.monthlyPrice, new Set());
      const adjust = ch.total - used.due;   // ortiqcha yechilgan qism qaytadi
      result.lessons = used.lessons; result.alreadyCharged = ch.total; result.refund = Math.max(0, adjust);
      if (adjust > 0) {
        write = {
          studentId: student.id, groupId: group.id, courseId: group.courseId,
          amount: adjust, type: 'Oylik', date: day,
          description: `${CHARGE_PREFIX} ${group.name} — guruhdan chiqarildi, ${used.lessons} dars uchun qayta hisob`,
          schoolId: student.schoolId,
        };
      }
    }
  }

  if (!apply) return result;

  const ops = [];
  if (member || write) {
    ops.push(prisma.student.update({
      where: { id: student.id },
      data: {
        ...(member ? { groups: { disconnect: { id: group.id } } } : {}),
        ...(write ? { balance: { increment: write.amount } } : {}),
      },
    }));
  }
  if (write) ops.push(prisma.payment.create({ data: write }));
  if (ops.length) await prisma.$transaction(ops);
  result.applied = true;
  return result;
}

/**
 * Guruh a'zolarini yangi ro'yxatga keltirish: qo'shilganlarga hisob,
 * chiqarilganlarga qaytarish. Guruh tahrirlash oynasi uchun.
 */
export async function syncGroupMembers({ groupId, studentIds, date, schoolId }) {
  const group = await prisma.group.findFirst({
    where: { id: Number(groupId), ...(schoolId ? { schoolId } : {}) },
    include: { students: { select: { id: true } } },
  });
  if (!group) return { error: 'Guruh topilmadi' };
  const wanted = new Set((studentIds || []).map(Number).filter(Number.isInteger));
  const current = new Set(group.students.map(s => s.id));
  const warnings = [];
  const results = [];
  for (const sid of wanted) {
    if (current.has(sid)) continue;
    const r = await enrollStudent({ studentId: sid, groupId: group.id, date, schoolId: group.schoolId });
    if (r.warning) warnings.push(r.warning);
    results.push(r);
  }
  for (const sid of current) {
    if (wanted.has(sid)) continue;
    const r = await unenrollStudent({ studentId: sid, groupId: group.id, date, schoolId: group.schoolId });
    if (r.warning) warnings.push(r.warning);
    results.push(r);
  }
  return { results, warning: [...new Set(warnings)].join(' ') || null };
}

/**
 * Sinov o'quvchisi "Faol" bo'ldi: hamma guruhi uchun shu kundan oy oxirigacha
 * hisob yoziladi. Sinov darslari bepul — hisob faollashgan kundan boshlanadi.
 * Shu oyda allaqachon yechilgan guruh (masalan Faol paytida qo'shilgan)
 * ikkinchi marta hisoblanmaydi.
 */
export async function activateStudent({ studentId, date, schoolId }) {
  const day = date || todayTashkent();
  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), ...(schoolId ? { schoolId } : {}) },
    include: {
      groups: { include: { course: { select: { name: true, price: true } }, teacher: { select: { id: true, name: true } } } },
    },
  });
  if (!student) return { error: "O'quvchi topilmadi" };

  const charges = [];
  const writes = [];
  const warnings = [];
  for (const group of student.groups) {
    const c = await remainingMonthCharge(student, group, day, 'faollashdi');
    if (c.warning) warnings.push(c.warning);
    if (c.write) {
      writes.push(c.write);
      charges.push({ groupId: group.id, groupName: group.name, ...c.info });
    }
  }
  const total = writes.reduce((s, w) => s - w.amount, 0);
  if (writes.length) {
    await prisma.$transaction([
      prisma.payment.createMany({ data: writes }),
      prisma.student.update({ where: { id: student.id }, data: { balance: { decrement: total } } }),
    ]);
  }
  return { date: day, charges, total, warning: [...new Set(warnings)].join(' ') || null };
}

/**
 * O'quvchining guruhlar ro'yxatini yangi holatga keltirish (o'quvchi
 * tahrirlash oynasi): qo'shilganlarga hisob, chiqarilganlarga qaytarish.
 * Ilgari bu yerda shunchaki "set" bo'lardi — hisobsiz.
 */
export async function syncStudentGroups({ studentId, groupIds, date, schoolId }) {
  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), ...(schoolId ? { schoolId } : {}) },
    include: { groups: { select: { id: true } } },
  });
  if (!student) return { error: "O'quvchi topilmadi" };
  const wanted = new Set((groupIds || []).map(Number).filter(Number.isInteger));
  const current = new Set(student.groups.map(g => g.id));
  const warnings = [];
  const results = [];
  for (const gid of wanted) {
    if (current.has(gid)) continue;
    const r = await enrollStudent({ studentId: student.id, groupId: gid, date, schoolId: student.schoolId });
    if (r.error) { warnings.push(r.error); continue; }
    if (r.warning) warnings.push(r.warning);
    results.push(r);
  }
  for (const gid of current) {
    if (wanted.has(gid)) continue;
    const r = await unenrollStudent({ studentId: student.id, groupId: gid, date, schoolId: student.schoolId });
    if (r.error) { warnings.push(r.error); continue; }
    if (r.warning) warnings.push(r.warning);
    results.push(r);
  }
  const moved = results.some(r => (r.charge || 0) > 0 || (r.refund || 0) > 0);
  return { results, moved, warning: [...new Set(warnings)].join(' ') || null };
}
