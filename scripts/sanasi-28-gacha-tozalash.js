// Sanasi 28.09.2026 dan OLDIN bo'lgan barcha hisob yozuvlarini o'chirish — bir martalik.
//
// Egasi (2026-09-29, uchinchi aniqlik): "28-sentabrgacha bo'lgan hamma narsa
// o'chsin" — kiritilgan vaqti emas, yozuvning SANASI bo'yicha. Xodimlar bugun
// kiritgan sentabr "Kurs hisobi" summalari ham o'chadi (Sarvarning 15.09 dagi
// 250 000 i ham). Balans = 28.09 va undan keyingi sanali yozuvlar.
// Istisno (egasi tanladi): 28.09 dan keyin kiritilgan PUL (kirim) sanasi oldin
// bo'lsa ham qoladi — Hakimaliyev Saidmo'minning Klik 500 000 (cheki 17.09).
// Balans o'chgan summaga kamaytiriladi (decrement). Oldin to'liq nusxa.
//
//   node scripts/sanasi-28-gacha-tozalash.js          — faqat ko'rsatadi
//   node scripts/sanasi-28-gacha-tozalash.js --apply  — nusxa oladi va o'chiradi

import fs from 'node:fs';
import prisma from '../lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const SANA = '2026-09-28';
const CUT = new Date('2026-09-27T19:00:00Z'); // 28.09.2026 00:00 Toshkent
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const kirim = r => r.amount > 0 && !['Oylik', 'Chegirma'].includes(r.type);

async function holat(sarlavha) {
  const st = await prisma.student.findMany({ select: { balance: true } });
  const q = st.filter(s => s.balance < 0), a = st.filter(s => s.balance > 0);
  console.log(`${sarlavha}: qarzdor ${q.length} ta ${fmt(q.reduce((x, s) => x + s.balance, 0))} | plyusda ${a.length} ta ${fmt(a.reduce((x, s) => x + s.balance, 0))}`);
}

async function main() {
  await holat('Hozir');
  const rows = await prisma.payment.findMany({ where: { date: { lt: SANA } }, select: { id: true, studentId: true, amount: true, type: true, date: true, createdAt: true, schoolId: true } });
  const qoladi = rows.filter(r => kirim(r) && r.createdAt >= CUT);
  const ochadi = rows.filter(r => !qoladi.includes(r));
  const oquvchiga = new Map();
  for (const r of ochadi) oquvchiga.set(r.studentId, (oquvchiga.get(r.studentId) || 0) + r.amount);
  console.log(`O'chadi: ${ochadi.length} ta (${fmt(ochadi.reduce((a, r) => a + r.amount, 0))}), o'quvchi: ${oquvchiga.size}`);
  console.log(`Qoladi (bugun kiritilgan pul): ${qoladi.map(r => `${r.id} ${r.type} ${fmt(r.amount)} ${r.date}`).join('; ') || "yo'q"}`);
  if (!APPLY) { console.log('Yozish uchun: --apply'); return; }

  const fayl = `scratch/backup_sana28_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(fayl, JSON.stringify({
    vaqt: new Date(), sana: SANA, ochiriladiganIdlar: ochadi.map(r => r.id),
    tolovlar: await prisma.payment.findMany(),
    balanslar: await prisma.student.findMany({ select: { id: true, balance: true } }),
  }));
  console.log('Nusxa:', fayl);

  const ids = ochadi.map(r => r.id);
  await prisma.$transaction(async (tx) => {
    const del = await tx.payment.deleteMany({ where: { id: { in: ids } } });
    if (del.count !== ids.length) throw new Error(`O'chdi ${del.count}, kutilgan ${ids.length} — shu payt o'zgargan, bekor qilindi`);
    const qiymatlar = [...oquvchiga.entries()].map(([id, s]) => `(${Number(id)}, ${Number(s)})`).join(',');
    if (qiymatlar) await tx.$executeRawUnsafe(`UPDATE "Student" AS s SET balance = s.balance - d.summa FROM (VALUES ${qiymatlar}) AS d(id, summa) WHERE s.id = d.id`);
    const filiallar = new Map();
    for (const r of ochadi) filiallar.set(r.schoolId, (filiallar.get(r.schoolId) || 0) + 1);
    for (const [schoolId, soni] of filiallar) {
      await tx.auditLog.create({ data: {
        userName: 'Tizim', action: 'delete', entity: 'payment', title: '28.09 gacha sanali hisoblar',
        summary: `${soni} ta yozuv o'chirildi (sanasi 28.09.2026 dan oldin; egasi so'rovi). Nusxa: ${fayl}`,
        method: 'SCRIPT', path: 'scripts/sanasi-28-gacha-tozalash.js', schoolId,
      } });
    }
  }, { timeout: 60000, maxWait: 15000 });
  console.log(`O'chirildi: ${ids.length} ta.`);

  const [qolgan, st] = await Promise.all([
    prisma.payment.groupBy({ by: ['studentId'], _sum: { amount: true } }),
    prisma.student.findMany({ select: { id: true, balance: true } }),
  ]);
  const yig = new Map(qolgan.map(x => [x.studentId, x._sum.amount || 0]));
  const mos = st.filter(s => Math.round(s.balance) !== Math.round(yig.get(s.id) || 0));
  console.log(mos.length ? `DIQQAT: ${mos.length} ta o'quvchida balans ≠ yozuvlar` : "Tekshiruv: hamma balans yozuvlarga mos ✓");
  const eski = await prisma.payment.findMany({ where: { date: { lt: SANA } }, select: { id: true, type: true, amount: true, date: true } });
  console.log(`Sanasi 28.09 dan oldingi yozuv qoldi: ${eski.length} ${eski.map(r => `(${r.id} ${r.type} ${fmt(r.amount)} ${r.date})`).join(' ')}`);
  await holat('Keyin');
}

main().catch(e => { console.error('XATO:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
