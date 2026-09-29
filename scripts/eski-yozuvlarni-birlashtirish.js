// 28.09 gacha kiritilgan yozuvlarning qoldig'ini tozalash — bir martalik,
// scripts/eski-balansni-tozalash.js ning davomi.
//
// U skript (o'quvchi, kurs) ga 28.09 dan keyin "Kurs hisobi" kiritilgan
// bo'lsa eski yozuvlarni QOLDIRGAN edi: kurs hisobi eski summaga nisbatan
// faqat farqni yozadi, eskisisiz summa noto'g'ri chiqardi. Natijada qarz
// to'g'ri edi, lekin tarixda 15.09, 18.09 dagi eski qatorlar ko'rinib turardi
// va egasi "o'chmaganku" dedi (2026-09-29, Abdujabborov Sarvar).
//
// Endi har (o'quvchi, kurs, oy) uchun:
//   - shu oyda 28.09 dan keyin kiritilgan qator bor — eski qatorlar o'chadi,
//     ularning summasi eng birinchi yangi qatorga qo'shiladi (farq yozuvi
//     to'liq summaga aylanadi: "kurs hisobi: 15.09 dan, 250 000 so'm" −250 000).
//     Balans O'ZGARMAYDI;
//   - yangi qator yo'q, lekin oy o'quvchining kelgan sanasidan oldin — eski
//     hisob o'chadi (xodim "01.10 dan keldi" degan, sentabr hisobi qolib
//     ketgan edi; services/enrollment.js dagi xato shu kuni tuzatildi).
//     Balans shu summaga yengillashadi.
// Oldin to'liq nusxa: scratch/backup_birlashtirish_<vaqt>.json.
//
//   node scripts/eski-yozuvlarni-birlashtirish.js          — faqat ko'rsatadi
//   node scripts/eski-yozuvlarni-birlashtirish.js --apply  — nusxa oladi va yozadi

import fs from 'node:fs';
import prisma from '../lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const CUT = new Date('2026-09-27T19:00:00Z'); // 28.09.2026 00:00 Toshkent
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const kalit = r => `${r.studentId}:${r.groupId}:${String(r.date).slice(0, 7)}`;

async function reja() {
  const rows = await prisma.payment.findMany({
    where: { groupId: { not: null } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, studentId: true, groupId: true, amount: true, date: true, createdAt: true, schoolId: true, description: true },
  });
  const oquvchilar = await prisma.student.findMany({ select: { id: true, courseStart: true } });
  const boshlanish = new Map(oquvchilar.map(s => [s.id, (s.courseStart && typeof s.courseStart === 'object') ? s.courseStart : {}]));

  const yangiBirinchi = new Map();
  for (const r of rows) if (r.createdAt >= CUT && !yangiBirinchi.has(kalit(r))) yangiBirinchi.set(kalit(r), r);

  const birlashadi = new Map(); // yangi qator id → { qator, eskilar: [] }
  const ochadi = [];            // kelgan sanadan oldingi oy — balansga ta'sir qiladi
  const qoladi = [];
  for (const r of rows.filter(x => x.createdAt < CUT)) {
    const w = yangiBirinchi.get(kalit(r));
    if (w) {
      if (!birlashadi.has(w.id)) birlashadi.set(w.id, { qator: w, eskilar: [] });
      birlashadi.get(w.id).eskilar.push(r);
      continue;
    }
    const start = boshlanish.get(r.studentId)?.[String(r.groupId)];
    const tegilgan = rows.some(x => x.createdAt >= CUT && x.studentId === r.studentId && x.groupId === r.groupId);
    if (tegilgan && typeof start === 'string' && String(r.date).slice(0, 7) < start.slice(0, 7)) ochadi.push(r);
    else qoladi.push(r);
  }
  return { birlashadi, ochadi, qoladi };
}

