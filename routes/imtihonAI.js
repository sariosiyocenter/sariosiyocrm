// Imtihon moduli AI yo'llari (mantiq — lib/imtihonAI.js). AI hech narsani
// o'zi faol qilmaydi: import va yechim — ko'rib chiqish uchun qaytadi, klon
// va tarjima — qoralama savol bo'lib saqlanadi, yozma bahosi — taklif.

import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { savolVariantlari, varaqTuzilmasi } from '../lib/imtihon.js';
import {
  aiSozlanganmi, aiModel, AiXato, savollarniAjrat, yechimYoz, klonlarYasa, tarjimaQil, yozmaBaho,
} from '../lib/imtihonAI.js';

// AI so'rovi pullik va sekin: xodim boshiga soatiga 120 ta.
const aiCheklovi = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // authenticate dan keyin turadi — kalit xodim (IP emas: bitta markazda hamma bir IP da).
  keyGenerator: (req) => `ai:${req.user?.id ?? 'nomalum'}`,
  message: { error: "AI so'rovlari juda ko'p — bir soatdan keyin qayta urinib ko'ring" },
});

function aiXatosi(err, res, next) {
  if (err instanceof AiXato) return res.status(err.status).json({ error: err.message });
  return next(err);
}

const tayyormi = (res) => {
  if (aiSozlanganmi()) return true;
  res.status(503).json({ error: "AI sozlanmagan: Vercel muhitiga GEMINI_API_KEY qo'shilishi kerak" });
  return false;
};

async function savolniOl(id) {
  return prisma.question.findUnique({ where: { id }, include: { passage: { select: { text: true } } } });
}

export function registerImtihonAIRoutes(app) {
  app.get('/api/ai/holat', authenticate, (req, res) => {
    res.json({ yoqilgan: aiSozlanganmi(), model: aiSozlanganmi() ? aiModel() : null });
  });

  // Fayl sahifalari (rasm) yoki matndan savollar — bankka hali yozilmaydi.
  app.post('/api/questions/ai/import', authenticate, aiCheklovi, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const { matn = '', rasmlar = [], fan = '', mavzu = '', til = 'uz' } = req.body || {};
      if (!String(fan).trim()) return res.status(400).json({ error: 'Fanni kiriting' });
      if (!String(matn).trim() && !(Array.isArray(rasmlar) && rasmlar.length)) return res.status(400).json({ error: 'Fayl yoki matn kerak' });
      res.json(await savollarniAjrat({ matn: String(matn), rasmlar: Array.isArray(rasmlar) ? rasmlar : [], fan: String(fan), mavzu: String(mavzu), til }));
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Yechim qoralamasi: saqlanmaydi — ustoz tahrirlab, o'zi saqlaydi.
  app.post('/api/questions/:id/ai/yechim', authenticate, aiCheklovi, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const q = await savolniOl(parseInt(req.params.id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      res.json(await yechimYoz(q, savolVariantlari(q)));
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Klonlar: qoralama savollar (parentId — asl savol). Tekshiruvdan o'tmagani manbasida belgilanadi.
  app.post('/api/questions/:id/ai/klon', authenticate, aiCheklovi, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const q = await savolniOl(parseInt(req.params.id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      const klonlar = await klonlarYasa(q, savolVariantlari(q), req.body?.soni);
      const yaratildi = [];
      for (const k of klonlar) {
        const { xato, matnId, tekshirildi, ...d } = k; // eslint-disable-line no-unused-vars
        const yangi = await prisma.question.create({
          data: {
            ...d,
            source: tekshirildi === false ? "AI klon (tekshiruvdan o'tmadi)" : 'AI klon',
            parentId: q.id, passageId: q.passageId, grade: q.grade, section: q.section, points: q.points,
            schoolId: q.schoolId, createdById: req.user.id || null,
          },
          select: { id: true },
        });
        yaratildi.push({ id: yangi.id, tekshirildi });
      }
      res.status(201).json({ yaratildi });
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Tarjima: yangi qoralama savol boshqa tilda (kalit o'sha — variantlar tartibi saqlanadi).
  app.post('/api/questions/:id/ai/tarjima', authenticate, aiCheklovi, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const til = String(req.body?.til || '');
      if (!['uz', 'ru', 'en'].includes(til)) return res.status(400).json({ error: 'Tilni tanlang' });
      const q = await savolniOl(parseInt(req.params.id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      if ((q.language || 'uz') === til) return res.status(400).json({ error: 'Savol allaqachon shu tilda' });
      const t = await tarjimaQil(q, savolVariantlari(q), til);
      const yangi = await prisma.question.create({
        data: {
          text: t.text, options: t.options, type: q.type, correctAnswer: q.correctAnswer, answers: q.answers ?? undefined,
          points: q.points, lockOptions: q.lockOptions, subject: q.subject, topic: t.topic || q.topic, section: q.section, grade: q.grade,
          difficulty: q.difficulty, imageUrl: q.imageUrl, language: til,
          solution: t.solution, solutionStatus: t.solution ? 'qoralama' : 'yoq',
          status: 'qoralama', source: 'AI tarjima', parentId: q.id, schoolId: q.schoolId, createdById: req.user.id || null,
        },
        select: { id: true, language: true },
      });
      res.status(201).json(yangi);
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Yozma javobga ball taklifi: rasm — varaqdagi javob katagi (mijoz kesib yuboradi).
  app.post('/api/exam-results/:id/ai/baho', authenticate, aiCheklovi, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const n = parseInt(req.body?.n);
      const r = await prisma.examResult.findUnique({ where: { id: parseInt(req.params.id) }, select: { id: true, examId: true, session: true, variantCode: true, schoolId: true } });
      if (!r) return res.status(404).json({ error: 'Natija topilmadi' });
      const e = await prisma.exam.findUnique({ where: { id: r.examId }, select: { blocks: true, scoring: true } });
      const tuzilma = varaqTuzilmasi(e.blocks, e.scoring);
      if (tuzilma.savollar.find(x => x.n === n)?.tur !== 'yozma') return res.status(400).json({ error: 'Bu yozma savol emas' });
      const v = r.variantCode ? await prisma.examVariant.findFirst({ where: { examId: r.examId, session: r.session ?? 1, code: r.variantCode } }) : null;
      const it = (Array.isArray(v?.items) ? v.items : []).find(x => x.n === n);
      if (!it) return res.status(409).json({ error: "Variant aniqlanmagan — avval variantni tanlang" });
      // "Faqat kalit" savolining matni bankda yo'q — AI faqat javobni va ballni ko'radi.
      const q = Number.isInteger(it.q) ? await savolniOl(it.q) : null;
      res.json(await yozmaBaho({ savol: q?.text || '', maks: it.p, mezon: q?.solution || '', rasm: req.body?.rasm }));
    } catch (err) { aiXatosi(err, res, next); }
  });
}

