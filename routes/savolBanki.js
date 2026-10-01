// Savollar banki tuzilmasi: fan → mavzu → qiyinlik. Daraxt (har mavzuda
// qiyinlik va tur bo'yicha sonlar), fan va mavzularni boshqarish, o'quv
// rejadan mavzular, savollarni ommaviy o'zgartirish, qiyinlikni imtihon
// natijasiga moslash. Savoldagi subject/topic — tuzilmadagi nomlarning nusxasi
// (eski imtihon qoidalari nom bo'yicha ishlaydi), nom o'zgarsa ular ham yangilanadi.

import prisma from '../lib/prisma.js';
import { authenticate, organizationSchoolIds } from '../middleware/auth.js';
import { turi, savolXatosi, qiyinlikDarajasi, natijaQiyinligi, qiyinlikMosEmas, mavzuMavjudligi, filtrMos, SAVOL_HOLATLARI, savolVariantlari } from '../lib/imtihon.js';

const nomi = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const kalit = v => nomi(v).toLowerCase();
const ANY_ID = v => { const n = parseInt(v); return Number.isInteger(n) && n > 0 ? n : null; };

class XatoJavob extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function fanniOl(id, orgIds) {
  if (!ANY_ID(id)) throw new XatoJavob(400, 'Fan tanlanmagan');
  const f = await prisma.questionSubject.findUnique({ where: { id }, include: { topics: true } });
  if (!f || !orgIds.includes(f.schoolId)) throw new XatoJavob(404, 'Fan topilmadi');
  return f;
}

async function mavzuniOl(id, orgIds) {
  if (!ANY_ID(id)) throw new XatoJavob(400, 'Mavzu tanlanmagan');
  const t = await prisma.questionTopic.findUnique({ where: { id }, include: { subject: true } });
  if (!t || !orgIds.includes(t.subject.schoolId)) throw new XatoJavob(404, 'Mavzu topilmadi');
  return t;
}

/** Fan va mavzu nomidan mavzu (topilmasa yaratiladi) — Excel, AI va eski savollar uchun. */
export async function mavzuniNomdanTop(orgIds, fanNomi, mavzuNomi, schoolId, bolim = null) {
  const fn = nomi(fanNomi, 120);
  const mn = nomi(mavzuNomi) || 'Umumiy';
  if (!fn) return null;
  const fanlar = await prisma.questionSubject.findMany({ where: { schoolId: { in: orgIds } }, include: { topics: true } });
  let fan = fanlar.find(f => kalit(f.name) === kalit(fn));
  if (!fan) {
    const tartib = fanlar.reduce((a, f) => Math.max(a, f.order), 0) + 1;
    fan = await prisma.questionSubject.create({ data: { name: fn, order: tartib, schoolId }, include: { topics: true } });
  }
  let mavzu = fan.topics.find(t => kalit(t.name) === kalit(mn));
  if (!mavzu) {
    const tartib = fan.topics.reduce((a, t) => Math.max(a, t.order), 0) + 1;
    mavzu = await prisma.questionTopic.create({ data: { subjectId: fan.id, name: mn, section: nomi(bolim) || null, order: tartib } });
  }
  return { fan, mavzu };
}

/**
 * Tuzilmaga bog'lanmagan savollarni (eski yozuvlar, Excel va AI import) fan
 * va mavzu nomi bo'yicha bog'laydi, topilmasa yaratadi. Bog'lanmagan savol
 * bo'lmasa — bitta yengil so'rov.
 */
export async function bankniSinxronla(orgIds) {
  const royxat = await prisma.question.findMany({
    where: { schoolId: { in: orgIds }, bankTopicId: null },
    select: { id: true, subject: true, topic: true, section: true, schoolId: true },
  });
  if (!royxat.length) return 0;
  const guruh = new Map();
  for (const q of royxat) {
    const k = `${kalit(q.subject)}|${kalit(q.topic) || 'umumiy'}`;
    if (!guruh.has(k)) guruh.set(k, { q, ids: [] });
    guruh.get(k).ids.push(q.id);
  }
  for (const { q, ids } of guruh.values()) {
    const r = await mavzuniNomdanTop(orgIds, q.subject, q.topic, q.schoolId, q.section);
    if (!r) continue;
    await prisma.question.updateMany({ where: { id: { in: ids } }, data: { bankTopicId: r.mavzu.id, subject: r.fan.name, topic: r.mavzu.name } });
  }
  return royxat.length;
}

/** Qulflanmagan imtihonlardagi fan/mavzu nomlarini yangilash (qoidalar id bilan bog'langan). */
async function imtihonNomlariniYangila(orgIds, { fanId, eskiFan, yangiFan, mavzuId, yangiMavzu }) {
  const exams = await prisma.exam.findMany({ where: { schoolId: { in: orgIds }, lockedAt: null }, select: { id: true, blocks: true } });
  for (const e of exams) {
    let ozgardi = false;
    const blocks = (Array.isArray(e.blocks) ? e.blocks : []).map(b => {
      const nb = { ...b };
      if (fanId && yangiFan && (Number(b.fanId) === fanId || (!b.fanId && kalit(b.subject) === kalit(eskiFan)))) {
        if (nb.subject !== yangiFan) { nb.subject = yangiFan; ozgardi = true; }
      }
      if (mavzuId && yangiMavzu) {
        nb.topicRules = (b.topicRules || []).map(r => {
          if (Number(r.mavzuId) !== mavzuId || r.topic === yangiMavzu) return r;
          ozgardi = true;
          return { ...r, topic: yangiMavzu };
        });
      }
      return nb;
    });
    if (ozgardi) await prisma.exam.update({ where: { id: e.id }, data: { blocks } });
  }
}

