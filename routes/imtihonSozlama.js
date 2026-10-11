// Imtihon modulining umumiy sozlamasi (Imtihonlar → Sozlamalar): yangi imtihon
// boshlanadigan qiymatlar va xabar matnlari — butun markazga bitta
// (Organization.imtihonSozlama, shakli va tozalash — lib/imtihonSozlama.js).
// Ruxsat — lib/ruxsatApi.js: ko'rish — imtihon modulini ko'rgan, saqlash — imtihon tuzuvchi.

import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { imtihonSozlamaTozala, yangiImtihonBoshi } from '../lib/imtihonSozlama.js';

// Ustun hali bazada yo'q (deploy'dagi `prisma db push`dan oldin) yoki Prisma mijozi hali
// qayta yasalmagan. Faqat shu holat "saqlanmagan" deb o'qiladi; boshqa xato (aloqa uzildi…)
// yuqoriga chiqadi — aks holda ekran standartni ko'rsatib, saqlanganda haqiqiy sozlamani
// bosib ketardi.
const ustunYoq = e => e?.code === 'P2022' || e?.name === 'PrismaClientValidationError';

/** Markazning saqlangan sozlamasi (xom); null — hali saqlanmagan. */
async function xomSozlama(organizationId) {
  if (!organizationId) return null;
  try {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { imtihonSozlama: true } });
    return org?.imtihonSozlama ?? null;
  } catch (e) {
    if (!ustunYoq(e)) throw e;
    console.error("Imtihon sozlamasi ustuni hali yo'q — tizim standarti ishlaydi:", e.message);
    return null;
  }
}

/** Shu xodim markazida yangi imtihon boshlanadigan qiymatlar (boshqa yo'llar uchun ham). */
export async function markazYangiImtihoni(user) {
  return yangiImtihonBoshi(await xomSozlama(user?.organizationId));
}

export function registerImtihonSozlamaRoutes(app) {
  app.get('/api/imtihon-sozlama', authenticate, async (req, res, next) => {
    try {
      const xom = await xomSozlama(req.user.organizationId);
      res.json({ sozlama: imtihonSozlamaTozala(xom), saqlangan: !!xom });
    } catch (err) { next(err); }
  });

  app.put('/api/imtihon-sozlama', authenticate, async (req, res, next) => {
    try {
      if (!req.user.organizationId) return res.status(400).json({ error: "Filial tashkilotga bog'lanmagan" });
      // Bo'sh yoki buzilgan so'rov markaz sozlamasini standartga qaytarib yubormasin.
      const yangi = req.body?.sozlama?.yangi;
      if (!yangi || typeof yangi !== 'object' || Array.isArray(yangi) || !yangi.settings || typeof yangi.settings !== 'object' || Array.isArray(yangi.settings)) {
        return res.status(400).json({ error: "Sozlama to'liq kelmadi — sahifani yangilab, qayta saqlang" });
      }
      const sozlama = imtihonSozlamaTozala(req.body.sozlama);
      await prisma.organization.update({ where: { id: req.user.organizationId }, data: { imtihonSozlama: sozlama }, select: { id: true } });
      res.json({ sozlama, saqlangan: true });
    } catch (err) { next(err); }
  });
}
