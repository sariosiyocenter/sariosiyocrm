import prisma from '../lib/prisma.js';
import { allocate, groupRows, groupStanding, withOpening, LEGACY_KEY } from '../lib/allocation.js';
import { paidUntil } from '../lib/access.js';

export { withOpening };

// O'quvchi hisobi (daftari) bazadan o'qilib, `lib/allocation.js` orqali
// taqsimlanadi. Bu yerda faqat bazaga murojaat va natijani bezash bor;
// hisobning o'zi allocation.js da.

const ROW_SELECT = { id: true, studentId: true, amount: true, type: true, date: true, groupId: true, courseId: true, description: true };

/**
 * Berilgan o'quvchilarning barcha yozuvlari, o'quvchi bo'yicha guruhlangan.
 *
 * Tartib muhim: bir oyda ikki guruhning hisobi ochiq bo'lsa (masalan o'quvchi
 * oy o'rtasida ko'chirilgan), pul yetmaganda qaysi guruh birinchi yopilishi
 * shu tartibga bog'liq — ya'ni ustozlar orasidagi bo'linishga. ORDER BY
 * bo'lmasa Postgres tartibni kafolatlamaydi va bitta o'quvchi uchun oylik
 * ikki xil chiqishi mumkin edi. studentLedger() bilan bir xil tartib.
 */
export async function loadRowsByStudent(studentIds) {
  if (!studentIds.length) return new Map();
  const [rows, students] = await Promise.all([
    prisma.payment.findMany({
      where: { studentId: { in: studentIds } },
      select: ROW_SELECT,
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    }),
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, balance: true } }),
  ]);
  const map = groupRows(rows);
  for (const st of students) {
    map.set(st.id, withOpening(map.get(st.id) || [], st.balance));
  }
  return map;
}

/**
 * Bitta o'quvchining to'liq hisobi: chelaklar (oy × guruh), qaysi to'lov
 * qaysi hisobni yopgani, hamyondagi avans va qarz.
 */
