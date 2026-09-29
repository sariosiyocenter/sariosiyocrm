// Imtihon moduli AI yo'llari (mantiq — lib/imtihonAI.js). AI hech narsani
// o'zi faol qilmaydi: import, yechim va o'xshash savollar — ko'rib chiqish
// uchun qaytadi, klon va tarjima — qoralama savol bo'lib saqlanadi, yozma
// bahosi — taklif.
//
// Kalit: markaz administratori CRM da kiritadi (Organization.aiKaliti,
// PUT /api/ai/kalit) — har so'rov shu kalit bilan (aiBilan); kiritilmagan
// bo'lsa serverdagi GEMINI_API_KEY. Kalit brauzerga hech qachon qaytmaydi.

import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { encryptSecret, decryptSecret } from '../lib/secrets.js';
import { authenticate, organizationSchoolIds } from '../middleware/auth.js';
import { savolVariantlari, varaqTuzilmasi, turi, qiyinlikDarajasi, HARFLAR } from '../lib/imtihon.js';
import {
  aiSozlanganmi, aiModel, AiXato, aiBilan, serverKaliti, kalitniTekshir, htmldanMatn, matnIzi,
  savollarniAjrat, yechimYoz, klonlarYasa, savollarniTekshir, tarjimaQil, yozmaBaho,
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

const AI_YOQILMAGAN = "AI yoqilmagan: administrator Sozlamalar → Integratsiyalar bo'limida AI kalitini kiritishi kerak";

const tayyormi = (res) => {
  if (aiSozlanganmi()) return true;
  res.status(503).json({ error: AI_YOQILMAGAN });
  return false;
};

/**
 * Markazning o'z kaliti (bo'lmasa ''). lib/prisma.js da global omit — shuning
 * uchun aniq so'raladi; bazada SETTINGS_KEY bilan shifrlangan (Eskiz, Payme kabi).
 */
async function markazKaliti(user) {
  if (!user?.organizationId) return '';
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { aiKaliti: true } });
  return decryptSecret(org?.aiKaliti || '') || '';
}

// So'rov oxirigacha markaz kaliti bilan ishlaydi (lib dagi AsyncLocalStorage).
const aiKontekst = async (req, res, next) => {
  let kalit;
  try { kalit = await markazKaliti(req.user); } catch (err) { return next(err); }
  aiBilan(kalit, () => next());
};

const adminmi = (user) => user?.role === 'ADMIN';

/** Holat: kalit qayerdan, yoqilganmi; kalitning oxirgi 4 belgisi — faqat administratorga. */
async function holatOl(user) {
  const kalit = await markazKaliti(user);
  const yoqilgan = aiBilan(kalit, aiSozlanganmi);
  return {
    yoqilgan,
    model: yoqilgan ? aiModel() : null,
    manba: kalit ? 'markaz' : serverKaliti() ? 'server' : null,
    sozlay: adminmi(user),
    kalitOxiri: adminmi(user) && kalit ? kalit.slice(-4) : null,
  };
}

/**
 * Mijozdan kelgan savol (hali bankda bo'lmasligi mumkin — masalan rasmdan
 * o'qilgan) → AI ga beriladigan shakl; o'lchamlar cheklanadi.
 */
function kelganSavol(s) {
  const type = turi(s?.type);
  return {
    type,
    text: String(s?.text ?? '').slice(0, 20000),
    options: type === 'yopiq' && Array.isArray(s?.options) ? s.options.slice(0, HARFLAR.length).map(x => String(x ?? '').slice(0, 4000)) : [],
    correctAnswer: String(s?.correctAnswer ?? '').trim().slice(0, 40),
    answers: null,
    subject: String(s?.subject ?? '').trim().slice(0, 200),
    topic: String(s?.topic ?? '').trim().slice(0, 200),
    difficulty: qiyinlikDarajasi(s?.difficulty || 2),
    language: ['uz', 'ru', 'en'].includes(s?.language) ? s.language : 'uz',
    passage: s?.passage?.text ? { text: String(s.passage.text).slice(0, 20000) } : null,
  };
}

const savolKamchiligi = (q) => (!htmldanMatn(q.text) ? 'Savol matni kerak'
  : q.type === 'yopiq' && q.options.filter(o => htmldanMatn(o)).length < 2 ? 'Variantlar kam' : null);

async function savolniOl(id) {
  return prisma.question.findUnique({ where: { id }, include: { passage: { select: { text: true } } } });
}