async function main() {
  const r = await reja();
  const eskiSoni = [...r.birlashadi.values()].reduce((a, b) => a + b.eskilar.length, 0);
  console.log(`Birlashadi: ${r.birlashadi.size} ta yangi qatorga ${eskiSoni} ta eski qator (balans o'zgarmaydi)`);
  console.log(`Kelgan sanadan oldingi oy — o'chadi: ${r.ochadi.length} ta (${fmt(r.ochadi.reduce((a, x) => a + x.amount, 0))})`);
  for (const x of r.ochadi) console.log(`   ${x.id} st ${x.studentId} g ${x.groupId} ${x.date} ${fmt(x.amount)}`);
  console.log(`Tegilmaydi: ${r.qoladi.length} ta`);
  if (!APPLY) { console.log('Yozish uchun: --apply'); return; }

  const fayl = `scratch/backup_birlashtirish_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(fayl, JSON.stringify({
    vaqt: new Date(), cut: CUT,
    tolovlar: await prisma.payment.findMany(),
    balanslar: await prisma.student.findMany({ select: { id: true, balance: true } }),
  }));
  console.log('Nusxa:', fayl);

  const boshlandi = new Date();
  const juftlar = new Set([...r.birlashadi.values()].map(b => `${b.qator.studentId}:${b.qator.groupId}`).concat(r.ochadi.map(x => `${x.studentId}:${x.groupId}`)));
  await prisma.$transaction(async (tx) => {
    // 1) Birlashtirish: eski qatorlar o'chadi, summasi yangi qatorga qo'shiladi.
    const eskiIdlar = [];
    for (const { qator, eskilar } of r.birlashadi.values()) {
      const summa = eskilar.reduce((a, x) => a + x.amount, 0);
      const upd = await tx.payment.updateMany({ where: { id: qator.id, amount: qator.amount }, data: { amount: { increment: summa } } });
      if (upd.count !== 1) throw new Error(`Qator ${qator.id} shu payt o'zgargan — bekor qilindi`);
      eskiIdlar.push(...eskilar.map(x => x.id));
    }
    const del1 = await tx.payment.deleteMany({ where: { id: { in: eskiIdlar } } });
    if (del1.count !== eskiIdlar.length) throw new Error(`O'chdi ${del1.count}, kutilgan ${eskiIdlar.length}`);

    // 2) Kelgan sanadan oldingi oy hisobi o'chadi, balans yengillashadi.
    if (r.ochadi.length) {
      const del2 = await tx.payment.deleteMany({ where: { id: { in: r.ochadi.map(x => x.id) } } });
      if (del2.count !== r.ochadi.length) throw new Error(`O'chdi ${del2.count}, kutilgan ${r.ochadi.length}`);
      const oquvchiga = new Map();
      for (const x of r.ochadi) oquvchiga.set(x.studentId, (oquvchiga.get(x.studentId) || 0) + x.amount);
      for (const [id, s] of oquvchiga) await tx.student.update({ where: { id }, data: { balance: { decrement: s } } });
    }

    // 3) Poyga: shu orada o'sha juftliklarga yangi yozuv tushgan bo'lsa — bekor.
    const yangi = await tx.payment.findMany({ where: { createdAt: { gte: boshlandi }, groupId: { not: null } }, select: { studentId: true, groupId: true } });
    if (yangi.some(x => juftlar.has(`${x.studentId}:${x.groupId}`))) throw new Error("Shu payt yangi hisob kiritildi — bekor qilindi, qayta ishga tushiring");

    await tx.auditLog.create({ data: {
      userName: 'Tizim', action: 'update', entity: 'payment', title: "28.09 gacha yozuvlar birlashtirildi",
      summary: `${eskiSoni} ta eski qator bugungi "Kurs hisobi" qatorlariga qo'shildi (balans o'zgarmadi); ${r.ochadi.length} ta kelgan sanadan oldingi hisob o'chdi. Nusxa: ${fayl}`,
      method: 'SCRIPT', path: 'scripts/eski-yozuvlarni-birlashtirish.js', schoolId: 1,
    } });
  }, { timeout: 120000, maxWait: 15000 });
  console.log('Yozildi.');

  const [qolgan, st] = await Promise.all([
    prisma.payment.groupBy({ by: ['studentId'], _sum: { amount: true } }),
    prisma.student.findMany({ select: { id: true, balance: true } }),
  ]);
  const yig = new Map(qolgan.map(x => [x.studentId, x._sum.amount || 0]));
  const mos = st.filter(s => Math.round(s.balance) !== Math.round(yig.get(s.id) || 0));
  console.log(mos.length ? `DIQQAT: ${mos.length} ta o'quvchida balans ≠ yozuvlar` : "Tekshiruv: hamma balans yozuvlarga mos ✓");
  const eskiQoldi = await prisma.payment.count({ where: { createdAt: { lt: CUT } } });
  console.log(`28.09 gacha kiritilgan yozuv qoldi: ${eskiQoldi}`);
}

main().catch(e => { console.error('XATO:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
