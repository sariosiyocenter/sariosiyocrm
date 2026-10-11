// Savol yechimi yo'llari (mantiq — lib/imtihonYechim.js). Bank kartasidagi «Yechimni
// ko'rish» / «Yechimni o'zgartirish»: AI yechim yozadi — bazaga yozilmaydi, ustoz ko'rib,
// o'zi saqlaydi. Guruhli savol bo'laklari (juft, qismli) uchun ham ishlaydi — ularni
// PUT /api/questions/:id qabul qilmaydi.
//
// Ruxsat: `authenticate` yozuv egasini (middleware/auth.js recordAccessError) va bo'lim
// ruxsatini (lib/ruxsatApi.js) yo'lning ANIQ ko'rinishi bo'yicha tekshiradi. Express esa
// yo'lni harf kattaligiga qaramay ("/API/…") va "042", "%34%32" kabi id bilan ham shu
// handlerga olib keladi — o'shanda u tekshiruvlar (va jurnal) chetlab o'tiladi. Shuning
// uchun bu yerda yo'l shakli, savol egasi va ruxsat yana tekshiriladi (`ruxsatniTekshir`).

import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { authenticate, sameOrganization } from '../middleware/auth.js';
import { yetadimi } from '../lib/ruxsatlar.js';
import { savolVariantlari, QISM_HARFLARI } from '../lib/imtihon.js';
import { AiXato, aiBilan } from '../lib/imtihonAI.js';
import { markazKaliti } from './imtihonAI.js';
import { yechimTuz, rasmlarniOl, savolRasmlari, yechimBormi, yechimAiTayyormi, yechimMalumoti, aniqYolId, YECHIM_MAX } from '../lib/imtihonYechim.js';

// AI so'rovi pullik va sekin: xodim boshiga soatiga 120 ta (boshqa AI yo'llaridagidek).
const yechimCheklovi = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // authenticate dan keyin turadi — kalit xodim (IP emas: bitta markazda hamma bir IP da).
  keyGenerator: (req) => `yechim:${req.user?.id ?? 'nomalum'}`,
  message: { error: "AI so'rovlari juda ko'p — bir soatdan keyin qayta urinib ko'ring" },
});

const AI_YOQILMAGAN = "AI yoqilmagan: administrator Imtihonlar → Sozlamalar bo'limida AI kalitini kiritishi kerak";
const BOLIM = 'imtihonlar.savollar';

// So'rov oxirigacha markaz kaliti bilan ishlaydi (lib/imtihonAI.js dagi AsyncLocalStorage).
const aiKontekst = async (req, res, next) => {
  let kalit;
  try { kalit = await markazKaliti(req.user); } catch (err) { return next(err); }
  aiBilan(kalit, () => next());
};

/**
 * So'rov shu yo'lning aniq ko'rinishidami va xodim savollar bankini o'zgartira oladimi.
 * Javob yuborilgan bo'lsa (ruxsat yo'q) — false. `oxiri` — id dan keyingi qism ("/yechim").
 */
function ruxsatniTekshir(req, res, oxiri) {
  const id = aniqYolId(req.path, req.params.id, oxiri);
  if (!id) {
    res.status(404).json({ error: 'Savol topilmadi' });
    return 0;
  }
  if (!yetadimi(req.ruxsat, BOLIM, 2)) {
    res.status(403).json({ error: "Savollar bankini o'zgartirishga ruxsatingiz yo'q. Administratorga murojaat qiling.", ruxsat: true });
    return 0;
  }
  return id;
}

/** Savol shu xodimning markaziniki bo'lsa — o'zi, aks holda null (boshqa markaz savoli "topilmadi" bo'lib ko'rinadi). */
const ozSavoli = async (req, q) => (q && (await sameOrganization(req.user, q.schoolId)) ? q : null);

/** Savol umumiy sharti bilan (guruhli savolda — boshqa bo'laklari ham: qismlar bir-biriga bog'liq). */
const savolniOl = (id) => prisma.question.findUnique({
  where: { id },
  include: { passage: { select: { tur: true, text: true, imageUrl: true, variantlar: true, questions: { select: { id: true, text: true, correctAnswer: true }, orderBy: { id: 'asc' } } } } },
});

/** Qismli savol: shu qismning harfi va boshqa qismlar (AI ga ma'lumot uchun). */
function qismlar(q) {
  if (q.type !== 'qismli') return { qism: '', qoshnilar: [] };
  const hammasi = (q.passage?.questions || []).map((x, i) => ({ id: x.id, belgi: QISM_HARFLARI[i] || String(i + 1), matn: x.text, javob: x.correctAnswer || '' }));
  return { qism: hammasi.find(x => x.id === q.id)?.belgi || '', qoshnilar: hammasi.filter(x => x.id !== q.id) };
}

export function registerImtihonYechimRoutes(app) {
  // AI yechim yozadi: saqlanmaydi. `korsatma` — ustoz yechim qanday bo'lishini aytgani (bo'sh
  // bo'lsa: yozma savol — batafsil, qolganlari — qisqa); `asos` — talab ekranda turgan, hali
  // saqlanmagan yechimga nisbatan aytilgan bo'lsa — o'sha yechim (berilmasa — bankdagisi).
  // Javob: {yechim, aiJavobi, mos, kalit, izoh, rasmKerak, rasm: {jami, berildi}} — `mos: false`
  // bo'lsa ekranda ogohlantirish chiqadi.
  app.post('/api/questions/:id/yechim/ai', authenticate, yechimCheklovi, aiKontekst, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/yechim/ai');
      if (!id) return;
      const q = await ozSavoli(req, await savolniOl(id));
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      if (!yechimAiTayyormi()) return res.status(503).json({ error: AI_YOQILMAGAN });
      const variantlar = savolVariantlari(q);
      const rasmlar = await rasmlarniOl(savolRasmlari(q, variantlar));
      const asos = typeof req.body?.asos === 'string' && req.body.asos.trim() ? req.body.asos.slice(0, YECHIM_MAX) : null;
      const natija = await yechimTuz(q, variantlar, { korsatma: req.body?.korsatma, asos, rasmlar, ...qismlar(q) });
      res.json({ ...natija, rasm: { jami: rasmlar.jami, berildi: rasmlar.qismlar.length } });
    } catch (err) {
      if (err instanceof AiXato) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  // Yechimni saqlash ({solution, solutionStatus}) yoki faqat holatini o'zgartirish
  // ({solutionStatus} — tasdiqlash / tasdiqni olish).
  app.put('/api/questions/:id/yechim', authenticate, async (req, res, next) => {
    try {
      const id = ruxsatniTekshir(req, res, '/yechim');
      if (!id) return;
      const eski = await ozSavoli(req, await prisma.question.findUnique({ where: { id }, select: { solution: true, schoolId: true } }));
      if (!eski) return res.status(404).json({ error: 'Savol topilmadi' });
      const { d, xato } = yechimMalumoti(req.body, eski);
      if (xato) return res.status(400).json({ error: xato });
      const q = await prisma.question.update({ where: { id }, data: d, select: { id: true, solution: true, solutionStatus: true } });
      res.json({ ...q, yechimBor: yechimBormi(q.solution) });
    } catch (err) { next(err); }
  });
}