export async function studentLedger(studentId) {
  const [stored, student] = await Promise.all([
    prisma.payment.findMany({ where: { studentId }, select: ROW_SELECT, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
    prisma.student.findUnique({ where: { id: studentId }, select: { balance: true } }),
  ]);
  const rows = withOpening(stored, student?.balance || 0);
  const result = allocate(rows);

  // Chelaklardagi guruhlar + o'quvchi hozir a'zo bo'lgan guruhlar. Ikkinchisi
  // kerak: yangi qo'shilgan kursda hali hisob yo'q bo'lishi mumkin, lekin
  // uning muddati (avansdan) ko'rsatilishi kerak.
  const member = await prisma.student.findUnique({
    where: { id: studentId },
    select: { customPrices: true, groups: { select: { id: true } } },
  });
  const groupIds = [...new Set([
    ...result.buckets.map(b => b.groupId).filter(Boolean),
    ...(member?.groups || []).map(g => g.id),
  ])];
  const groups = groupIds.length
    ? await prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: {
          id: true, name: true, days: true, courseId: true,
          course: { select: { name: true, price: true } },
          teacher: { select: { name: true } },
        },
      })
    : [];
  const gmap = new Map(groups.map(g => [g.id, g]));

  // Har bir kurs alohida: o'z qarzi, o'z avansi, o'z muddati. Pul kursga
  // biriktirilgani uchun bular bir-biriga bog'liq emas — o'quvchi
  // matematikada avansda, fizikada qarzdor bo'lishi mumkin.
  const custom = (member?.customPrices && typeof member.customPrices === 'object') ? member.customPrices : {};
  const memberOf = new Set((member?.groups || []).map(g => g.id));
  const today = new Date().toISOString().slice(0, 10);
  const courses = groups.map(g => {
    const standing = groupStanding(result, g.id);
    const price = custom[g.id] !== undefined ? Number(custom[g.id]) : (g.course?.price || 0);
    const access = paidUntil(
      result.buckets.filter(b => b.groupId === g.id),
      { days: g.days, monthlyPrice: price, advance: standing.advance, today },
    );
    // O'quvchi guruhdan chiqib ketgan bo'lsa muddat ko'rsatilmaydi: u yerda
    // darsga kirmaydi, faqat pul hisobi qolgan (qarz yoki ortgan pul).
    const member = memberOf.has(g.id);
    return {
      groupId: g.id,
      groupName: g.name,
      courseId: g.courseId,
      courseName: g.course?.name || '',
      teacher: g.teacher?.name || null,
      monthlyPrice: price,
      isMember: member,
      ...standing,
      paidUntil: member ? access.until : null,
      accessUnknown: member && access.unknown,
      noCharge: access.noCharge,
      openDebt: access.openDebt,
    };
  }).sort((a, b) => (a.isMember === b.isMember ? 0 : a.isMember ? -1 : 1)
    || a.groupName.localeCompare(b.groupName));

  // Har bir to'lov qayerga ketgani — yozuv qatorida ko'rsatish uchun.
  const usedBy = new Map();
  for (const a of result.allocations) {
    if (a.paymentId == null) continue;
    if (!usedBy.has(a.paymentId)) usedBy.set(a.paymentId, []);
    usedBy.get(a.paymentId).push({ bucketKey: a.bucketKey, groupId: a.groupId, month: a.month, amount: a.amount });
  }

  return {
    wallet: result.wallet,
    debt: result.debt,
    courses,
    // Kursga biriktirilmagan avans — "umumiy" to'lovlardan qolgani.
    generalWallet: (result.walletByGroup.find(x => x.groupId === null) || {}).amount || 0,
    buckets: result.buckets.map(b => ({
      ...b,
      groupName: b.groupId ? (gmap.get(b.groupId)?.name || '#' + b.groupId) : (b.key === LEGACY_KEY ? "Eski qoldiq (01.09.2026 gacha)" : 'Qaytarish'),
      courseName: b.groupId ? (gmap.get(b.groupId)?.course?.name || '') : '',
      teacher: b.groupId ? (gmap.get(b.groupId)?.teacher?.name || null) : null,
      status: b.remaining <= 0 ? 'paid' : b.covered > 0 ? 'partial' : 'unpaid',
    })),
    rows: rows.filter(r => r.id != null).map(r => ({ ...r, usedFor: usedBy.get(r.id) || [] })),
  };
}

/**
 * Shu oyda guruhlarga yopilgan pul: Map<groupId, so'm>. Ustoz ulushi uchun.
 * Faqat berilgan o'quvchilar bo'yicha (odatda ustoz guruhlaridagilar).
 */
export async function receivedForGroups(studentIds, month) {
  const byStudent = await loadRowsByStudent(studentIds);
  const out = new Map();
  for (const rows of byStudent.values()) {
    for (const a of allocate(rows).allocations) {
      if (!a.groupId || a.month !== month) continue;
      out.set(a.groupId, (out.get(a.groupId) || 0) + a.amount);
    }
  }
  for (const [k, v] of out) out.set(k, Math.round(v));
  return out;
}

/**
 * Oy bo'yicha holat: har bir o'quvchi uchun shu oyda qancha hisoblangan,
 * qanchasi yopilgan, umumiy qarzi va hamyondagi avansi. Moliyadagi
 * "Oylik holat" jadvali shundan chiqadi.
 *
 * @returns Map<studentId, {due, covered, remaining, debt, wallet, groups: Map<groupId,{due,covered}>}>
 */
export async function monthCoverage(studentIds, month) {
  const byStudent = await loadRowsByStudent(studentIds);
  const out = new Map();
  for (const sid of studentIds) {
    const rows = byStudent.get(sid) || [];
    const r = allocate(rows);
    const groups = new Map();
    let due = 0, covered = 0;
    for (const b of r.buckets) {
      if (b.month !== month || !b.groupId) continue;
      due += b.due; covered += b.covered;
      groups.set(b.groupId, { due: b.due, covered: b.covered, remaining: b.remaining });
    }
    out.set(sid, { due, covered, remaining: due - covered, debt: r.debt, wallet: r.wallet, groups });
  }
  return out;
}
