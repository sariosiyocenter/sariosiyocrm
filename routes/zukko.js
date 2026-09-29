// Zukko — o'ng paneldagi AI yordamchi yo'llari (mantiq: lib/zukko.js,
// vositalar: lib/zukkoVositalar.js).
//
//   GET  /api/zukko/holat   — panel ochilganda: bugungi puls (AI siz), tezkor
//                             buyruqlar, sahifa konteksti, AI yoqilganmi.
//   POST /api/zukko/buyruq  — tezkor buyruq (AI siz, bir bosishda kartochka).
//   POST /api/zukko/savol   — erkin savol: Gemini + vositalar, javob oqim
//                             (text/event-stream) bo'lib keladi.
//
// Hammasi faqat o'qiydi. Amal takliflarini brauzer tasdiqlangach odatdagi API
// (POST /api/leads, PUT /api/students/:id ...) orqali bajaradi — ruxsat va
// jurnal o'sha yo'llarniki. Kalit — markazniki (Organization.aiKaliti).

import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { authenticate, allowedSchoolIds, isOrgWide, ozKurslari } from '../middleware/auth.js';
import { aiBilan, AiXato } from '../lib/imtihonAI.js';
import { toDateStr } from '../lib/lessons.js';
import { markazKaliti } from './imtihonAI.js';
import { zukkoSuhbat, zukkoTayyormi } from '../lib/zukko.js';
import {
  R, korsa, korsatkichlar, vositaniBajar, ruxsatliBuyruqlar, buyruqniBajar, sahifaKonteksti,
} from '../lib/zukkoVositalar.js';

// Har savol 1–5 ta Gemini chaqiruvi; bepul kalit daqiqasiga ~10 ta beradi.
const savolCheklovi = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `zukko:${req.user?.id ?? 'nomalum'}`,
  message: { error: "Savollar juda ko'p — bir soatdan keyin qayta urinib ko'ring. Tezkor tugmalar ishlayveradi." },
});
const buyruqCheklovi = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `zukko-b:${req.user?.id ?? 'nomalum'}`,
  message: { error: "Juda tez — bir daqiqadan keyin urinib ko'ring" },
});

/**
 * So'rov konteksti: kim, qaysi filial(lar), ruxsat. Filial /api/init dagi
 * bilan bir xil tanlanadi: tanlangan filial (ruxsati bo'lsa), 0 bo'lsa ADMIN
 * uchun hamma filiallar, qolganlarga o'z filiali.
 */
async function kontekst(req) {
  const user = req.user;
  if (!user?.schoolId) return null;
  const ruxsatli = await allowedSchoolIds(user);
  const tanlangan = parseInt(req.query?.schoolId ?? req.body?.schoolId);
  const maktablar = tanlangan > 0 && ruxsatli.includes(tanlangan)
    ? [tanlangan]
    : (isOrgWide(user) ? ruxsatli : [user.schoolId]);
  const [filiallar, org, oz] = await Promise.all([
    prisma.school.findMany({ where: { id: { in: ruxsatli } }, select: { id: true, name: true } }),
    user.organizationId ? prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null,
    req.ruxsat?.faqatOz ? ozKurslari(user) : null,
  ]);
  const nomi = new Map(filiallar.map(s => [s.id, s.name]));
  return {
    user,
    ruxsat: req.ruxsat,
    maktablar,
    oz,
    bugun: toDateStr(),
    filialNomi: (id) => nomi.get(id) || `#${id}`,
    filialMatni: maktablar.length > 1 ? `barcha filiallar (${maktablar.map(id => nomi.get(id)).join(', ')})` : (nomi.get(maktablar[0]) || '—'),
    markaz: org?.name || nomi.get(user.schoolId) || 'markaz',
  };
}

const KONTEKST_YOQ = "Zukko o'quv markazi xodimlari uchun";
const AI_YOQILMAGAN = "AI yoqilmagan: administrator Sozlamalar → Integratsiyalar → «AI yordamchi» bo'limida Gemini kalitini kiritishi kerak. Tezkor tugmalar AI siz ishlaydi.";

/** 12 400 000 → "12,4 mln" — puls kartochkalari uchun. */
function qisqa(n) {
  const x = Math.abs(Math.round(Number(n) || 0));
  const f = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (x >= 1e9) return `${f(x / 1e9)} mlrd`;
  if (x >= 1e6) return `${f(x / 1e6)} mln`;
  if (x >= 1e4) return `${Math.round(x / 1e3)} ming`;
  return x.toLocaleString('ru-RU').replace(/\s/g, ' ');
}