export function registerSavolBankiRoutes(app) {
  const xato = (res, next) => err => (err instanceof XatoJavob ? res.status(err.status).json({ error: err.message }) : next(err));

  // Butun bank bitta javobda: fanlar → mavzular, har mavzuda sonlar. Savol matni
  // yuklanmaydi (bank minglab savol bo'lsa ham yengil): yaroqlilik uchun matn
  // bor-yo'qligi SQL da hisoblanadi.
  app.get('/api/bank/daraxt', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      await bankniSinxronla(orgIds);
      const til = ['uz', 'ru', 'en'].includes(req.query.til) ? req.query.til : null;
      const [fanlar, savollar] = await Promise.all([
        prisma.questionSubject.findMany({ where: { schoolId: { in: orgIds } }, include: { topics: true }, orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
        prisma.$queryRaw`
          SELECT id, "bankTopicId", difficulty, type, status, "passageId", "pCorrect", "usedCount", language,
                 options, "optionA", "optionB", "optionC", "optionD", "correctAnswer", answers,
                 ("imageUrl" IS NOT NULL) AS "rasmBor", (btrim(text) <> '') AS "matnBor"
          FROM "Question" WHERE "schoolId" = ANY(${orgIds})`,
      ]);
      const bosh = () => ({ jami: 0, faol: 0, qoralama: 0, arxiv: 0, xatoli: 0, qiyinlik: [0, 0, 0], turlar: { yopiq: 0, raqamli: 0, yozma: 0 }, natijaYig: 0, natijaSoni: 0, moslash: 0, yaroqli: [] });
      const mv = new Map();
      for (const q of savollar) {
        if (!q.bankTopicId) continue;
        if (!mv.has(q.bankTopicId)) mv.set(q.bankTopicId, bosh());
        const s = mv.get(q.bankTopicId);
        s.jami++;
        if (q.status === 'arxiv') { s.arxiv++; continue; }
        const d = qiyinlikDarajasi(q.difficulty);
        s.qiyinlik[d - 1]++;
        s.turlar[turi(q.type)]++;
        if (q.status === 'qoralama') { s.qoralama++; continue; }
        s.faol++;
        const x = savolXatosi({ ...q, text: q.matnBor ? 'x' : '', imageUrl: q.rasmBor ? 'x' : null });
        if (x) { s.xatoli++; continue; }
        if (!til || (q.language || 'uz') === til) s.yaroqli.push({ id: q.id, type: q.type, difficulty: d, passageId: q.passageId });
        if (natijaQiyinligi(q.pCorrect) && q.usedCount > 0) {
          s.natijaYig += Number(q.pCorrect);
          s.natijaSoni++;
          if (qiyinlikMosEmas(d, q.pCorrect)) s.moslash++;
        }
      }
      const yaxlit = x => Math.round(x * 1000) / 10;
      let jami = 0;
      const out = fanlar.map(f => {
        const fan = { id: f.id, name: f.name, order: f.order, jami: 0, faol: 0, qoralama: 0, arxiv: 0, xatoli: 0, qiyinlik: [0, 0, 0], turlar: { yopiq: 0, raqamli: 0, yozma: 0 }, natija: null, moslash: 0, mavzular: [] };
        let yig = 0, soni = 0;
        fan.mavzular = [...f.topics].sort((a, b) => a.order - b.order || a.id - b.id).map(t => {
          const s = mv.get(t.id) || bosh();
          for (const k of ['jami', 'faol', 'qoralama', 'arxiv', 'xatoli', 'moslash']) fan[k] += s[k];
          for (let i = 0; i < 3; i++) fan.qiyinlik[i] += s.qiyinlik[i];
          for (const k of Object.keys(fan.turlar)) fan.turlar[k] += s.turlar[k];
          yig += s.natijaYig; soni += s.natijaSoni;
          return {
            id: t.id, name: t.name, section: t.section, order: t.order,
            jami: s.jami, faol: s.faol, qoralama: s.qoralama, arxiv: s.arxiv, xatoli: s.xatoli,
            qiyinlik: s.qiyinlik, turlar: s.turlar, bor: mavzuMavjudligi(s.yaroqli),
            natija: s.natijaSoni ? yaxlit(s.natijaYig / s.natijaSoni) : null, moslash: s.moslash,
          };
        });
        fan.natija = soni ? yaxlit(yig / soni) : null;
        jami += fan.jami;
        return fan;
      });
      res.json({ jami, fanlar: out });
    } catch (err) { next(err); }
  });

  // --- Fanlar ---

  app.post('/api/bank/fanlar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const name = nomi(req.body.name, 120);
      if (!name) return res.status(400).json({ error: 'Fan nomini kiriting' });
      const bor = await prisma.questionSubject.findMany({ where: { schoolId: { in: orgIds } }, select: { name: true, order: true } });
      if (bor.some(f => kalit(f.name) === kalit(name))) return res.status(409).json({ error: `«${name}» fani bankda bor` });
      const f = await prisma.questionSubject.create({ data: { name, order: bor.reduce((a, x) => Math.max(a, x.order), 0) + 1, schoolId: req.user.schoolId || orgIds[0] } });
      res.status(201).json(f);
    } catch (err) { xato(res, next)(err); }
  });

  // Tartib: fanlar ro'yxatidagi joyi (ids — yangi tartibda).
  app.post('/api/bank/fanlar/tartib', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(ANY_ID).filter(Boolean).slice(0, 200);
      const fanlar = await prisma.questionSubject.findMany({ where: { id: { in: ids }, schoolId: { in: orgIds } }, select: { id: true } });
      const ruxsat = new Set(fanlar.map(f => f.id));
      await prisma.$transaction(ids.filter(id => ruxsat.has(id)).map((id, i) => prisma.questionSubject.update({ where: { id }, data: { order: i + 1 } })));
      res.json({ success: true });
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/fanlar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(parseInt(req.params.id), orgIds);
      const d = {};
      if (req.body.name !== undefined) {
        d.name = nomi(req.body.name, 120);
        if (!d.name) return res.status(400).json({ error: 'Fan nomini kiriting' });
        const boshqa = await prisma.questionSubject.findMany({ where: { schoolId: { in: orgIds }, id: { not: f.id } }, select: { name: true } });
        if (boshqa.some(x => kalit(x.name) === kalit(d.name))) return res.status(409).json({ error: `«${d.name}» fani bankda bor` });
      }
      if (req.body.order !== undefined) d.order = parseInt(req.body.order) || 0;
      const yangi = await prisma.questionSubject.update({ where: { id: f.id }, data: d });
      if (d.name && d.name !== f.name) {
        await prisma.question.updateMany({ where: { bankTopicId: { in: f.topics.map(t => t.id) } }, data: { subject: d.name } });
        await prisma.passage.updateMany({ where: { schoolId: { in: orgIds }, subject: { equals: f.name, mode: 'insensitive' } }, data: { subject: d.name } });
        await imtihonNomlariniYangila(orgIds, { fanId: f.id, eskiFan: f.name, yangiFan: d.name });
      }
      res.json(yangi);
    } catch (err) { xato(res, next)(err); }
  });

  app.delete('/api/bank/fanlar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(parseInt(req.params.id), orgIds);
      const soni = await prisma.question.count({ where: { bankTopicId: { in: f.topics.map(t => t.id) } } });
      if (soni) return res.status(409).json({ error: `Fanda ${soni} ta savol bor — avval ularni boshqa fanga ko'chiring yoki o'chiring` });
      await prisma.questionSubject.delete({ where: { id: f.id } });
      res.json({ success: true, name: f.name });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Mavzular ---

  app.post('/api/bank/mavzular', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
      const name = nomi(req.body.name);
      if (!name) return res.status(400).json({ error: 'Mavzu nomini kiriting' });
      if (f.topics.some(t => kalit(t.name) === kalit(name))) return res.status(409).json({ error: `«${name}» mavzusi bu fanda bor` });
      const t = await prisma.questionTopic.create({
        data: { subjectId: f.id, name, section: nomi(req.body.section) || null, order: f.topics.reduce((a, x) => Math.max(a, x.order), 0) + 1 },
      });
      res.status(201).json(t);
    } catch (err) { xato(res, next)(err); }
  });

  // O'quv rejadagi mavzular (bo'limi bilan) fanga qo'shiladi; borlari tashlab ketiladi.
  app.post('/api/bank/mavzular/oquv-reja', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
      const reja = await prisma.syllabus.findUnique({ where: { id: ANY_ID(req.body.syllabusId) || 0 }, include: { topics: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } } });
      if (!reja || !orgIds.includes(reja.schoolId)) return res.status(404).json({ error: "O'quv reja topilmadi" });
      const bor = new Set(f.topics.map(t => kalit(t.name)));
      let tartib = f.topics.reduce((a, x) => Math.max(a, x.order), 0);
      const yangi = [];
      for (const t of reja.topics) {
        const name = nomi(t.title);
        if (!name || bor.has(kalit(name))) continue;
        bor.add(kalit(name));
        yangi.push({ subjectId: f.id, name, section: nomi(t.moduleName) || null, order: ++tartib });
      }
      if (yangi.length) await prisma.questionTopic.createMany({ data: yangi });
      res.status(201).json({ qoshildi: yangi.length, bor: reja.topics.length - yangi.length, reja: reja.name });
    } catch (err) { xato(res, next)(err); }
  });

  app.post('/api/bank/mavzular/tartib', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(ANY_ID).filter(Boolean).slice(0, 500);
      const mavzular = await prisma.questionTopic.findMany({ where: { id: { in: ids } }, include: { subject: { select: { schoolId: true } } } });
      const ruxsat = new Set(mavzular.filter(t => orgIds.includes(t.subject.schoolId)).map(t => t.id));
      await prisma.$transaction(ids.filter(id => ruxsat.has(id)).map((id, i) => prisma.questionTopic.update({ where: { id }, data: { order: i + 1 } })));
      res.json({ success: true });
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/mavzular/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const t = await mavzuniOl(parseInt(req.params.id), orgIds);
      const d = {};
      let fan = t.subject;
      if (req.body.subjectId !== undefined && ANY_ID(req.body.subjectId) !== t.subjectId) {
        fan = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
        d.subjectId = fan.id;
      }
      if (req.body.name !== undefined) {
        d.name = nomi(req.body.name);
        if (!d.name) return res.status(400).json({ error: 'Mavzu nomini kiriting' });
      }
      const yangiNom = d.name ?? t.name;
      const qardosh = await prisma.questionTopic.findMany({ where: { subjectId: fan.id, id: { not: t.id } }, select: { name: true } });
      if (qardosh.some(x => kalit(x.name) === kalit(yangiNom))) return res.status(409).json({ error: `«${yangiNom}» mavzusi bu fanda bor` });
      if (req.body.section !== undefined) d.section = nomi(req.body.section) || null;
      if (req.body.order !== undefined) d.order = parseInt(req.body.order) || 0;
      const yangi = await prisma.questionTopic.update({ where: { id: t.id }, data: d });
      if (yangiNom !== t.name || fan.id !== t.subjectId) {
        await prisma.question.updateMany({ where: { bankTopicId: t.id }, data: { topic: yangiNom, subject: fan.name } });
        await imtihonNomlariniYangila(orgIds, { mavzuId: t.id, yangiMavzu: yangiNom });
      }
      res.json(yangi);
    } catch (err) { xato(res, next)(err); }
  });

  // Mavzuni o'chirish: savollari bo'lsa — ?kochir=<mavzu id> ga ko'chiriladi.
  app.delete('/api/bank/mavzular/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const t = await mavzuniOl(parseInt(req.params.id), orgIds);
      const soni = await prisma.question.count({ where: { bankTopicId: t.id } });
      if (soni) {
        const kochir = ANY_ID(req.query.kochir);
        if (!kochir) return res.status(409).json({ error: `Mavzuda ${soni} ta savol bor — qaysi mavzuga ko'chirishni tanlang`, soni });
        const nishon = await mavzuniOl(kochir, orgIds);
        if (nishon.id === t.id) return res.status(400).json({ error: "Boshqa mavzuni tanlang" });
        await prisma.question.updateMany({ where: { bankTopicId: t.id }, data: { bankTopicId: nishon.id, topic: nishon.name, subject: nishon.subject.name } });
      }
      await prisma.questionTopic.delete({ where: { id: t.id } });
      res.json({ success: true, name: t.name, kochirildi: soni });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Savollarni ommaviy o'zgartirish ---

  // Tanlangan savollar: qiyinlik, holat, mavzu, manba, belgilar (qo'shish, olib
  // tashlash yoki guruh bo'yicha almashtirish) va "ishlatilishini nolga" (Addmen RESET USE).
  app.put('/api/questions/bulk', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const ids = idlarRoyxati(req.body.ids);
      if (!ids.length) return res.status(400).json({ error: 'Savollar tanlanmagan' });
      const d = {};
      if (req.body.difficulty !== undefined) d.difficulty = qiyinlikDarajasi(req.body.difficulty);
      if (req.body.status !== undefined) {
        if (!SAVOL_HOLATLARI.includes(req.body.status)) return res.status(400).json({ error: "Holat noto'g'ri" });
        d.status = req.body.status;
      }
      if (req.body.bankTopicId !== undefined) {
        const t = await mavzuniOl(ANY_ID(req.body.bankTopicId), orgIds);
        Object.assign(d, { bankTopicId: t.id, topic: t.name, subject: t.subject.name });
      }
      if (req.body.source !== undefined) d.source = nomi(req.body.source) || null;
      if (req.body.remark !== undefined) d.remark = nomi(req.body.remark) || null;
      if (req.body.joylashuv !== undefined) d.joylashuv = [1, 2, 4].includes(Number(req.body.joylashuv)) ? Number(req.body.joylashuv) : null;
      if (req.body.ishlatilishNol === true) d.usedCount = 0;
      const qosh = idlarRoyxati(req.body.tagQosh, 50);
      const ol = idlarRoyxati(req.body.tagOl, 500);
      // Guruh bo'yicha almashtirish: guruhning boshqa belgilari olinadi, berilganlari qo'yiladi.
      for (const g of Array.isArray(req.body.guruhlar) ? req.body.guruhlar.slice(0, 20) : []) {
        const guruh = await guruhniOl(ANY_ID(g?.groupId), orgIds);
        const ruxsat = new Set(guruh.tags.map(t => t.id));
        ol.push(...guruh.tags.map(t => t.id));
        qosh.push(...idlarRoyxati(g?.tagIds, 50).filter(id => ruxsat.has(id)));
      }
      const tagOl = ol.filter(id => !qosh.includes(id));
      if (!Object.keys(d).length && !qosh.length && !tagOl.length) return res.status(400).json({ error: "O'zgarish yo'q" });
      // Faol qilinadiganlar orasida chalasi bo'lsa — ular faol qilinmaydi.
      let chala = 0;
      let yangilanadi = ids;
      if (d.status === 'faol') {
        const royxat = await prisma.question.findMany({ where: { id: { in: ids }, schoolId: { in: orgIds } } });
        const yaroqli = royxat.filter(q => !savolXatosi(q)).map(q => q.id);
        chala = royxat.length - yaroqli.length;
        yangilanadi = yaroqli;
      }
      let soni = 0;
      if (Object.keys(d).length) {
        soni = (await prisma.question.updateMany({ where: { id: { in: yangilanadi }, schoolId: { in: orgIds } }, data: d })).count;
      }
      if (tagOl.length) {
        soni = Math.max(soni, await prisma.$executeRaw`
          UPDATE "Question" SET "tagIds" = ARRAY(SELECT x FROM unnest("tagIds") AS x WHERE NOT (x = ANY(${tagOl}::int[])))
          WHERE id = ANY(${ids}::int[]) AND "schoolId" = ANY(${orgIds}::int[]) AND "tagIds" && ${tagOl}::int[]`);
      }
      if (qosh.length) {
        soni = Math.max(soni, await prisma.$executeRaw`
          UPDATE "Question" SET "tagIds" = ARRAY(SELECT DISTINCT x FROM unnest("tagIds" || ${qosh}::int[]) AS x ORDER BY x)
          WHERE id = ANY(${ids}::int[]) AND "schoolId" = ANY(${orgIds}::int[])`);
      }
      res.json({ yangilandi: soni, chala });
    } catch (err) { xato(res, next)(err); }
  });

  // Tanlangan savollarni o'chirish. Imtihonda ishlatilganlari o'chirilmaydi —
  // arxivga o'tadi (variantlar ularga murojaat qiladi).
  app.post('/api/questions/bulk-ochir', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const ids = idlarRoyxati(req.body.ids);
      if (!ids.length) return res.status(400).json({ error: 'Savollar tanlanmagan' });
      const royxat = await prisma.question.findMany({ where: { id: { in: ids }, schoolId: { in: orgIds } }, select: { id: true, usedCount: true, lastUsedAt: true } });
      const ishlatilgan = royxat.filter(q => q.usedCount > 0 || q.lastUsedAt).map(q => q.id);
      const ochadi = royxat.filter(q => !ishlatilgan.includes(q.id)).map(q => q.id);
      const [o, a] = await Promise.all([
        ochadi.length ? prisma.question.deleteMany({ where: { id: { in: ochadi } } }) : { count: 0 },
        ishlatilgan.length ? prisma.question.updateMany({ where: { id: { in: ishlatilgan } }, data: { status: 'arxiv' } }) : { count: 0 },
      ]);
      res.json({ ochirildi: o.count, arxivlandi: a.count });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Belgilar (Addmen filtrlari) ---

  app.get('/api/bank/belgilar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      res.json(await belgiGuruhlari(orgIds));
    } catch (err) { xato(res, next)(err); }
  });

  app.post('/api/bank/belgi-guruhlari', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const name = nomi(req.body.name, 120);
      if (!name) return res.status(400).json({ error: 'Filtr nomini kiriting' });
      const bor = await prisma.questionTagGroup.findMany({ where: { schoolId: { in: orgIds } }, select: { name: true, order: true } });
      if (bor.some(g => kalit(g.name) === kalit(name))) return res.status(409).json({ error: `«${name}» filtri bor` });
      const g = await prisma.questionTagGroup.create({ data: { name, order: bor.reduce((a, x) => Math.max(a, x.order), 0) + 1, schoolId: req.user.schoolId || orgIds[0] } });
      res.status(201).json(g);
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/belgi-guruhlari/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const g = await guruhniOl(parseInt(req.params.id), orgIds);
      const d = {};
      if (req.body.name !== undefined) {
        d.name = nomi(req.body.name, 120);
        if (!d.name) return res.status(400).json({ error: 'Filtr nomini kiriting' });
        const boshqa = await prisma.questionTagGroup.findMany({ where: { schoolId: { in: orgIds }, id: { not: g.id } }, select: { name: true } });
        if (boshqa.some(x => kalit(x.name) === kalit(d.name))) return res.status(409).json({ error: `«${d.name}» filtri bor` });
      }
      if (req.body.order !== undefined) d.order = parseInt(req.body.order) || 0;
      res.json(await prisma.questionTagGroup.update({ where: { id: g.id }, data: d }));
    } catch (err) { xato(res, next)(err); }
  });

  app.delete('/api/bank/belgi-guruhlari/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const g = await guruhniOl(parseInt(req.params.id), orgIds);
      await belgilarniSavollardanOl(g.tags.map(t => t.id), orgIds);
      await prisma.questionTagGroup.delete({ where: { id: g.id } });
      res.json({ success: true, name: g.name });
    } catch (err) { xato(res, next)(err); }
  });

  app.post('/api/bank/belgilar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const g = await guruhniOl(ANY_ID(req.body.groupId), orgIds);
      const name = nomi(req.body.name, 120);
      if (!name) return res.status(400).json({ error: 'Qiymat nomini kiriting' });
      if (g.tags.some(t => kalit(t.name) === kalit(name))) return res.status(409).json({ error: `«${name}» bu filtrda bor` });
      const t = await prisma.questionTag.create({ data: { groupId: g.id, name, order: g.tags.reduce((a, x) => Math.max(a, x.order), 0) + 1 } });
      res.status(201).json(t);
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/belgilar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const t = await belginiOl(parseInt(req.params.id), orgIds);
      const d = {};
      if (req.body.name !== undefined) {
        d.name = nomi(req.body.name, 120);
        if (!d.name) return res.status(400).json({ error: 'Qiymat nomini kiriting' });
        const qardosh = await prisma.questionTag.findMany({ where: { groupId: t.groupId, id: { not: t.id } }, select: { name: true } });
        if (qardosh.some(x => kalit(x.name) === kalit(d.name))) return res.status(409).json({ error: `«${d.name}» bu filtrda bor` });
      }
      if (req.body.order !== undefined) d.order = parseInt(req.body.order) || 0;
      res.json(await prisma.questionTag.update({ where: { id: t.id }, data: d }));
    } catch (err) { xato(res, next)(err); }
  });

  app.delete('/api/bank/belgilar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const t = await belginiOl(parseInt(req.params.id), orgIds);
      await belgilarniSavollardanOl([t.id], orgIds);
      await prisma.questionTag.delete({ where: { id: t.id } });
      res.json({ success: true, name: t.name });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Filtrli ro'yxat (Addmen "Question bank" ekrani) ---

  // Fan bo'yicha filtr ustunlari va har qiymatda nechta savol (arxivsiz).
  app.get('/api/bank/filtr', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const fan = await fanniOl(ANY_ID(req.query.fanId), orgIds);
      const mavzular = [...fan.topics].sort((a, b) => a.order - b.order || a.id - b.id);
      const savollar = await prisma.question.findMany({
        where: { schoolId: { in: orgIds }, bankTopicId: { in: mavzular.map(t => t.id) } },
        select: { bankTopicId: true, difficulty: true, source: true, tagIds: true, toplam: true, status: true, type: true, remark: true, passageId: true, joylashuv: true },
      });
      const mavzuSoni = new Map(), bolimSoni = new Map(), manba = new Map(), toplam = new Map(), izoh = new Map(), belgi = {};
      const matnli = { bor: 0, yoq: 0 };
      const joylashuv = { 0: 0, 1: 0, 2: 0, 4: 0 };
      const qiyinlik = [0, 0, 0];
      const holat = { faol: 0, qoralama: 0, arxiv: 0 };
      const turlar = { yopiq: 0, raqamli: 0, yozma: 0 };
      const bolimi = new Map(mavzular.map(t => [t.id, t.section || '']));
      const oshir = (m, k) => m.set(k, (m.get(k) || 0) + 1);
      for (const q of savollar) {
        holat[q.status] = (holat[q.status] || 0) + 1;
        if (q.status === 'arxiv') continue;
        oshir(mavzuSoni, q.bankTopicId);
        oshir(bolimSoni, bolimi.get(q.bankTopicId) || '');
        oshir(manba, q.source || '');
        oshir(toplam, q.toplam || '');
        oshir(izoh, q.remark || '');
        matnli[q.passageId ? 'bor' : 'yoq']++;
        joylashuv[[1, 2, 4].includes(q.joylashuv) ? q.joylashuv : 0]++;
        qiyinlik[qiyinlikDarajasi(q.difficulty) - 1]++;
        turlar[turi(q.type)]++;
        for (const t of q.tagIds || []) belgi[t] = (belgi[t] || 0) + 1;
      }
      const bolimlar = [...new Set(mavzular.map(t => t.section || ''))].map(nom => ({ nom, soni: bolimSoni.get(nom) || 0 }));
      const qatorlar = m => [...m.entries()].map(([nom, soni]) => ({ nom, soni })).sort((a, b) => (a.nom ? 0 : 1) - (b.nom ? 0 : 1) || a.nom.localeCompare(b.nom));
      res.json({
        fan: { id: fan.id, name: fan.name },
        jami: savollar.length - holat.arxiv, yashirin: holat.arxiv, holat, turlar, qiyinlik,
        bolimlar,
        mavzular: mavzular.map(t => ({ id: t.id, nom: t.name, bolim: t.section || '', soni: mavzuSoni.get(t.id) || 0 })),
        manbalar: qatorlar(manba), toplamlar: qatorlar(toplam), izohlar: qatorlar(izoh), matnli, joylashuv, belgilar: belgi,
        guruhlar: await belgiGuruhlari(orgIds),
      });
    } catch (err) { xato(res, next)(err); }
  });

  // Filtr bo'yicha savollar (sahifalab) yoki faqat id lar (?idlar=1 — "hammasini tanlash").
  app.get('/api/bank/royxat', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      let f = {};
      try { f = JSON.parse(String(req.query.f || '{}')) || {}; } catch { return res.status(400).json({ error: "Filtr noto'g'ri" }); }
      const where = await royxatSharti(f, orgIds);
      const tartib = { id: req.query.tartib === 'desc' ? 'desc' : 'asc' };
      if (req.query.idlar === '1') {
        const rows = await prisma.question.findMany({ where, select: { id: true }, orderBy: tartib, take: IDLAR_MAX });
        return res.json({ ids: rows.map(r => r.id) });
      }
      const soni = Math.min(200, Math.max(1, parseInt(req.query.soni) || 100));
      const sahifa = Math.max(1, parseInt(req.query.sahifa) || 1);
      const [items, total] = await Promise.all([
        prisma.question.findMany({
          where, orderBy: tartib, skip: (sahifa - 1) * soni, take: soni,
          select: {
            id: true, text: true, type: true, difficulty: true, status: true, toplam: true, source: true, tagIds: true,
            topic: true, bankTopicId: true, usedCount: true, createdAt: true, imageUrl: true,
            options: true, optionA: true, optionB: true, optionC: true, optionD: true, correctAnswer: true, answers: true, points: true, pCorrect: true,
            remark: true, passageId: true, joylashuv: true,
          },
        }),
        prisma.question.count({ where }),
      ]);
      // Kartochkada savol to'liq ko'rinadi: matn, variantlar va to'g'ri javob.
      res.json({
        items: items.map(({ optionA, optionB, optionC, optionD, ...q }) => ({
          ...q, text: String(q.text || '').slice(0, 2000),
          options: savolVariantlari({ options: q.options, optionA, optionB, optionC, optionD }).map(o => o.slice(0, 500)),
        })),
        total, sahifa, soni,
      });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Andozalar (Addmen "Blueprint") ---

  app.get('/api/bank/andozalar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const royxat = await prisma.questionBlueprint.findMany({ where: { schoolId: { in: orgIds } }, orderBy: { id: 'desc' } });
      res.json(royxat.map(a => ({ ...a, rows: andozaQatorlari(a.rows) })));
    } catch (err) { xato(res, next)(err); }
  });

  app.post('/api/bank/andozalar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const d = await andozaMalumoti(req.body, orgIds);
      if (!d.name) return res.status(400).json({ error: 'Andoza nomini kiriting' });
      const a = await prisma.questionBlueprint.create({ data: { ...d, schoolId: req.user.schoolId || orgIds[0] } });
      res.status(201).json(a);
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/andozalar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      const d = await andozaMalumoti(req.body, orgIds);
      if (req.body.name !== undefined && !d.name) return res.status(400).json({ error: 'Andoza nomini kiriting' });
      res.json(await prisma.questionBlueprint.update({ where: { id: a.id }, data: d }));
    } catch (err) { xato(res, next)(err); }
  });

  app.delete('/api/bank/andozalar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      await prisma.questionBlueprint.delete({ where: { id: a.id } });
      res.json({ success: true, name: a.name });
    } catch (err) { xato(res, next)(err); }
  });

  // Andoza qatorlari bankda yetadimi: har qatorga mos faol (to'liq) savollar soni.
  // Saqlanmagan andoza uchun ham (tahrirlash paytida) — shuning uchun POST, lekin bazaga yozmaydi.
  app.post('/api/bank/andozalar/hisob', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const fan = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
      const qatorlar = andozaQatorlari(req.body.rows);
      const bolimi = new Map(fan.topics.map(t => [t.id, t.section || '']));
      const savollar = await prisma.question.findMany({
        where: { schoolId: { in: orgIds }, status: 'faol', bankTopicId: { in: fan.topics.map(t => t.id) } },
        select: { id: true, text: true, imageUrl: true, type: true, options: true, optionA: true, optionB: true, optionC: true, optionD: true, correctAnswer: true, answers: true, difficulty: true, source: true, tagIds: true, bankTopicId: true },
      });
      const yaroqli = savollar.filter(q => !savolXatosi(q)).map(q => ({ ...q, section: bolimi.get(q.bankTopicId) || '', mavzuId: q.bankTopicId }));
      const band = new Set();
      const natija = qatorlar.map(r => {
        const qoida = andozaQoidasi(r);
        const mos = yaroqli.filter(q => turi(q.type) === qoida.type && andozaMos(q, qoida));
        const boshqalar = mos.filter(q => !band.has(q.id));
        boshqalar.slice(0, qoida.count).forEach(q => band.add(q.id));
        return { bor: mos.length, boshQolgan: boshqalar.length, yetadi: boshqalar.length >= qoida.count };
      });
      res.json({ qatorlar: natija });
    } catch (err) { xato(res, next)(err); }
  });

  // Qiyinlikni natijaga moslash: imtihonda ishlatilgan, qiyinligi natijaga aniq
  // mos kelmaydigan savollar — to'g'ri topganlar ulushidan (≥70% oson, 40–70% o'rta, <40% qiyin).
  app.post('/api/bank/kalibrla', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const where = { schoolId: { in: orgIds }, usedCount: { gt: 0 }, pCorrect: { not: null } };
      const mid = ANY_ID(req.body.topicId);
      const fid = ANY_ID(req.body.subjectId);
      if (mid) where.bankTopicId = mid;
      else if (fid) where.bankTopic = { subjectId: fid };
      const royxat = await prisma.question.findMany({ where, select: { id: true, difficulty: true, pCorrect: true } });
      const guruh = { 1: [], 2: [], 3: [] };
      // Faqat aniq mos kelmaydiganlari (chegara atrofidagilar o'zgarmaydi).
      for (const q of royxat) {
        const d = natijaQiyinligi(q.pCorrect);
        if (d && qiyinlikMosEmas(q.difficulty, q.pCorrect)) guruh[d].push(q.id);
      }
      for (const [d, idlar] of Object.entries(guruh)) if (idlar.length) await prisma.question.updateMany({ where: { id: { in: idlar } }, data: { difficulty: Number(d) } });
      res.json({ ozgardi: guruh[1].length + guruh[2].length + guruh[3].length, tekshirildi: royxat.length });
    } catch (err) { xato(res, next)(err); }
  });
}

