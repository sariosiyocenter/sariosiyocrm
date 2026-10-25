// Ish o'lchovi: brauzer oynada bosqich vaqtlari va qotishlarni yuboradi (src/lib/olchagich.ts).
// Bitta oyna ochilishi — bitta yozuv: sessiya bo'yicha yangilanib boradi (har 30 s, katta qotishdan
// keyin va oyna yopilganda). Boshqa xodimning yozuvini yangilab bo'lmaydi. Jadval — IshOlchovi.

import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { olchovniTekshir, OLCHOV_KUN } from '../lib/olchov.js';

const olchovCheklovi = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `olchov:${req.user?.id ?? 'nomalum'}`,
  message: { error: "O'lchov so'rovlari juda ko'p" },
});

export function registerOlchovRoutes(app) {
  app.post('/api/olchov', authenticate, olchovCheklovi, async (req, res, next) => {
    try {
      const t = olchovniTekshir(req.body);
      if (t.xato) return res.status(400).json({ error: t.xato });
      const eski = await prisma.ishOlchovi.findUnique({ where: { sessiya: t.sessiya }, select: { userId: true } });
      if (eski && eski.userId !== (req.user?.id ?? null)) return res.status(403).json({ error: "Bu o'lchov boshqa xodimniki" });
      const schoolId = req.user?.schoolId ?? null;
      await prisma.ishOlchovi.upsert({
        where: { sessiya: t.sessiya },
        create: { sessiya: t.sessiya, joy: t.joy, userId: req.user?.id ?? null, schoolId, malumot: t.malumot },
        update: { malumot: t.malumot },
      });
      // Eskilari vaqti-vaqti bilan tozalanadi (alohida cron shart emas).
      if (Math.random() < 0.02) {
        await prisma.ishOlchovi.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - OLCHOV_KUN * 24 * 3600e3) } } }).catch(() => undefined);
      }
      res.status(204).end();
    } catch (err) { next(err); }
  });
}
