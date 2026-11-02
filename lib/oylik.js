/**
 * Xodim oyligi daftarini bazadan yig'adi (hisob qoidasi — lib/oylikDaftar.js).
 * Xodim kartasi, Moliya hisobotlari, Telegram bot va Zukko shu yerdan oladi —
 * qarz hamma joyda bir xil ta'rifda chiqsin.
 */
import prisma from './prisma.js';
import { oylikDaftari, joriyOyKaliti, taqsimla, oyMatni } from './oylikDaftar.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');

/** @returns {Promise<Map<number, ReturnType<typeof oylikDaftari>>>} */
export async function oylikDaftarlari(userIds, joriyOy = joriyOyKaliti()) {
  const ids = [...new Set(userIds.map(Number))].filter(Number.isInteger);
  if (!ids.length) return new Map();
  const [hisoblar, tolovlar] = await Promise.all([
    prisma.salaryAccrual.findMany({ where: { userId: { in: ids } } }),
    prisma.salaryPayment.findMany({ where: { userId: { in: ids } } }),
  ]);
  const boyicha = (rows) => {
    const m = new Map(ids.map(id => [id, []]));
    for (const r of rows) m.get(r.userId)?.push(r);
    return m;
  };
  const h = boyicha(hisoblar);
  const t = boyicha(tolovlar);
  return new Map(ids.map(id => [id, oylikDaftari({ hisoblar: h.get(id), tolovlar: t.get(id), joriyOy })]));
}

export async function oylikDaftari1(userId, joriyOy) {
  return (await oylikDaftarlari([userId], joriyOy)).get(Number(userId));
}

/** Yangi to'lov qaysi oylarga tushishini so'z bilan: "Oktabr 2026 qoldig'i, avans". */
export function taqsimTavsifi(daftar, summa) {
  const { qismlar, avans } = taqsimla(daftar, summa);
  const qism = qismlar.map(q => oyMatni(q.month) + (q.keyin > 0 ? ' (qisman)' : ''));
  if (avans > 0) qism.push('avans');
  return qism.join(', ') || 'avans';
}

/** Oylik berilganda xodimga ketadigan Telegram matni. */
export function oylikTolovXabari({ ism, summa, oldin, keyin, izoh }) {
  const { qismlar, avans } = taqsimla(oldin, summa);
  const satrlar = ['💰 Oylik berildi', '', '👤 ' + ism, `💵 Summa: ${som(summa)} so'm`];
  for (const q of qismlar) satrlar.push(`   • ${oyMatni(q.month)}: ${som(q.summa)}${q.keyin > 0 ? ` (yana ${som(q.keyin)} qoldi)` : ' — yopildi'}`);
  if (avans > 0) satrlar.push(`   • Avans: ${som(avans)} (keyingi oydan ushlanadi)`);
  satrlar.push('');
  satrlar.push(keyin.yopiqQarz > 0 ? `📌 Markazning sizdan qarzi: ${som(keyin.yopiqQarz)} so'm` : "📌 Yopilgan oylar bo'yicha qarz yo'q");
  if (izoh) satrlar.push('📝 ' + izoh);
  return satrlar.join('\n');
}
