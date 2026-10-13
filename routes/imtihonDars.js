// Savolning video darsi yo'llari (mantiq — lib/imtihonDars.js, ovoz — lib/darsOvoz.js). Bank
// kartasidagi «Video dars»: AI tayyor yechimni ssenariyga aylantiradi (bazaga yozilmaydi) → ustoz
// ko'rib saqlaydi → ovoz yoziladi (alohida so'rov: sekin va qayta urinsa bo'ladi) → ustoz
// tasdiqlaydi. O'quvchi darsni natija sahifasida ko'radi (routes/imtihon.js, faqat tasdiqlangani).
//
// Ruxsat — routes/imtihonYechim.js dagidek: `authenticate` yo'lning aniq ko'rinishini tekshiradi,
// bu yerda yo'l shakli, savol egasi va bo'lim ruxsati yana tekshiriladi (`ruxsatniTekshir`).

import { randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { savolVariantlari } from '../lib/imtihon.js';
import { AiXato, aiSozlanganmi } from '../lib/imtihonAI.js';
import { yechimBormi } from '../lib/imtihonYechim.js';
import { bankDarsi, darsEskirganmi, darsMalumoti, darsTuz, ovozFayli, vaqtlarniQoy, yechimIzi } from '../lib/imtihonDars.js';
import { nutqniOvozga, ovozTayyormi } from '../lib/darsOvoz.js';
import { aiKontekst, ozSavoli, qismlar, ruxsatniTekshir, savolniOl } from './imtihonYechim.js';

// Ssenariy va ovoz — pullik AI so'rovlari: xodim boshiga soatiga 60 ta.
const darsCheklovi = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `dars:${req.user?.id ?? 'nomalum'}`,
  message: { error: "Video dars so'rovlari juda ko'p — bir soatdan keyin qayta urinib ko'ring" },
});

const AI_YOQILMAGAN = "AI yoqilmagan: administrator Imtihonlar → Sozlamalar bo'limida AI kalitini kiritishi kerak";
const YECHIM_KERAK = 'Video dars tayyor yechimdan tuziladi — avval yechim yozdiring';

/** Savol darsi bilan (egasini va yechimini tekshirish uchun kerakli maydonlar). */
const darsliSavol = (id) => prisma.question.findUnique({
  where: { id },
  select: { id: true, schoolId: true, solution: true, solutionStatus: true, correctAnswer: true, lesson: true },
});

/** Hamma yo'llarning javobi: {dars — null yoki bankDarsi(), yechimBor, yechimTasdiqlangan}. */
const javob = (q, dars) => ({ dars: bankDarsi(dars, q), yechimBor: yechimBormi(q.solution), yechimTasdiqlangan: q.solutionStatus === 'tasdiqlangan' });

/**
 * `storage` — Supabase Storage mijozi (server.js dagi supabaseAdmin.storage).
 */
