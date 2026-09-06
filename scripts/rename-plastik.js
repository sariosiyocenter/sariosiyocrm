// "Plastik" — "Karta"ning eski nomi. Ikkita nom bitta narsani anglatardi
// (227 ta "Plastik", 2 ta "Karta"); kassa hisobi naqd/naqdsiz bo'linishiga
// tayanadi, shuning uchun bitta nomga keltiriladi. Migratsiya faylida ham
// bor (prisma/migrations/20260907_kassa), lekin Vercel `db push` ishlatadi
// va SQL migratsiyalarni yurgizmaydi — shu skript o'sha ishni qiladi.
import prisma from '../lib/prisma.js';
const r = await prisma.payment.updateMany({ where: { type: 'Plastik' }, data: { type: 'Karta' } });
console.log('Plastik -> Karta:', r.count, 'ta yozuv');
await prisma.$disconnect();
