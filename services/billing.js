import prisma from '../lib/prisma.js';
import { courseStartOf, birinchiOyHisobi, birinchiOyKaliti, todayTashkent } from './enrollment.js';

// Monthly billing: charge every active student for each group they are in.
// Split out of server.js so the money-handling logic sits on its own and can be read
// (and tested) without scrolling past a hundred route handlers.

// (filial, oy) bir marta yoziladi: BillingRun belgisi hisob bilan bitta
// tranzaksiyada qo'yiladi (processMonthlyBilling). Ilgari belgi hisobdan OLDIN
// alohida qo'yilardi — hisob yarmida uzilsa oy "yozilgan" bo'lib, lekin
// yozilmay qolardi.

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

/**
 * Bitta o'quvchining bitta kursdagi shu oy hisobi: { price, izoh } yoki null
 * (bu oy yozilmaydi). Oy faqat kelganda hisoblanadi, kelgan sanadan
 * (services/enrollment.js):
 *   - kelgan sana bu oydan keyin — hali kelmagan, hisob yo'q;
 *   - "Kurs hisobi"da birinchi oy summasi qo'lda yozilgan — o'sha;
 *   - kelgan sana oy o'rtasida — kelgan kundan oy oxirigacha darslar;
 *   - qolgan hollarda — to'liq oylik (shaxsiy narx bo'lsa — o'sha).
 */
export function oylikSumma(student, group, month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  const oy = `${year}-${String(monthNum).padStart(2, '0')}`;
  const firstStr = `${oy}-01`;
  const lastStr = `${oy}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, '0')}`;

  const customPrices = (student.customPrices && typeof student.customPrices === 'object') ? student.customPrices : {};
  const customPrice = customPrices[group.id];
  let price = Number(customPrice !== undefined ? customPrice : group.course.price);
  let izoh = '';

  const kelgan = courseStartOf(student, group.id);
  if (kelgan && kelgan > lastStr) return null;
  const birinchi = customPrices[birinchiOyKaliti(group.id)];
  if (birinchi && birinchi.oy === oy && Number.isFinite(Number(birinchi.summa))) {
    // Kalit o'chirilmaydi: oyi o'tgach boshqa oyga ta'sir qilmaydi, "Qayta
    // hisoblash" esa shu summani yana oladi.
    price = Math.round(Number(birinchi.summa));
    izoh = ` (birinchi oy, qo'lda)`;
  } else if (kelgan && kelgan > firstStr) {
    const pd = birinchiOyHisobi(student, group, oy, kelgan);
    if (pd) {
      price = pd.due;
      izoh = ` (${kelgan.slice(8, 10)}.${kelgan.slice(5, 7)} dan, ${pd.lessons} dars)`;
    }
  }
  if (!price || price <= 0) return null;
  return { price, izoh };
}

export async function processMonthlyBilling(schoolId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new Error(`Noto'g'ri oy formati: ${month} (kutilgan "YYYY-MM")`);
  }
  // Oy faqat kelganda yoziladi (egasi, 2026-09-29) — hali boshlanmagan oy
  // hisoblanmaydi, kim chaqirsa ham. O'tgan oy ham qaytadan yozilmaydi: 28.09
  // tozalanishidan keyin o'tgan oylarda yozuv yo'q, hammasi qayta hisoblanardi.
  const joriyOy = todayTashkent().slice(0, 7);
  if (month > joriyOy) return { processed: 0, total: 0, month, keyinroq: true };
  if (month < joriyOy) return { processed: 0, total: 0, month, otganOy: true };
  // Shu oy allaqachon yozilgan — hech narsa qilinmaydi (tez yo'l).
  if (await prisma.billingRun.findFirst({ where: { schoolId, month }, select: { id: true } })) {
    return { processed: 0, total: 0, month, alreadyDone: true };
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

      const hisob = oylikSumma(student, group, month);
      if (!hisob) continue;
      const { price, izoh } = hisob;

      charges.push({
        studentId: student.id,
        amount: -price,
        type: 'Oylik',
        date: dateStr,
        description: `[OYLIK HISOB] ${group.course.name} — ${monthLabel}${izoh}`,
        groupId: group.id,
        courseId: group.courseId,
        schoolId
      });
      totalPerStudent.set(student.id, (totalPerStudent.get(student.id) || 0) + price);
      results.push({ studentId: student.id, groupId: group.id, amount: price });
    }
  }

  // One transaction: either the whole month is billed (and marked) or none of it
  // is. Parallel chaqiruvlardan faqat bittasi belgini qo'ya oladi (unique) —
  // ikkinchisi to'liq bekor bo'ladi, ikki marta yozilmaydi.
  try {
    await prisma.$transaction([
      prisma.billingRun.create({ data: { schoolId, month } }),
      ...(charges.length ? [prisma.payment.createMany({ data: charges })] : []),
      ...[...totalPerStudent].map(([studentId, total]) =>
        prisma.student.update({ where: { id: studentId }, data: { balance: { decrement: total } } })
      ),
    ]);
  } catch (err) {
    if (err.code === 'P2002') return { processed: 0, total: 0, month, alreadyDone: true };
    throw err;
  }

  return { processed: results.length, total: results.reduce((s, r) => s + r.amount, 0), month };
}
