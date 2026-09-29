// Hali boshlanmagan oylarga (oktabr, noyabr) oldindan yozilgan hisoblarni
// olib tashlash — bir martalik (2026-09-29).
//
// Egasi: "sentabr hali tugamadi" — "Kurs hisobi" oktabrni 29-sentabrdayoq
// yozib qo'yardi (services/enrollment.js tuzatildi: endi oy faqat kelganda
// yoziladi). Bu skript o'sha oldindan yozilgan qatorlarni o'chiradi:
//   - kelgan sana keyingi oyda va birinchi oy summasi qo'lda bo'lgan bo'lsa —
//     summa customPrices["birinchi_<kurs>"] ga ko'chadi, oylik hisob o'sha oy
//     boshida aynan shuni yozadi;
//   - qolganlarini oylik hisob o'z vaqtida to'liq (yoki kelgan sanadan) yozadi.
// Balans o'chgan summaga ko'tariladi. Oldin to'liq nusxa.
//
//   node scripts/oldindan-yozilgan-oylarni-olib-tashlash.js          — faqat ko'rsatadi
//   node scripts/oldindan-yozilgan-oylarni-olib-tashlash.js --apply  — yozadi

import fs from 'node:fs';
import prisma from '../lib/prisma.js';
import { todayTashkent, courseStartOf, birinchiOyKaliti, birinchiOyHisobi } from '../services/enrollment.js';

const APPLY = process.argv.includes('--apply');
const fmt = n => Math.round(n).toLocaleString('ru-RU');

function keyingiOyBoshi() {
  const [y, m] = todayTashkent().slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

async function main() {
  const chegara = keyingiOyBoshi();
  const rows = await prisma.payment.findMany({
    where: { date: { gte: chegara }, type: { in: ['Oylik', 'Chegirma'] } },
    select: { id: true, studentId: true, groupId: true, amount: true, date: true, description: true },
  });
  const juftlar = new Map();
  for (const r of rows) {
    const k = r.studentId + ':' + r.groupId;
    if (!juftlar.has(k)) juftlar.set(k, []);
    juftlar.get(k).push(r);
  }
  const reja = [];
  for (const [k, qatorlar] of juftlar) {
    const [sid, gid] = k.split(':').map(Number);
    const s = await prisma.student.findUnique({ where: { id: sid }, select: { id: true, name: true, balance: true, courseStart: true, customPrices: true, status: true } });
    const g = await prisma.group.findUnique({ where: { id: gid }, select: { id: true, name: true, days: true, courseId: true, course: { select: { price: true } } } });
    const kelgan = courseStartOf(s, gid);
    const oy = kelgan ? kelgan.slice(0, 7) : null;
    const boshOyQatorlari = qatorlar.filter(r => oy && String(r.date).startsWith(oy));
    const qolda = boshOyQatorlari.some(r => /qo'lda/.test(r.description || ''));
    const summa = Math.round(-boshOyQatorlari.reduce((a, r) => a + r.amount, 0));
    const birinchi = (kelgan && kelgan >= chegara && qolda) ? { oy, summa } : null;
    const ochSumma = qatorlar.reduce((a, r) => a + r.amount, 0);
    // Oylik hisob o'sha oyda nima yozishi (services/billing.js mantiqi).
    const cp = (s.customPrices && typeof s.customPrices === 'object') ? s.customPrices : {};
    const toliq = cp[gid] !== undefined ? Number(cp[gid]) : Number(g.course?.price || 0);
    const hisobOyi = oy && kelgan >= chegara ? oy : chegara.slice(0, 7);
    let keyin = toliq;
    if (birinchi) keyin = birinchi.summa;
    else if (kelgan && kelgan > `${hisobOyi}-01` && kelgan.startsWith(hisobOyi)) keyin = birinchiOyHisobi(s, g, hisobOyi, kelgan)?.due ?? toliq;
    reja.push({ s, g, qatorlar, birinchi, ochSumma, kelgan, hisobOyi, keyin });
  }

  for (const r of reja) {
    console.log(`#${r.s.id} ${r.s.name} (${r.g.name}): ${r.qatorlar.length} qator o'chadi (${fmt(r.ochSumma)}), balans ${fmt(r.s.balance)} → ${fmt(r.s.balance - r.ochSumma)}; kelgan ${r.kelgan}; ${r.hisobOyi} boshida yoziladi: ${fmt(r.keyin)}${r.birinchi ? " (qo'lda summa saqlanadi)" : ''}`);
  }
  if (!APPLY) { console.log('Yozish uchun: --apply'); return; }

  const fayl = `scratch/backup_oldindan_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(fayl, JSON.stringify({ vaqt: new Date(), qatorlar: rows, oquvchilar: reja.map(r => ({ id: r.s.id, balance: r.s.balance, customPrices: r.s.customPrices })) }));
  console.log('Nusxa:', fayl);

  await prisma.$transaction(async (tx) => {
    const del = await tx.payment.deleteMany({ where: { id: { in: rows.map(r => r.id) } } });
    if (del.count !== rows.length) throw new Error(`O'chdi ${del.count}, kutilgan ${rows.length}`);
    const oquvchiga = new Map();
    for (const r of reja) {
      const o = oquvchiga.get(r.s.id) || { ochSumma: 0, cp: (r.s.customPrices && typeof r.s.customPrices === 'object') ? { ...r.s.customPrices } : {} };
      o.ochSumma += r.ochSumma;
      if (r.birinchi) o.cp[birinchiOyKaliti(r.g.id)] = r.birinchi;
      oquvchiga.set(r.s.id, o);
    }
    for (const [id, o] of oquvchiga) {
      await tx.student.update({ where: { id }, data: { balance: { decrement: o.ochSumma }, customPrices: o.cp } });
    }
    await tx.auditLog.create({ data: {
      userName: 'Tizim', action: 'delete', entity: 'payment', title: 'Oldindan yozilgan oktabr/noyabr hisoblari',
      summary: `${rows.length} ta qator o'chirildi (${oquvchiga.size} o'quvchi): oy faqat kelganda yoziladi. Nusxa: ${fayl}`,
      method: 'SCRIPT', path: 'scripts/oldindan-yozilgan-oylarni-olib-tashlash.js', schoolId: 1,
    } });
  }, { timeout: 60000, maxWait: 15000 });
  console.log(`O'chirildi: ${rows.length} ta.`);

  const [qolgan, st] = await Promise.all([
    prisma.payment.groupBy({ by: ['studentId'], _sum: { amount: true } }),
    prisma.student.findMany({ select: { id: true, balance: true } }),
  ]);
  const yig = new Map(qolgan.map(x => [x.studentId, x._sum.amount || 0]));
  const mos = st.filter(s => Math.round(s.balance) !== Math.round(yig.get(s.id) || 0));
  console.log(mos.length ? `DIQQAT: ${mos.length} ta o'quvchida balans ≠ yozuvlar` : "Tekshiruv: hamma balans yozuvlarga mos ✓");
}

main().catch(e => { console.error('XATO:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
