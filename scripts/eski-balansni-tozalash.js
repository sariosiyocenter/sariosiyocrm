// 28.09.2026 gacha bo'lgan avtomatik balansni tozalash — bir martalik.
//
// Egasi (2026-09-29): markaz haqiqiy hisoblarni (Kurs hisobi va to'lovlar)
// 28-sentabrdan kirita boshladi; undan oldingi balans — avtomatik hisob va
// sinov to'lovlari — o'chirilsin, bugun kiritilganlar qolsin.
//
// Qoida ("1-yo'l", egasi tanladi):
//   - 28.09 (Toshkent) dan OLDIN kiritilgan yozuvlar o'chadi;
//   - LEKIN shu (o'quvchi, kurs) juftligiga 28.09 dan keyin qo'l tekkan bo'lsa
//     (Kurs hisobi, qo'shilish, tuzatish) — uning eski yozuvlari QOLADI:
//     Kurs hisobi eski summaga nisbatan tuzatma yozadi, eskisisiz u noto'g'ri
//     summa (yoki to'lanmagan "avans") bo'lib qolardi;
//   - kursga bog'lanmagan eski yozuvlar (sinov Payme to'lovlari) o'chadi.
// Balans o'chgan summaga kamaytiriladi (decrement) — shu payt kiritilgan
// to'lov yo'qolmaydi. Oldin to'liq nusxa: scratch/backup_balans_<vaqt>.json.
//
//   node scripts/eski-balansni-tozalash.js          — faqat ko'rsatadi
//   node scripts/eski-balansni-tozalash.js --apply  — nusxa oladi va o'chiradi

import fs from 'node:fs';
import prisma from '../lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const CUT = new Date('2026-09-27T19:00:00Z'); // 28.09.2026 00:00 Toshkent
const fmt = n => Math.round(n).toLocaleString('ru-RU');

async function reja() {
  const rows = await prisma.payment.findMany({ select: { id: true, studentId: true, groupId: true, amount: true, type: true, createdAt: true, schoolId: true } });
  const tegilgan = new Set(rows.filter(r => r.createdAt >= CUT && r.groupId).map(r => r.studentId + ':' + r.groupId));
  const ochadi = rows.filter(r => r.createdAt < CUT && !(r.groupId && tegilgan.has(r.studentId + ':' + r.groupId)));
  const oquvchiga = new Map();
  for (const r of ochadi) oquvchiga.set(r.studentId, (oquvchiga.get(r.studentId) || 0) + r.amount);
  return { rows, tegilgan, ochadi, oquvchiga };
}

async function holat(sarlavha) {
  const st = await prisma.student.findMany({ select: { balance: true } });
  const q = st.filter(s => s.balance < 0), a = st.filter(s => s.balance > 0);
  console.log(`${sarlavha}: qarzdor ${q.length} ta ${fmt(q.reduce((x, s) => x + s.balance, 0))} | avans ${a.length} ta ${fmt(a.reduce((x, s) => x + s.balance, 0))}`);
}

async function main() {
  await holat('Hozir');
  const r = await reja();
  console.log(`O'chadigan yozuvlar: ${r.ochadi.length} ta (${fmt(r.ochadi.reduce((a, x) => a + x.amount, 0))}), o'quvchi: ${r.oquvchiga.size}, tegilgan juftlik: ${r.tegilgan.size}`);
  if (!APPLY) { console.log('Yozish uchun: --apply'); return; }

  // 1) To'liq nusxa — kerak bo'lsa qaytarish uchun.
  const [hammaTolov, balanslar] = await Promise.all([
    prisma.payment.findMany(),
    prisma.student.findMany({ select: { id: true, balance: true } }),
  ]);
  const fayl = `scratch/backup_balans_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(fayl, JSON.stringify({ vaqt: new Date(), cut: CUT, ochiriladiganIdlar: r.ochadi.map(x => x.id), tolovlar: hammaTolov, balanslar }, null, 0));
  console.log('Nusxa:', fayl, `(${hammaTolov.length} to'lov yozuvi, ${balanslar.length} balans)`);

  // 2) Bitta tranzaksiya: o'chirish, balansni kamaytirish, poyga tekshiruvi.
  const boshlandi = new Date();
  const ids = r.ochadi.map(x => x.id);
  const juftlar = [...new Set(r.ochadi.filter(x => x.groupId).map(x => x.studentId + ':' + x.groupId))];
  await prisma.$transaction(async (tx) => {
    const del = await tx.payment.deleteMany({ where: { id: { in: ids } } });
    if (del.count !== ids.length) throw new Error(`O'chdi ${del.count}, kutilgan ${ids.length} — kimdir shu payt o'zgartirdi, bekor qilindi`);
    const qiymatlar = [...r.oquvchiga.entries()].map(([id, s]) => `(${Number(id)}, ${Number(s)})`).join(',');
    if (qiymatlar) {
      await tx.$executeRawUnsafe(`UPDATE "Student" AS s SET balance = s.balance - d.summa FROM (VALUES ${qiymatlar}) AS d(id, summa) WHERE s.id = d.id`);
    }
    // Reja tuzilgandan beri shu juftliklarga yangi hisob yozilgan bo'lsa — to'xtaymiz.
    const yangi = await tx.payment.findMany({ where: { createdAt: { gte: boshlandi }, groupId: { not: null } }, select: { studentId: true, groupId: true } });
    const poyga = yangi.filter(x => juftlar.includes(x.studentId + ':' + x.groupId));
    if (poyga.length) throw new Error(`Shu payt ${poyga.length} ta yangi hisob kiritildi — bekor qilindi, qayta ishga tushiring`);
    // Amallar jurnali — egasi ko'rsin.
    const filiallar = new Map();
    for (const x of r.ochadi) filiallar.set(x.schoolId, (filiallar.get(x.schoolId) || 0) + 1);
    for (const [schoolId, soni] of filiallar) {
      await tx.auditLog.create({ data: {
        userName: 'Tizim', action: 'delete', entity: 'payment', title: "28.09 gacha avtomatik balans",
        summary: `${soni} ta eski avtomatik hisob va sinov to'lovi o'chirildi (egasi so'rovi). Nusxa: ${fayl}`,
        method: 'SCRIPT', path: 'scripts/eski-balansni-tozalash.js', schoolId,
      } });
    }
  }, { timeout: 60000, maxWait: 15000 });
  console.log(`O'chirildi: ${ids.length} ta yozuv.`);

  // 3) Tekshiruv: balans = yozuvlar yig'indisi (hamma o'quvchida).
  const [qolgan, st] = await Promise.all([
    prisma.payment.groupBy({ by: ['studentId'], _sum: { amount: true } }),
    prisma.student.findMany({ select: { id: true, balance: true } }),
  ]);
  const yig = new Map(qolgan.map(x => [x.studentId, x._sum.amount || 0]));
  const mos = st.filter(s => Math.round(s.balance) !== Math.round(yig.get(s.id) || 0));
  console.log(mos.length ? `DIQQAT: ${mos.length} ta o'quvchida balans ≠ yozuvlar` : "Tekshiruv: hamma balans yozuvlarga mos ✓");
  await holat('Keyin');
}

main().catch(e => { console.error('XATO:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