export function registerImtihonDarsRoutes(app, { storage }) {
  /** Storage'dagi faylni o'chiradi. Xato asosiy amalni buzmaydi — fayl yetim qolgani yozuv buzilganidan yaxshi. */
  async function fayldanOchir(nom) {
    try {
      const { error } = await storage.from('uploads').remove([nom]);
      if (error) throw error;
    } catch (e) {
      console.error("[dars] ovoz fayli o'chirilmadi:", e?.message || e);
    }
  }

  /** MP3 ni ochiq Storage'ga yozadi va havolasini qaytaradi; bo'lmasa null (yuklangan fayl yetim qolmaydi). */
  async function ovozniYukla(id, mp3) {
    const nom = `dars_${id}_${Date.now()}_${randomBytes(6).toString('hex')}.mp3`;
    try {
      const { error } = await storage.from('uploads').upload(nom, mp3, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false });
      if (error) throw error;
    } catch (e) {
      console.error('[dars] ovoz Storage ga yuklanmadi:', e?.message || e);
      return null;
    }
    const url = storage.from('uploads').getPublicUrl(nom).data?.publicUrl || null;
    if (!url) await fayldanOchir(nom);
    return url;
  }

  /** Keraksiz bo'lgan dars ovozini o'chiradi (faqat o'zimizning Storage'dagi dars fayli bo'lsa). */
  async function ovozniOchir(url) {
    const nom = ovozFayli(url);
    if (nom) await fayldanOchir(nom);
  }

  // Savolning darsi (ustozga: qoralamasi ham, eskirgani ham ko'rinadi).
  app.get('/api/questions/:id/dars', authenticate, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/dars', 1);
      if (!id) return;
      const q = await ozSavoli(req, await darsliSavol(id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      res.json(javob(q, q.lesson));
    } catch (err) { next(err); }
  });

  // AI ssenariy tuzadi: saqlanmaydi. `korsatma` — ustoz dars qanday bo'lishini aytgani.
  // Javob: {qadamlar, davomiylik, ogohlar} — vaqtlar taxminiy (ovoz hali yozilmagan).
  app.post('/api/questions/:id/dars/ai', authenticate, darsCheklovi, aiKontekst, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/dars/ai');
      if (!id) return;
      const q = await ozSavoli(req, await savolniOl(id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      if (!yechimBormi(q.solution)) return res.status(400).json({ error: YECHIM_KERAK });
      if (!aiSozlanganmi()) return res.status(503).json({ error: AI_YOQILMAGAN });
      res.json(await darsTuz(q, savolVariantlari(q), { korsatma: req.body?.korsatma, ...qismlar(q) }));
    } catch (err) {
      if (err instanceof AiXato) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  // Ssenariyni saqlash ({qadamlar, korsatma?} — qoralama bo'lib) yoki faqat holatini o'zgartirish
  // ({status} — tasdiqlash / tasdiqni olish).
  app.put('/api/questions/:id/dars', authenticate, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/dars');
      if (!id) return;
      const q = await ozSavoli(req, await darsliSavol(id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      const { d, xato } = darsMalumoti(req.body, q.lesson);
      if (xato) return res.status(400).json({ error: xato });
      if (!d.qadamlar) {
        if (d.status === 'tasdiqlangan' && darsEskirganmi(q.lesson, q)) return res.status(400).json({ error: "Yechim yoki to'g'ri javob o'zgargan — darsni qayta tuzdiring, keyin tasdiqlang" });
        return res.json(javob(q, await prisma.questionLesson.update({ where: { questionId: id }, data: d })));
      }
      if (!yechimBormi(q.solution)) return res.status(400).json({ error: YECHIM_KERAK });
      // Yangi ssenariy: eski ovoz unga mos kelmaydi — olib tashlanadi (yangisi alohida yoziladi).
      const yozuv = { ...d, yechimIzi: yechimIzi(q), ovozUrl: null };
      const dars = await prisma.questionLesson.upsert({
        where: { questionId: id },
        create: { ...yozuv, questionId: id, createdById: req.user.id || null },
        update: yozuv,
      });
      await ovozniOchir(q.lesson?.ovozUrl);
      res.json(javob(q, dars));
    } catch (err) { next(err); }
  });

  // Saqlangan darsga ovoz yozish: nutq → MP3 (Storage) va qadamlarning haqiqiy vaqtlari.
  app.post('/api/questions/:id/dars/ovoz', authenticate, darsCheklovi, aiKontekst, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/dars/ovoz');
      if (!id) return;
      const q = await ozSavoli(req, await darsliSavol(id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      if (!q.lesson) return res.status(400).json({ error: "Bu savolning video darsi yo'q — avval dars tuzdiring" });
      if (!ovozTayyormi()) return res.status(503).json({ error: AI_YOQILMAGAN });
      const { mp3, chegaralar } = await nutqniOvozga(q.lesson.qadamlar);
      const url = await ovozniYukla(id, mp3);
      if (!url) return res.status(502).json({ error: "Ovoz yozildi, lekin saqlanmadi — qayta urinib ko'ring" });
      // Ovoz yozilayotganda ssenariy almashgan bo'lsa (boshqa oynada qayta saqlangan) — bu ovoz unga mos emas.
      // Yozuv saqlanmasa (xato yoki o'zgargan dars) — endigina yuklangan fayl ham olib tashlanadi.
      const { count } = await prisma.questionLesson.updateMany({
        where: { questionId: id, updatedAt: q.lesson.updatedAt },
        data: { ...vaqtlarniQoy(q.lesson.qadamlar, chegaralar), ovozUrl: url },
      }).catch(async (e) => { await ovozniOchir(url); throw e; });
      if (!count) {
        await ovozniOchir(url);
        return res.status(409).json({ error: "Dars shu orada o'zgardi — ovozni qayta yozdiring" });
      }
      await ovozniOchir(q.lesson.ovozUrl);
      res.json(javob(q, await prisma.questionLesson.findUnique({ where: { questionId: id } })));
    } catch (err) {
      if (err instanceof AiXato) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  // Darsni olib tashlash (ovoz fayli bilan). Savol va yechimga tegilmaydi.
  app.delete('/api/questions/:id/dars', authenticate, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/dars');
      if (!id) return;
      const q = await ozSavoli(req, await darsliSavol(id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      if (q.lesson) {
        await prisma.questionLesson.delete({ where: { questionId: id } });
        await ovozniOchir(q.lesson.ovozUrl);
      }
      res.json(javob(q, null));
    } catch (err) { next(err); }
  });
}