// --- Yordamchilar (belgilar, ro'yxat, andoza) ---

const IDLAR_MAX = 20000;
const idlarRoyxati = (v, max = IDLAR_MAX) => [...new Set((Array.isArray(v) ? v : []).map(ANY_ID).filter(Boolean))].slice(0, max);

async function belgiGuruhlari(orgIds) {
  const guruhlar = await prisma.questionTagGroup.findMany({
    where: { schoolId: { in: orgIds } }, include: { tags: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } }, orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  return guruhlar.map(g => ({ id: g.id, name: g.name, order: g.order, tags: g.tags.map(t => ({ id: t.id, name: t.name, order: t.order })) }));
}

async function guruhniOl(id, orgIds) {
  if (!ANY_ID(id)) throw new XatoJavob(400, 'Filtr tanlanmagan');
  const g = await prisma.questionTagGroup.findUnique({ where: { id }, include: { tags: true } });
  if (!g || !orgIds.includes(g.schoolId)) throw new XatoJavob(404, 'Filtr topilmadi');
  return g;
}

async function belginiOl(id, orgIds) {
  if (!ANY_ID(id)) throw new XatoJavob(400, 'Qiymat tanlanmagan');
  const t = await prisma.questionTag.findUnique({ where: { id }, include: { group: true } });
  if (!t || !orgIds.includes(t.group.schoolId)) throw new XatoJavob(404, 'Qiymat topilmadi');
  return t;
}

/** O'chirilayotgan belgilar savollardan ham olinadi (id qayta ishlatilmaydi, lekin toza tursin). */
async function belgilarniSavollardanOl(ids, orgIds) {
  if (!ids.length) return;
  await prisma.$executeRaw`
    UPDATE "Question" SET "tagIds" = ARRAY(SELECT x FROM unnest("tagIds") AS x WHERE NOT (x = ANY(${ids}::int[])))
    WHERE "schoolId" = ANY(${orgIds}::int[]) AND "tagIds" && ${ids}::int[]`;
}

const matnlar = v => [...new Set((Array.isArray(v) ? v : []).map(x => nomi(x)))].slice(0, 500);

/**
 * Ro'yxat sharti. Bir ustun ichida tanlanganlar — "yoki", ustunlar orasida — "va"
 * (Addmen'dagidek). '' — qiymati yo'q (bo'limsiz, manbasiz, to'plamsiz).
 */
async function royxatSharti(f, orgIds) {
  const and = [{ schoolId: { in: orgIds } }];
  const fanId = ANY_ID(f.fanId);
  if (fanId) {
    const fan = await fanniOl(fanId, orgIds);
    let mavzular = fan.topics;
    const bolimlar = f.bolimlar !== undefined ? matnlar(f.bolimlar) : null;
    if (bolimlar && bolimlar.length) mavzular = mavzular.filter(t => bolimlar.includes(nomi(t.section)));
    const tanlangan = idlarRoyxati(f.mavzular, 2000);
    if (tanlangan.length) mavzular = mavzular.filter(t => tanlangan.includes(t.id));
    and.push({ bankTopicId: { in: mavzular.map(t => t.id) } });
  }
  const qiyin = (Array.isArray(f.qiyinlik) ? f.qiyinlik : []).map(Number).filter(d => [1, 2, 3].includes(d));
  if (qiyin.length && qiyin.length < 3) {
    and.push({ OR: qiyin.map(d => ({ difficulty: d === 3 ? { gte: 3 } : d === 2 ? 2 : { lte: 1 } })) });
  }
  const manbalar = matnlar(f.manbalar);
  if (manbalar.length) {
    const bor = manbalar.filter(Boolean);
    and.push({ OR: [...(bor.length ? [{ source: { in: bor } }] : []), ...(manbalar.includes('') ? [{ source: null }, { source: '' }] : [])] });
  }
  if (f.toplam !== undefined && f.toplam !== null) {
    const t = nomi(f.toplam);
    and.push(t ? { toplam: t } : { OR: [{ toplam: null }, { toplam: '' }] });
  }
  for (const ids of Object.values(f.belgilar && typeof f.belgilar === 'object' ? f.belgilar : {})) {
    const l = idlarRoyxati(ids, 200);
    if (l.length) and.push({ tagIds: { hasSome: l } });
  }
  const dan = ANY_ID(f.qidDan), gacha = ANY_ID(f.qidGacha);
  if (dan || gacha) and.push({ id: { ...(dan ? { gte: dan } : {}), ...(gacha ? { lte: gacha } : {}) } });
  if (SAVOL_HOLATLARI.includes(f.holat)) and.push({ status: f.holat });
  else and.push({ status: { not: 'arxiv' } });
  if (['yopiq', 'raqamli', 'yozma'].includes(f.tur)) and.push({ type: f.tur });
  // Addmen REMARK, PASSAGE, DISPLAY CHOICES filtrlari.
  const izohlar = matnlar(f.izohlar);
  if (izohlar.length) {
    const bor = izohlar.filter(Boolean);
    and.push({ OR: [...(bor.length ? [{ remark: { in: bor } }] : []), ...(izohlar.includes('') ? [{ remark: null }, { remark: '' }] : [])] });
  }
  if (f.matnli === 'bor') and.push({ passageId: { not: null } });
  else if (f.matnli === 'yoq') and.push({ passageId: null });
  const joylar = (Array.isArray(f.joylashuv) ? f.joylashuv : []).map(Number).filter(n => [0, 1, 2, 4].includes(n));
  if (joylar.length) {
    const bor = joylar.filter(Boolean);
    and.push({ OR: [...(bor.length ? [{ joylashuv: { in: bor } }] : []), ...(joylar.includes(0) ? [{ joylashuv: null }] : [])] });
  }
  if (String(f.qidiruv || '').trim()) and.push({ text: { contains: String(f.qidiruv).trim().slice(0, 200), mode: 'insensitive' } });
  return { AND: and };
}

/** Andoza qatori: tozalangan shakl. */
function andozaQatorlari(v) {
  return (Array.isArray(v) ? v : []).slice(0, 200).map(r => ({
    bolim: r?.bolim ? nomi(r.bolim) : null,
    mavzuId: ANY_ID(r?.mavzuId),
    qiyinlik: [1, 2, 3].includes(Number(r?.qiyinlik)) ? Number(r.qiyinlik) : 0,
    manba: r?.manba ? nomi(r.manba) : null,
    tagIds: idlarRoyxati(r?.tagIds, 20),
    tur: turi(r?.tur),
    soni: Math.max(0, Math.min(300, parseInt(r?.soni) || 0)),
  }));
}

/** Andoza qatori → imtihon qoidasi (lib/imtihon.js qoidalari bilan bir xil shakl). */
function andozaQoidasi(r) {
  return {
    topic: '', ...(r.mavzuId ? { mavzuId: r.mavzuId } : {}), ...(r.bolim ? { section: r.bolim } : {}), ...(r.manba ? { source: r.manba } : {}),
    ...(r.tagIds.length ? { tagIds: r.tagIds } : {}), ...(r.qiyinlik ? { difficulty: r.qiyinlik } : {}), type: r.tur, count: r.soni,
  };
}

function andozaMos(q, r) {
  if (!filtrMos(q, r)) return false;
  if (r.mavzuId && Number(q.mavzuId) !== Number(r.mavzuId)) return false;
  if (r.difficulty && qiyinlikDarajasi(q.difficulty) !== r.difficulty) return false;
  return true;
}

async function andozaMalumoti(body, orgIds) {
  const d = {};
  if (body.name !== undefined) d.name = nomi(body.name, 120);
  if (body.subjectId !== undefined) d.subjectId = body.subjectId ? (await fanniOl(ANY_ID(body.subjectId), orgIds)).id : null;
  if (body.rows !== undefined) d.rows = andozaQatorlari(body.rows);
  return d;
}

async function andozaniOl(id, orgIds) {
  if (!ANY_ID(id)) throw new XatoJavob(400, 'Andoza tanlanmagan');
  const a = await prisma.questionBlueprint.findUnique({ where: { id } });
  if (!a || !orgIds.includes(a.schoolId)) throw new XatoJavob(404, 'Andoza topilmadi');
  return a;
}