/** Bugungi puls — AI siz, faqat bazadan. Har kartochka bosilsa o'z buyrug'ini ochadi. */
async function puls(k) {
  const [m, d] = await Promise.all([
    korsatkichlar(k),
    korsa(k, R.darslar) ? vositaniBajar(k, 'darslar', {}) : null,
  ]);
  const out = [];
  if (d?.model) {
    const n = d.model.darslar_soni, b = d.model.davomati_belgilanmagan;
    out.push({ kalit: 'darslar', nom: 'Bugun darslar', qiymat: String(n), izoh: n ? (b ? `${b} tasida yo'qlama yo'q` : "yo'qlama to'liq") : "bugun dars yo'q", ton: b ? 'ogoh' : 'yaxshi' });
  }
  if (m.tushum) out.push({ kalit: 'bugungi-tushum', nom: 'Bugun tushum', qiymat: qisqa(m.tushum.bugun), izoh: `${m.tushum.bugun_soni} to'lov · oy ${qisqa(m.tushum.bu_oy)}`, ton: m.tushum.bugun > 0 ? 'yaxshi' : null });
  if (m.qarz) out.push({ kalit: 'qarzdorlar', nom: 'Qarz', qiymat: qisqa(m.qarz.jami), izoh: `${m.qarz.qarzdorlar} o'quvchi`, ton: m.qarz.jami ? 'xato' : 'yaxshi' });
  if (m.lidlar) out.push({ kalit: 'lidlar', nom: 'Ochiq lidlar', qiymat: String(m.lidlar.ochiq), izoh: m.lidlar.ikki_kundan_beri_javobsiz ? `${m.lidlar.ikki_kundan_beri_javobsiz} tasi 2+ kun javobsiz` : `bu oy ${m.lidlar.bu_oy} ta yangi`, ton: m.lidlar.ikki_kundan_beri_javobsiz ? 'ogoh' : null });
  if (out.length < 4 && m.oquvchilar) out.push({ kalit: 'korsatkichlar', nom: "Faol o'quvchilar", qiymat: String(m.oquvchilar.faol), izoh: `bu oy +${m.oquvchilar.bu_oy_qoshilgan}`, ton: null });
  if (out.length < 4 && korsa(k, R.davomat)) out.push({ kalit: 'kelmaganlar', nom: 'Bugun kelmaganlar', qiymat: '→', izoh: "yo'qlama bo'yicha", ton: null });
  return out.slice(0, 4);
}

function xatoJavob(err, res, next) {
  if (err instanceof AiXato) return res.status(err.status).json({ error: err.message });
  return next(err);
}

export function registerZukkoRoutes(app) {
  app.get('/api/zukko/holat', authenticate, async (req, res, next) => {
    try {
      const k = await kontekst(req);
      if (!k) return res.status(400).json({ error: KONTEKST_YOQ });
      const kalit = await markazKaliti(req.user);
      const [p, sahifa] = await Promise.all([puls(k), sahifaKonteksti(k, req.query.yol)]);
      res.json({
        ai: { yoqilgan: aiBilan(kalit, zukkoTayyormi), sozlay: req.user.role === 'ADMIN' },
        puls: p,
        buyruqlar: ruxsatliBuyruqlar(k).map(b => ({ kalit: b.kalit, nom: b.nom, sahifa: b.sahifa || null })),
        sahifa,
        filial: k.filialMatni,
      });
    } catch (err) { next(err); }
  });

  app.post('/api/zukko/buyruq', authenticate, buyruqCheklovi, async (req, res, next) => {
    try {
      const k = await kontekst(req);
      if (!k) return res.status(400).json({ error: KONTEKST_YOQ });
      const kalit = String(req.body?.buyruq || '').slice(0, 40);
      const id = parseInt(req.body?.param?.id);
      const natija = await buyruqniBajar(k, kalit, Number.isInteger(id) ? { id } : null);
      if (natija.xato) return res.status(400).json({ error: natija.xato });
      res.json({ blok: natija.blok, xulosa: natija.xulosa });
    } catch (err) { next(err); }
  });

  app.post('/api/zukko/savol', authenticate, savolCheklovi, async (req, res, next) => {
    let k, kalit;
    try {
      k = await kontekst(req);
      if (!k) return res.status(400).json({ error: KONTEKST_YOQ });
      kalit = await markazKaliti(req.user);
    } catch (err) { return next(err); }
    const savol = String(req.body?.savol ?? '').trim();
    if (!savol) return res.status(400).json({ error: 'Savol bo\'sh' });

    await aiBilan(kalit, async () => {
      if (!zukkoTayyormi()) return res.status(503).json({ error: AI_YOQILMAGAN, aiYoq: true });

      // Oqim: har hodisa alohida "data:" qatori. Vercel oqimni bufer qilsa ham
      // mijoz hammasini oxirida bir yo'la o'qiydi — natija bir xil.
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      let uzildi = false;
      res.on('close', () => { if (!res.writableEnded) uzildi = true; });
      const yubor = (h) => { if (!uzildi) res.write(`data: ${JSON.stringify(h)}\n\n`); };

      try {
        const sahifa = await sahifaKonteksti(k, req.body?.yol);
        await zukkoSuhbat({ k, savol, tarix: req.body?.tarix, sahifa, yubor, toxtadimi: () => uzildi });
      } catch (err) {
        if (err instanceof AiXato) yubor({ t: 'xato', matn: err.message, status: err.status });
        else {
          console.error('[Zukko]', err);
          yubor({ t: 'xato', matn: "Kutilmagan xato — qayta urinib ko'ring" });
        }
      }
      yubor({ t: 'tugadi' });
      res.end();
    }).catch(err => (res.headersSent ? res.end() : xatoJavob(err, res, next)));
  });
}
