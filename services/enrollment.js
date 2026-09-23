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

/** `Student.courseStart` — har doim oddiy obyekt sifatida. */
function startMapOf(student) {
  const cs = student?.courseStart;
  return (cs && typeof cs === 'object' && !Array.isArray(cs)) ? { ...cs } : {};
}

/**
 * O'quvchi shu kursga qaysi kundan kelib boshlagani (yozilgan bo'lsa).
 *
 * Egasi (2026-09-22): "o'quvchi bugun qo'shilgan yoki oyni boshida qo'shilgan
 * lekin kursga kelib boshlagan sanasi oyni o'rtasi bo'lishi mumkin". Shuning
 * uchun hisob ro'yxatga olingan kundan emas, aynan shu kundan boshlanadi.
 */
export function courseStartOf(student, groupId) {
  const v = startMapOf(student)[String(groupId)];
  return (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
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
 * O'quvchi shu oyda shu guruhda qaysi kundan boshlab hisoblangani.
 *
 * Guruhga qo'shilgan sana bazada saqlanmaydi — a'zolik oddiy bog'lanish,
 * shuning uchun uni hisob yozuvlaridan tiklaymiz:
 *   - to'liq oylik summasi yozilgan bo'lsa (services/billing.js uni oyning
 *     oxirgi kuni sanasi bilan yozadi) — o'quvchi oy boshidan guruhda bo'lgan;
 *   - aks holda eng erta hisob yozuvining sanasi qo'shilgan kun bo'ladi
 *     (enrollStudent -> remainingMonthCharge o'sha kun bilan yozadi).
 *
 * Busiz oy o'rtasida kelgan o'quvchidan, ko'chirishda yoki chiqishda, u umuman
 * qatnashmagan oy boshidagi darslar uchun ham haq olinardi: 7-sentabrda
 * qo'shilib o'sha kuni ko'chirilgan o'quvchidan 2 va 4-sentabr darslarining
 * puli yechilib qolardi.
 */
async function billedFrom(student, groupId, month, monthlyPrice, bounds, hasLegacy) {
  // Kelgan sana aniq yozilgan bo'lsa — u yozuvlardan ustun turadi. Sana shu
  // oydan keyin bo'lsa qaytgan qiymat oy oxiridan ham katta bo'ladi va
  // `periodDue` o'z-o'zidan nol dars chiqaradi (o'quvchi bu oyda yo'q edi).
  const explicit = courseStartOf(student, groupId);
  if (explicit) return explicit > bounds.first ? explicit : bounds.first;
  if (hasLegacy) return bounds.first;   // guruhsiz eski yozuv — to'liq oylik
  const rows = await prisma.payment.findMany({
    where: { studentId: student.id, groupId, type: 'Oylik', date: { startsWith: month }, amount: { lt: 0 } },
    select: { date: true, amount: true },
    orderBy: { date: 'asc' },
  });
  if (!rows.length) return bounds.first;
  const full = Math.round(monthlyPrice);
  if (full > 0 && rows.some(r => Math.round(-r.amount) === full)) return bounds.first;
  return rows[0].date > bounds.first ? rows[0].date : bounds.first;
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
 * Kursdan kursga ko'chirish.
 *
 * Egasi (2026-09-22): "guruhni almashtirganda to'lovsiz almashsin, hech
 * qanday to'lovlar o'zgarishi boshqa narsa bo'lmasin, faqat almashgani
 * tarixda saqlansin". Shuning uchun bu yerda pul umuman qimirlamaydi:
 * eski kursga yozilgan oylik hisob o'z joyida qoladi, yangi kursga shu oy
 * uchun hech narsa yozilmaydi, balans ham o'zgarmaydi. Keyingi oydan yangi
 * kurs odatdagidek hisoblanadi (services/billing.js).
 *
 * Ilgari bu yerda oy dars kunlari bo'yicha ikki kursga bo'lib qayta
 * hisoblanardi — endi yo'q. Ko'chirish faqat a'zolikni o'zgartiradi va
 * amallar jurnaliga (lib/audit.js) yoziladi.
 *
 * `apply` false bo'lsa hech narsa yozilmaydi — foydalanuvchiga ko'rsatish uchun.
 */
export async function transferStudent({ studentId, fromGroupId, toGroupId, date, schoolId, apply }) {
  const day = String(date || todayTashkent()).slice(0, 10);
  const month = day.slice(0, 7);

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), schoolId },
    include: { groups: { select: { id: true } } }
  });
  if (!student) return { error: 'O\'quvchi topilmadi' };

  const from = await loadGroup(fromGroupId, schoolId);
  const to = await loadGroup(toGroupId, schoolId);
  if (fromGroupId && !from) return { error: 'Eski kurs topilmadi' };
  if (!to) return { error: 'Yangi kurs topilmadi' };
  if (from && from.id === to.id) return { error: 'Kurslar bir xil' };
  if (student.groups.some(g => g.id === to.id)) return { error: "O'quvchi bu kursda allaqachon bor" };

  const result = {
    month, date: day,
    moneyFree: true,
    student: { id: student.id, name: student.name, balanceBefore: student.balance },
    from: from ? { id: from.id, name: from.name, teacher: from.teacher?.name || null, price: monthlyPriceFor(student, from) } : null,
    to: { id: to.id, name: to.name, teacher: to.teacher?.name || null, price: monthlyPriceFor(student, to) },
    lines: [],
    balanceDelta: 0,
    balanceAfter: student.balance,
    applied: false,
  };

  if (!apply) return result;

  // Yangi kursda "kelgan sana" — ko'chirilgan kun. Shu oy uchun pul
  // yozilmaydi, lekin o'quvchi keyinroq chiqib ketsa yoki kelgan sanasi
  // o'zgartirilsa hisob shu kundan yuritiladi.
  const starts = startMapOf(student);
  starts[String(to.id)] = day;
  if (from) delete starts[String(from.id)];

  await prisma.student.update({
    where: { id: student.id },
    data: {
      courseStart: starts,
      groups: {
        ...(from ? { disconnect: { id: from.id } } : {}),
        connect: { id: to.id },
      },
    },
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
    const price = monthlyPriceFor(student, group);
    const ch = await chargedSoFar(student.id, group.id, month, price, claimed);
    const charged = ch.total;
    claimIds.push(...ch.legacyIds.map(id => ({ id, groupId: group.id, courseId: group.courseId })));
    const since = await billedFrom(student, group.id, month, price, bounds, ch.legacyIds.length > 0);
    const used = periodDue(student, group, month, since, dayBefore(date));
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
async function remainingMonthCharge(student, group, day, reason, override) {
  const month = day.slice(0, 7);
  const bounds = monthBounds(month);
  const out = { write: null, warning: null, info: { charge: 0, lessons: 0 } };
  if (!bounds) return out;
  // Summa qo'lda berilgan bo'lsa (egasi: "250 000 chiqdi, lekin men 300 000
  // yozaman") — jadvalga qaramay o'sha yoziladi.
  const qolda = Number.isFinite(Number(override)) && override !== null && override !== '' ? Math.max(0, Math.round(Number(override))) : null;
  if (!hasSchedule(group.days) && qolda === null) {
    out.warning = `${group.name} kursining jadvali belgilanmagan — bu oy uchun hisob yozilmadi. Kurs kunlarini (Toq / Juft / Har kuni) belgilang yoki summani qo'lda yozing.`;
    return out;
  }
  const rest = hasSchedule(group.days) ? periodDue(student, group, month, day, bounds.last) : null;
  const due = qolda !== null ? qolda : (rest ? rest.due : 0);
  if (due <= 0) return out;
  const ch = await chargedSoFar(student.id, group.id, month, rest ? rest.monthlyPrice : monthlyPriceFor(student, group), new Set());
  const charge = Math.max(0, due - ch.total);
  out.info = { charge, lessons: rest ? rest.lessons : 0, lessonsInMonth: rest ? rest.lessonsInMonth : 0, perLesson: rest ? rest.perLesson : 0, alreadyCharged: ch.total };
  if (charge > 0) {
    out.write = {
      studentId: student.id, groupId: group.id, courseId: group.courseId,
      amount: -charge, type: 'Oylik', date: day,
      description: `${CHARGE_PREFIX} ${group.name} — ${reason} ${day.slice(8, 10)}.${day.slice(5, 7)} dan`
        + (qolda !== null ? ' (summa qo\'lda)' : ` (${rest.lessons} dars)`),
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
export async function enrollStudent({ studentId, groupId, date, schoolId, apply = true, charge: chargeOverride }) {
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
      const c = await remainingMonthCharge(student, group, day, "qo'shilish", chargeOverride);
      Object.assign(result, c.info);
      result.warning = c.warning;
      write = c.write;
    }
  }

  if (!apply) return result;

  // Interaktiv tranzaksiya uzoq (Singapur) bazada 5 soniyada yopilib
  // qolardi (P2028). Ro'yxat shaklida bitta paketda yuboriladi.
  // Kursga kelgan sana yozib qo'yiladi: oylik hisob keyin ham shu kundan
  // yuritiladi (chiqish, ko'chirish, sanani o'zgartirish).
  const starts = startMapOf(student);
  if (!already) starts[String(group.id)] = day;

  const ops = [];
  if (!already || write) {
    ops.push(prisma.student.update({
      where: { id: student.id },
      data: {
        ...(already ? {} : { groups: { connect: { id: group.id } }, courseStart: starts }),
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
 * Kursga qo'shishdan OLDIN birinchi oy summasi qancha chiqishi — qo'shish
 * oynalarida ko'rsatiladi va xodim uni o'zgartirishi mumkin. Hech narsa
 * yozilmaydi. O'quvchi hali yaratilmagan bo'lishi mumkin (studentId yo'q) —
 * unda kursning standart narxi olinadi.
 */
export async function firstMonthQuote({ groupId, date, schoolId, studentId }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : todayTashkent();
  const group = await loadGroup(groupId, schoolId);
  if (!group) return { error: 'Kurs topilmadi' };
  const student = studentId
    ? await prisma.student.findFirst({ where: { id: Number(studentId), schoolId }, select: { id: true, customPrices: true } })
    : null;
  const s = student || { id: 0, customPrices: {} };
  const b = monthBounds(day.slice(0, 7));
  const pd = hasSchedule(group.days) && b ? periodDue(s, group, day.slice(0, 7), day, b.last) : null;
  return {
    groupId: group.id, date: day,
    price: monthlyPriceFor(s, group),
    suggested: pd ? Math.round(pd.due) : null,
    lessons: pd ? pd.lessons : null,
  };
}

/**
 * Kurs hisobi — hammasi bitta joyda (egasi, 2026-09-23): kursga kelgan
 * sana, shu o'quvchi uchun oylik narx va birinchi oy summasi.
 *
 * Tizim birinchi oy summasini kelgan sanadan hisoblab beradi ("15-sentabrdan
 * 7 dars — 269 231"), lekin xodim o'zi yozishi mumkin ("oy o'rtasida kelsa
 * 300 000 to'lasin"). Hozir yozilgan hisob bilan farqi bitta tuzatish
 * yozuvi bo'lib balansga tushadi — naqd pul qaytarilmaydi, faqat hisob
 * to'g'rilanadi.
 *
 * Qaysi oylar qayta sanaladi:
 *   - kelgan sana oyi — birinchi oy summasi (qo'lda yoki hisoblangan);
 *   - eski kelgan sana oyi (sana boshqa oyga ko'chgan bo'lsa);
 *   - narx o'zgargan bo'lsa — joriy oy ham yangi narxda.
 *
 * price:          undefined — o'zgarmaydi, null — kursning standart narxi,
 *                 son — shu o'quvchi uchun narx (customPrices).
 * firstMonthDue:  null — hisoblangani, son — qo'lda yozilgani.
 * apply false bo'lsa hech narsa yozilmaydi (oynada oldindan ko'rsatish uchun).
 */
export async function setKursHisob({ studentId, groupId, startDate, price, firstMonthDue, schoolId, apply = false }) {
  const day = String(startDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Sana noto'g'ri" };

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), ...(schoolId ? { schoolId } : {}) },
    include: { groups: { select: { id: true } } },
  });
  if (!student) return { error: "O'quvchi topilmadi" };
  const group = await loadGroup(groupId, student.schoolId);
  if (!group) return { error: 'Kurs topilmadi' };
  if (!student.groups.some(g => g.id === group.id)) return { error: "O'quvchi bu kursda emas" };

  // Narx
  const cp = (student.customPrices && typeof student.customPrices === 'object' && !Array.isArray(student.customPrices))
    ? { ...student.customPrices } : {};
  if (price === null) {
    delete cp[String(group.id)];
    delete cp['note_' + group.id];
  } else if (price !== undefined && price !== '') {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) return { error: "Narx noto'g'ri" };
    cp[String(group.id)] = Math.round(n);
  }
  const yangi = { ...student, customPrices: cp };
  const narx = monthlyPriceFor(yangi, group);
  const eskiNarx = monthlyPriceFor(student, group);

  // Birinchi oy summasi (qo'lda)
  let qolda = null;
  if (firstMonthDue !== null && firstMonthDue !== undefined && firstMonthDue !== '') {
    qolda = Math.round(Number(firstMonthDue));
    if (!Number.isFinite(qolda) || qolda < 0) return { error: "Summa noto'g'ri" };
  }

  const jadval = hasSchedule(group.days);
  const oldStart = courseStartOf(student, group.id);
  const startMonth = day.slice(0, 7);
  const bugunOy = todayTashkent().slice(0, 7);
  const oylar = new Set([startMonth]);
  if (oldStart) oylar.add(oldStart.slice(0, 7));
  if (narx !== eskiNarx && bugunOy > startMonth) oylar.add(bugunOy);

  const result = {
    studentId: student.id, groupId: group.id, groupName: group.name,
    startDate: day, oldStart, price: narx, oldPrice: eskiNarx, standardPrice: Number(group.course?.price || 0),
    trial: student.status === 'Sinov',
    suggested: null, suggestedLessons: null,
    lines: [], balanceDelta: 0,
    balanceBefore: student.balance, balanceAfter: student.balance,
    warning: null, applied: false,
  };

  // Tizim taklif qiladigan birinchi oy summasi — oynada ko'rsatiladi.
  if (jadval) {
    const b = monthBounds(startMonth);
    const pd = b ? periodDue(yangi, group, startMonth, day, b.last) : null;
    if (pd) { result.suggested = pd.due; result.suggestedLessons = pd.lessons; }
  } else if (qolda === null) {
    result.warning = `${group.name} kursining jadvali belgilanmagan — birinchi oy summasini qo'lda yozing.`;
  }

  const sanaMatn = `${day.slice(8, 10)}.${day.slice(5, 7)}`;
  const writes = [];
  if (!result.trial) {
    // Oylarning hozirgi hisobi bir vaqtda so'raladi (uzoq bazada har so'rov sezilarli).
    const oyRoyxat = [...oylar].sort().filter(m => monthBounds(m));
    const yozilgan = await Promise.all(oyRoyxat.map(m => chargedSoFar(student.id, group.id, m, eskiNarx, new Set())));
    for (const [oi, month] of oyRoyxat.entries()) {
      const b = monthBounds(month);
      const ch = yozilgan[oi];
      let due;
      let lessons = null;
      if (month === startMonth) {
        if (qolda !== null) due = qolda;
        else if (jadval) { const pd = periodDue(yangi, group, month, day, b.last); due = pd ? pd.due : 0; lessons = pd ? pd.lessons : null; }
        else due = ch.total;                      // jadvalsiz va summa yozilmagan — tegilmaydi
      } else if (day > b.last) {
        due = 0;                                  // bu oyda hali kelmagan edi
      } else if (jadval) {
        const pd = periodDue(yangi, group, month, day > b.first ? day : b.first, b.last);
        due = pd ? pd.due : 0;
        lessons = pd ? pd.lessons : null;
      } else {
        due = day <= b.first ? narx : ch.total;
      }
      due = Math.round(due);
      const adjust = Math.round(ch.total - due);
      result.lines.push({ month, first: month === startMonth, alreadyCharged: Math.round(ch.total), due, adjust, lessons });
      if (adjust !== 0) {
        result.balanceDelta += adjust;
        writes.push({
          studentId: student.id, groupId: group.id, courseId: group.courseId,
          amount: adjust, type: 'Oylik',
          date: month === startMonth ? day : (month === bugunOy ? todayTashkent() : b.last),
          description: `${CHARGE_PREFIX} ${group.name} — kurs hisobi: ${month === startMonth ? sanaMatn + ' dan, ' : ''}${due.toLocaleString('ru-RU')} so'm`
            + (month === startMonth && qolda !== null ? ' (qo\'lda)' : ''),
          schoolId: student.schoolId,
        });
      }
    }
  }
  result.balanceAfter = student.balance + result.balanceDelta;

  if (!apply) return result;

  const starts = startMapOf(student);
  starts[String(group.id)] = day;
  const ops = [prisma.student.update({
    where: { id: student.id },
    data: {
      courseStart: starts,
      customPrices: cp,
      ...(result.balanceDelta ? { balance: { increment: result.balanceDelta } } : {}),
    },
  })];
  if (writes.length) ops.push(prisma.payment.createMany({ data: writes }));
  await prisma.$transaction(ops);
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

  // Pul qaytarilmaydi (egasi, 2026-09-23: "мы ученикам не будем возврат
  // делать"). Kursdan chiqarilganda faqat a'zolik uziladi — shu oy uchun
  // yozilgan hisob o'z joyida qoladi. Ilgari o'tilmagan darslar puli
  // avtomatik balansga qaytarilardi.
  const write = null;

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
  // Sinov darslari bepul edi — hisob shu kundan boshlandi, demak "kursga
  // kelgan sana" ham shu kun. Busiz keyinchalik chiqish yoki ko'chirishda
  // o'quvchidan sinov kunlari uchun ham haq olinib qolardi.
  const starts = startMapOf(student);
  for (const group of student.groups) starts[String(group.id)] = day;
  if (writes.length) {
    await prisma.$transaction([
      prisma.payment.createMany({ data: writes }),
      prisma.student.update({
        where: { id: student.id },
        data: { balance: { decrement: total }, courseStart: starts },
      }),
    ]);
  } else if (student.groups.length) {
    await prisma.student.update({ where: { id: student.id }, data: { courseStart: starts } });
  }
  return { date: day, charges, total, warning: [...new Set(warnings)].join(' ') || null };
}

/**
 * O'quvchining kurslar ro'yxatini yangi holatga keltirish (o'quvchi
 * tahrirlash oynasi): qo'shilganlarga hisob, chiqarilganlarga qaytarish.
 * Ilgari bu yerda shunchaki "set" bo'lardi — hisobsiz.
 *
 * Almashtirish (bittasi olib tashlanib, o'rniga boshqasi qo'shilsa) —
 * ko'chirish deb qaraladi va pulga umuman tegmaydi (egasi, 2026-09-22).
 * Faqat qo'shilgan kurs bo'lsa, odatdagidek oyning qolgan darslari uchun
 * hisob yoziladi.
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

  // Avval juftlab almashtiramiz: chiqarilgan har bir kurs o'rniga qo'shilgan
  // bitta kurs — bu ko'chirish, pulsiz.
  const added = [...wanted].filter(id => !current.has(id));
  const removed = [...current].filter(id => !wanted.has(id));
  const swaps = Math.min(added.length, removed.length);
  for (let i = 0; i < swaps; i++) {
    const r = await transferStudent({
      studentId: student.id, fromGroupId: removed[i], toGroupId: added[i],
      date, schoolId: student.schoolId, apply: true,
    });
    if (r.error) { warnings.push(r.error); continue; }
    results.push({ ...r, swapped: true });
    current.delete(removed[i]);
    current.add(added[i]);
  }

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