export function registerImtihonAIRoutes(app) {
  app.get('/api/ai/holat', authenticate, async (req, res, next) => {
    try { res.json(await holatOl(req.user)); } catch (err) { next(err); }
  });

  // Markaz kaliti: saqlashdan oldin kichik so'rov bilan sinaladi; bo'sh — o'chirish.
  app.put('/api/ai/kalit', authenticate, aiCheklovi, async (req, res, next) => {
    try {
      if (!adminmi(req.user)) return res.status(400).json({ error: 'AI kalitini faqat administrator kiritadi' });
      if (!req.user.organizationId) return res.status(400).json({ error: "Filial tashkilotga bog'lanmagan" });
      const kalit = String(req.body?.kalit ?? '').trim();
      if (kalit && (kalit.length < 20 || kalit.length > 200 || /\s/.test(kalit))) {
        return res.status(400).json({ error: "Kalit to'liq emas — aistudio.google.com/apikey dan «Copy» tugmasi bilan nusxalang" });
      }
      if (kalit) {
        try { await kalitniTekshir(kalit); } catch (err) {
          if (err instanceof AiXato) return res.status(err.status === 429 ? 429 : 400).json({ error: err.message });
          throw err;
        }
      }
      await prisma.organization.update({ where: { id: req.user.organizationId }, data: { aiKaliti: kalit ? encryptSecret(kalit) : null }, select: { id: true } });
      res.json(await holatOl(req.user));
    } catch (err) { next(err); }
  });

  // Fayl sahifalari (rasm) yoki matndan savollar — bankka hali yozilmaydi.
  // Fayl sahifalari (rasm) yoki matndan savollar — bankka hali yozilmaydi. `mavzular` —
  // fanning mavzulari (AI savolni shularga ajratadi); bankda allaqachon bor savol
  // (matni aynan bir xil, shu fanda) `takrorId` bilan qaytadi.
  app.post('/api/questions/ai/import', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const { matn = '', rasmlar = [], fan = '', mavzu = '', mavzular = [], til = 'uz' } = req.body || {};
      if (!String(fan).trim()) return res.status(400).json({ error: 'Fanni kiriting' });
      if (!String(matn).trim() && !(Array.isArray(rasmlar) && rasmlar.length)) return res.status(400).json({ error: 'Fayl yoki matn kerak' });
      const natija = await savollarniAjrat({
        matn: String(matn), rasmlar: Array.isArray(rasmlar) ? rasmlar : [], fan: String(fan), mavzu: String(mavzu),
        mavzular: Array.isArray(mavzular) ? mavzular : [], til: ['uz', 'ru', 'en', 'auto'].includes(til) ? til : 'uz',
      });
      if (natija.savollar.length) {
        const orgIds = await organizationSchoolIds(req.user);
        const bor = await prisma.question.findMany({
          where: { schoolId: { in: orgIds }, subject: { equals: String(fan).trim(), mode: 'insensitive' } },
          select: { id: true, text: true },
        });
        const izlar = new Map(bor.map(q => [matnIzi(q.text), q.id]));
        natija.savollar.forEach(q => { q.takrorId = izlar.get(matnIzi(q.text)) ?? null; });
      }
      res.json(natija);
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Yechim qoralamasi: saqlanmaydi — ustoz tahrirlab, o'zi saqlaydi.
  app.post('/api/questions/:id/ai/yechim', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const q = await savolniOl(parseInt(req.params.id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      res.json(await yechimYoz(q, savolVariantlari(q)));
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Klonlar: qoralama savollar (parentId — asl savol). Tekshiruvdan o'tmagani manbasida belgilanadi.
  app.post('/api/questions/:id/ai/klon', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const q = await savolniOl(parseInt(req.params.id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      const klonlar = await klonlarYasa(q, savolVariantlari(q), { soni: req.body?.soni });
      const yaratildi = [];
      for (const k of klonlar) {
        const { xato, matnId, tekshirildi, aslBilanBir, raqam, javobManbasi, ...d } = k; // eslint-disable-line no-unused-vars
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

  // O'xshash savollar (rasmdan o'qilgan yoki bankdagi savolga): saqlanmaydi —
  // ustoz ko'rib, tanlab bankka qo'shadi. Tekshiruv — alohida so'rov (/tekshir):
  // har so'rovda bitta AI chaqiruvi, Vercel vaqt chegarasiga sig'adi.
  app.post('/api/ai/oxshash', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const q = kelganSavol(req.body?.savol);
      const kamchilik = savolKamchiligi(q);
      if (kamchilik) return res.status(400).json({ error: kamchilik });
      const usul = req.body?.usul === 'vaziyat' ? 'vaziyat' : 'sonlar';
      const klonlar = await klonlarYasa(q, q.options, { soni: req.body?.soni, usul, tur: req.body?.tur || null, tekshir: false });
      res.json({ klonlar: klonlar.map(({ matnId, ...k }) => k) }); // eslint-disable-line no-unused-vars
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Mustaqil tekshiruv: AI savollarni kalitni ko'rmay yechadi (12 tagacha).
  app.post('/api/ai/tekshir', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
    try {
      if (!tayyormi(res)) return;
      const royxat = (Array.isArray(req.body?.savollar) ? req.body.savollar : []).slice(0, 12).map(kelganSavol);
      if (!royxat.length) return res.status(400).json({ error: "Savollar ro'yxati bo'sh" });
      res.json({ natijalar: await savollarniTekshir(royxat) });
    } catch (err) { aiXatosi(err, res, next); }
  });

  // Tarjima: yangi qoralama savol boshqa tilda (kalit o'sha — variantlar tartibi saqlanadi).
  app.post('/api/questions/:id/ai/tarjima', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
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
  app.post('/api/exam-results/:id/ai/baho', authenticate, aiCheklovi, aiKontekst, async (req, res, next) => {
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

