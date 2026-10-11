// Savollar banki tuzilmasi: fan → mavzu → qiyinlik. Daraxt (har mavzuda
// qiyinlik va tur bo'yicha sonlar), fan va mavzularni boshqarish, o'quv
// rejadan mavzular, savollarni ommaviy o'zgartirish, qiyinlikni imtihon
// natijasiga moslash. Savoldagi subject/topic — tuzilmadagi nomlarning nusxasi
// (eski imtihon qoidalari nom bo'yicha ishlaydi), nom o'zgarsa ular ham yangilanadi.

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, organizationSchoolIds } from '../middleware/auth.js';
import { turi, savolXatosi, qiyinlikDarajasi, natijaQiyinligi, qiyinlikMosEmas, mavzuMavjudligi, filtrMos, SAVOL_HOLATLARI, SAVOL_TURLARI, GURUH_TURLARI, HARFLAR, savolVariantlari } from '../lib/imtihon.js';
import { rasmliIdlarSorovi, rasmYechimSoniSorovi, yechimBor, YECHIM_BOSH } from '../lib/bankFiltr.js';
// Andozalar: qo'shilgan savollar ro'yxati (sof qoidalari — lib/andoza.js) va qoidalar bo'yicha to'ldirish.
import { guruhSavolimi, andozaSavolSoni, andozaniToldir } from '../lib/imtihon.js';
import { ANDOZA_MAX, andozaIdlari, andozaSoni, andozaFani, andozaTosiqlari, guruhlariBilan, andozagaQoshish, andozadanOlish, andozaTartibi } from '../lib/andoza.js';
import { yetadimi } from '../lib/ruxsatlar.js';

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

/** Foydalanuvchi qo'shgan qiyinlik darajalari guruhi (tashkilotda bitta); `yarat` — bo'lmasa yaratiladi. */
export async function darajaGuruhi(orgIds, yaratSchoolId = null) {
  let g = await prisma.questionTagGroup.findFirst({ where: { schoolId: { in: orgIds }, tur: 'qiyinlik' }, include: { tags: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } } });
  if (!g && yaratSchoolId) g = await prisma.questionTagGroup.create({ data: { name: 'Qiyinlik darajalari', tur: 'qiyinlik', order: 0, schoolId: yaratSchoolId }, include: { tags: true } });
  return g;
}

const ASOSIY_DARAJALAR = { 1: 'Oson', 2: "O'rta", 3: 'Qiyin' };

/**
 * Asosiy uch daraja (imtihon tuzish shular bilan ishlaydi): foydalanuvchi nomini o'zgartirishi
 * yoki keraksizini yashirishi mumkin (masalan faqat ikkita daraja qoldirish).
 */
export async function qiyinlikSozlamasi(orgIds, guruh) {
  const g = guruh === undefined ? await darajaGuruhi(orgIds) : guruh;
  const s = g?.sozlama && typeof g.sozlama === 'object' ? g.sozlama : {};
  return [1, 2, 3].map(d => ({ d, nom: nomi(s[d]?.nom, 60) || ASOSIY_DARAJALAR[d], yashirin: !!s[d]?.yashirin }));
}

/** Yashirilgan darajaga tushgan qiymat — eng yaqin ko'rinadiganiga (teng uzoqlikda — osonrog'iga). */
export function yaqinDaraja(d, sozlama) {
  const x = qiyinlikDarajasi(d);
  const ochiq = (sozlama || []).filter(q => !q.yashirin).map(q => q.d);
  if (!ochiq.length || ochiq.includes(x)) return x;
  return [...ochiq].sort((a, b) => Math.abs(a - x) - Math.abs(b - x) || a - b)[0];
}

/**
 * Savolning qiyinligi va daraja belgisi bir-biriga mos tursin: `darajaId` berilsa — shu daraja
 * (qiyinlik uning asosi), aks holda faqat asosiy qiyinlik qo'yiladi va unga mos kelmaydigan
 * daraja belgilari olinadi. Qaytadi: {tagIds, difficulty}.
 */
export async function darajaniQoy(orgIds, tagIds, difficulty, darajaId) {
  const g = await darajaGuruhi(orgIds);
  const daraja = new Map((g?.tags || []).map(t => [t.id, t]));
  let teglar = (tagIds || []).filter(id => !daraja.has(id));
  let d = qiyinlikDarajasi(difficulty);
  const t = darajaId ? daraja.get(Number(darajaId)) : null;
  if (t) { d = qiyinlikDarajasi(t.asos || 2); teglar = [...teglar, t.id]; }
  else if (darajaId === undefined) teglar = [...teglar, ...(tagIds || []).filter(id => daraja.has(id) && qiyinlikDarajasi(daraja.get(id).asos || 2) === d)];
  return { tagIds: teglar, difficulty: d };
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
      const bosh = () => ({ jami: 0, faol: 0, qoralama: 0, arxiv: 0, xatoli: 0, qiyinlik: [0, 0, 0], turlar: { yopiq: 0, raqamli: 0, moslash: 0, juft: 0, qismli: 0, yozma: 0 }, natijaYig: 0, natijaSoni: 0, moslash: 0, yaroqli: [] });
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
        const fan = { id: f.id, name: f.name, order: f.order, jami: 0, faol: 0, qoralama: 0, arxiv: 0, xatoli: 0, qiyinlik: [0, 0, 0], turlar: { yopiq: 0, raqamli: 0, moslash: 0, juft: 0, qismli: 0, yozma: 0 }, natija: null, moslash: 0, mavzular: [] };
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
      res.json({ jami, fanlar: out, qiyinlik: await qiyinlikSozlamasi(orgIds) });
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
      // Fanning o'z filtrlari ham ketadi (boshqa fan savollariga biriktirilgan bo'lsa — olinadi).
      const ozFiltrlari = await prisma.questionTagGroup.findMany({ where: { schoolId: { in: orgIds }, subjectId: f.id }, include: { tags: { select: { id: true } } } });
      await belgilarniSavollardanOl(ozFiltrlari.flatMap(g => g.tags.map(t => t.id)), orgIds);
      if (ozFiltrlari.length) await prisma.questionTagGroup.deleteMany({ where: { id: { in: ozFiltrlari.map(g => g.id) } } });
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
      await bolimniRoyxatga(f, t.section);
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
      if (d.section) await bolimniRoyxatga(await prisma.questionSubject.findUnique({ where: { id: fan.id } }), d.section);
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

  // --- Bo'limlar (fan ichidagi mavzular guruhi; nomi bilan yuritiladi) ---

  const bolimlarRoyxati = f => {
    const l = [...(f.bolimlar || [])];
    for (const t of [...f.topics].sort((a, b) => a.order - b.order || a.id - b.id)) if (t.section && !l.some(x => kalit(x) === kalit(t.section))) l.push(t.section);
    return l;
  };

  app.post('/api/bank/bolimlar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
      const name = nomi(req.body.name);
      if (!name) return res.status(400).json({ error: "Bo'lim nomini kiriting" });
      const l = bolimlarRoyxati(f);
      if (l.some(x => kalit(x) === kalit(name))) return res.status(409).json({ error: `«${name}» bo'limi bu fanda bor` });
      await prisma.questionSubject.update({ where: { id: f.id }, data: { bolimlar: [...l, name] } });
      res.status(201).json({ name, fan: f.name });
    } catch (err) { xato(res, next)(err); }
  });

  // Nomini o'zgartirish: mavzular, andozalar va qulflanmagan imtihon qoidalarida ham.
  app.put('/api/bank/bolimlar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
      const eski = nomi(req.body.eski), yangi = nomi(req.body.yangi);
      if (!yangi) return res.status(400).json({ error: "Bo'lim nomini kiriting" });
      const l = bolimlarRoyxati(f);
      if (!l.some(x => kalit(x) === kalit(eski))) return res.status(404).json({ error: "Bo'lim topilmadi" });
      if (kalit(eski) !== kalit(yangi) && l.some(x => kalit(x) === kalit(yangi))) return res.status(409).json({ error: `«${yangi}» bo'limi bu fanda bor` });
      const mavzular = f.topics.filter(t => kalit(t.section) === kalit(eski)).map(t => t.id);
      await prisma.questionSubject.update({ where: { id: f.id }, data: { bolimlar: l.map(x => (kalit(x) === kalit(eski) ? yangi : x)) } });
      if (mavzular.length) await prisma.questionTopic.updateMany({ where: { id: { in: mavzular } }, data: { section: yangi } });
      await bolimNominiTarqat(orgIds, f, eski, yangi);
      res.json({ name: yangi, eski, fan: f.name, mavzular: mavzular.length });
    } catch (err) { xato(res, next)(err); }
  });

  // O'chirish: mavzulari "bo'limsiz" bo'lib qoladi (mavzu va savollar o'chmaydi).
  app.delete('/api/bank/bolimlar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(ANY_ID(req.body?.subjectId ?? req.query.subjectId), orgIds);
      const name = nomi(req.body?.name ?? req.query.name);
      const l = bolimlarRoyxati(f);
      if (!l.some(x => kalit(x) === kalit(name))) return res.status(404).json({ error: "Bo'lim topilmadi" });
      const mavzular = f.topics.filter(t => kalit(t.section) === kalit(name)).map(t => t.id);
      await prisma.questionSubject.update({ where: { id: f.id }, data: { bolimlar: l.filter(x => kalit(x) !== kalit(name)) } });
      if (mavzular.length) await prisma.questionTopic.updateMany({ where: { id: { in: mavzular } }, data: { section: null } });
      res.json({ success: true, name, fan: f.name, mavzular: mavzular.length });
    } catch (err) { xato(res, next)(err); }
  });

  // Bo'limlar tartibi (names — yangi tartibda).
  app.post('/api/bank/bolimlar/tartib', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const f = await fanniOl(ANY_ID(req.body.subjectId), orgIds);
      const l = bolimlarRoyxati(f);
      const yangi = (Array.isArray(req.body.names) ? req.body.names : []).map(x => l.find(y => kalit(y) === kalit(x))).filter(Boolean);
      await prisma.questionSubject.update({ where: { id: f.id }, data: { bolimlar: [...new Set([...yangi, ...l])] } });
      res.json({ success: true });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Qiyinlik darajalari (foydalanuvchi qo'shadi: "Juda oson", "Biroz qiyin"...) ---

  app.post('/api/bank/darajalar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const name = nomi(req.body.name, 60);
      const asos = [1, 2, 3].includes(Number(req.body.asos)) ? Number(req.body.asos) : 2;
      if (!name) return res.status(400).json({ error: 'Daraja nomini kiriting' });
      const g = await darajaGuruhi(orgIds, req.user.schoolId || orgIds[0]);
      const asosiy = await qiyinlikSozlamasi(orgIds, g);
      if (asosiy.some(q => !q.yashirin && kalit(q.nom) === kalit(name)) || g.tags.some(t => kalit(t.name) === kalit(name))) return res.status(409).json({ error: `«${name}» darajasi bor` });
      const t = await prisma.questionTag.create({ data: { groupId: g.id, name, asos, order: g.tags.reduce((a, x) => Math.max(a, x.order), 0) + 1 } });
      res.status(201).json(t);
    } catch (err) { xato(res, next)(err); }
  });

  // Asosiy daraja (1 — oson, 2 — o'rta, 3 — qiyin o'rni): nomini o'zgartirish yoki yashirish /
  // qaytarish. Savoli bor daraja yashirilmaydi; kamida bittasi qoladi.
  app.put('/api/bank/darajalar/asosiy/:d', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const d = Number(req.params.d);
      if (![1, 2, 3].includes(d)) return res.status(400).json({ error: "Daraja noto'g'ri" });
      const g = await darajaGuruhi(orgIds, req.user.schoolId || orgIds[0]);
      const joriy = await qiyinlikSozlamasi(orgIds, g);
      const s = { ...(g.sozlama && typeof g.sozlama === 'object' ? g.sozlama : {}) };
      const yangi = { ...(s[d] || {}) };
      const eskiNom = joriy[d - 1].nom;
      let kochirildi = 0;
      if (req.body.name !== undefined) {
        const name = nomi(req.body.name, 60);
        if (!name) return res.status(400).json({ error: 'Daraja nomini kiriting' });
        if (joriy.some(q => q.d !== d && !q.yashirin && kalit(q.nom) === kalit(name)) || g.tags.some(t => kalit(t.name) === kalit(name))) return res.status(409).json({ error: `«${name}» darajasi bor` });
        yangi.nom = name;
      }
      if (req.body.yashirin !== undefined) {
        const y = !!req.body.yashirin;
        if (y) {
          if (!joriy.some(q => q.d !== d && !q.yashirin)) return res.status(409).json({ error: 'Kamida bitta daraja qolishi kerak' });
          // Shu darajaning o'zidagi savollar (foydalanuvchi darajasi qo'yilganlari — o'sha darajada qoladi).
          const ozDarajali = g.tags.map(t => t.id);
          const shart = { schoolId: { in: orgIds }, difficulty: d === 3 ? { gte: 3 } : d === 2 ? 2 : { lte: 1 }, ...(ozDarajali.length ? { NOT: { tagIds: { hasSome: ozDarajali } } } : {}) };
          const soni = await prisma.question.count({ where: shart });
          if (soni && req.body.kochir !== true) return res.status(409).json({ error: `«${eskiNom}» darajasida ${soni} ta savol bor — avval ularni boshqa darajaga o'tkazing` });
          if (soni) {
            const nishon = yaqinDaraja(d, joriy.map(q => (q.d === d ? { ...q, yashirin: true } : q)));
            kochirildi = (await prisma.question.updateMany({ where: shart, data: { difficulty: nishon } })).count;
          }
        }
        yangi.yashirin = y;
      }
      s[d] = yangi;
      const g2 = await prisma.questionTagGroup.update({ where: { id: g.id }, data: { sozlama: s } });
      const qiyinlik = await qiyinlikSozlamasi(orgIds, g2);
      res.json({ d, name: qiyinlik[d - 1].nom, eski: eskiNom, yashirin: qiyinlik[d - 1].yashirin, qiyinlik, kochirildi });
    } catch (err) { xato(res, next)(err); }
  });

  // Tanlangan savollar qayerga biriktirilgani: har mavzu, daraja va filtr qiymatida nechtasi.
  app.post('/api/bank/tanlov-holati', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const ids = idlarRoyxati(req.body.ids);
      const rows = ids.length ? await prisma.question.findMany({ where: { id: { in: ids }, schoolId: { in: orgIds } }, select: { bankTopicId: true, difficulty: true, tagIds: true } }) : [];
      const mavzular = {}, belgilar = {};
      const qiyinlik = [0, 0, 0];
      for (const q of rows) {
        if (q.bankTopicId) mavzular[q.bankTopicId] = (mavzular[q.bankTopicId] || 0) + 1;
        qiyinlik[qiyinlikDarajasi(q.difficulty) - 1]++;
        for (const t of q.tagIds || []) belgilar[t] = (belgilar[t] || 0) + 1;
      }
      res.json({ jami: rows.length, mavzular, belgilar, qiyinlik });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Guruhli savollar (Milliy sertifikat): umumiy shart + kichik savollar ---
  // 'moslash' — savollar bitta umumiy javoblar ro'yxatidan (A–F) javob oladi; 'qismli' — a), b)
  // qismlari, har birining o'z javobi (son bo'lsa `son: true` — keyin skaner tekshira oladi).

  const matnQisqa = (v, max = 20000) => String(v ?? '').slice(0, max);
  /** So'rovdagi guruhni tekshirib, saqlashga tayyor shaklga keltiradi (xato bo'lsa — XatoJavob). */
  const guruhMalumoti = (body) => {
    const tur = Object.keys(GURUH_TURLARI).includes(body?.tur) ? body.tur : null;
    if (!tur) throw new XatoJavob(400, "Guruh turi noto'g'ri");
    // Qoralama (AI importi): javoblar hali bo'lmasligi mumkin — bankda guruh oynasida to'ldiriladi.
    const qoralama = body?.status === 'qoralama';
    const text = matnQisqa(body.text);
    if (!text.trim()) throw new XatoJavob(400, 'Umumiy shartni yozing');
    if (Array.isArray(body.savollar) && body.savollar.length > 10) throw new XatoJavob(400, "Bitta guruhda ko'pi bilan 10 ta savol");
    const savollar = (Array.isArray(body.savollar) ? body.savollar : []).map(s => ({
      id: ANY_ID(s?.id), text: matnQisqa(s?.text), javob: nomi(s?.javob, 40), son: s?.son === true,
    }));
    // "Skaner (son)" faqat javob haqiqatan son bo'lsa (butun, o'nli yoki oddiy kasr).
    if (tur === 'qismli' && savollar.some(s => s.son && !/^-?\d+([.,]\d+)?(\/\d+)?$/.test(s.javob))) {
      throw new XatoJavob(400, "Skaner tekshiradigan qismning javobi son bo'lishi kerak (masalan 6 yoki 9,1) — son bo'lmasa «Ustoz tekshiradi» ni tanlang");
    }
    if (savollar.length < (tur === 'moslash' ? 2 : 1)) throw new XatoJavob(400, tur === 'moslash' ? 'Kamida 2 ta savol kerak' : 'Kamida bitta qism kerak');
    // Imtihon varag'ida qismlar a–d bilan belgilanadi.
    if (tur === 'qismli' && savollar.length > 4) throw new XatoJavob(400, "MS-36-45 savolida ko'pi bilan 4 ta qism (a–d)");
    if (savollar.some(s => !s.text.trim())) throw new XatoJavob(400, "Bo'sh savol bor");
    let variantlar = null;
    if (tur === 'moslash') {
      variantlar = (Array.isArray(body.variantlar) ? body.variantlar : []).slice(0, HARFLAR.length).map(v => matnQisqa(v, 4000));
      if (variantlar.length < 2 || variantlar.some(v => !v.trim())) throw new XatoJavob(400, "Javoblar ro'yxatida kamida 2 ta, bo'sh bo'lmagan javob kerak");
      for (const s of savollar) {
        const k = HARFLAR.indexOf(s.javob.toUpperCase());
        if (qoralama && !s.javob) continue;
        if (k < 0 || k >= variantlar.length) throw new XatoJavob(400, "Har savolning to'g'ri javobi (harfi) belgilanishi kerak");
        s.javob = HARFLAR[k];
      }
    } else if (!qoralama && savollar.some(s => !s.javob)) throw new XatoJavob(400, "Har qismning to'g'ri javobi yozilishi kerak");
    return { tur, text, variantlar, savollar, status: qoralama ? 'qoralama' : 'faol' };
  };
  /** Kichik savolning bazadagi shakli. */
  const guruhSavoli = (g, s, umumiy) => ({
    ...umumiy, type: GURUH_TURLARI[g.tur], text: s.text, correctAnswer: s.javob,
    options: g.tur === 'moslash' ? g.variantlar : null,
    // Qism javobi son bo'lsa — qabul qilinadigan javob sifatida ham yoziladi (skaner tekshiruvi uchun).
    answers: g.tur === 'qismli' && s.son ? [s.javob] : null,
    lockOptions: true,
  });

  app.get('/api/bank/guruhlar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const p = await prisma.passage.findUnique({ where: { id: ANY_ID(req.params.id) || 0 }, include: { questions: { orderBy: { id: 'asc' } } } });
      if (!p || !orgIds.includes(p.schoolId) || !GURUH_TURLARI[p.tur]) return res.status(404).json({ error: 'Guruhli savol topilmadi' });
      res.json({
        id: p.id, tur: p.tur, text: p.text, variantlar: Array.isArray(p.variantlar) ? p.variantlar : [],
        mavzuId: p.questions[0]?.bankTopicId ?? null, difficulty: qiyinlikDarajasi(p.questions[0]?.difficulty || 2),
        savollar: p.questions.map(q => ({ id: q.id, text: q.text, javob: q.correctAnswer || '', son: Array.isArray(q.answers) && q.answers.length > 0, ishlatilgan: q.usedCount > 0 })),
      });
    } catch (err) { xato(res, next)(err); }
  });

  app.post('/api/bank/guruhlar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const g = guruhMalumoti(req.body);
      const mavzu = await mavzuniOl(ANY_ID(req.body.mavzuId), orgIds);
      const schoolId = req.user.schoolId || orgIds[0];
      // `darajaId` — foydalanuvchining o'z qiyinlik darajasi (bank ro'yxatidagidek: belgisi qo'yiladi, qiyinlik — uning asosi).
      const daraja = ANY_ID(req.body.darajaId) ? await darajaniQoy(orgIds, [], req.body.difficulty ?? 2, ANY_ID(req.body.darajaId)) : null;
      const difficulty = daraja?.tagIds.length ? daraja.difficulty : yaqinDaraja(req.body.difficulty ?? 2, await qiyinlikSozlamasi(orgIds));
      const natija = await prisma.$transaction(async (tx) => {
        const p = await tx.passage.create({ data: { tur: g.tur, text: g.text, variantlar: g.variantlar ?? undefined, subject: mavzu.subject.name, schoolId } });
        const umumiy = { passageId: p.id, bankTopicId: mavzu.id, subject: mavzu.subject.name, topic: mavzu.name, difficulty, ...(daraja?.tagIds.length ? { tagIds: daraja.tagIds } : {}), status: g.status, language: 'uz', source: nomi(req.body.source, 200) || null, toplam: nomi(req.body.toplam, 200) || null, schoolId, createdById: req.user.id || null };
        // Tartib saqlansin (a, b … id bo'yicha): bittalab yoziladi.
        const ids = [];
        for (const s of g.savollar) ids.push((await tx.question.create({ data: guruhSavoli(g, s, umumiy), select: { id: true } })).id);
        return { id: p.id, ids };
      });
      res.status(201).json({ ...natija, tur: g.tur, mavzu: mavzu.name, soni: natija.ids.length });
    } catch (err) { xato(res, next)(err); }
  });

  // Tahrir: shart, javoblar ro'yxati va kichik savollar. Imtihonda ishlatilgan savol o'chirilmaydi.
  app.put('/api/bank/guruhlar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const p = await prisma.passage.findUnique({ where: { id: ANY_ID(req.params.id) || 0 }, include: { questions: { orderBy: { id: 'asc' } } } });
      if (!p || !orgIds.includes(p.schoolId) || !GURUH_TURLARI[p.tur]) return res.status(404).json({ error: 'Guruhli savol topilmadi' });
      // Holat so'rovdan olinmaydi: qoralama guruh tahrirlanayotganda javoblar hali bo'lmasligi mumkin,
      // faol guruhda esa hamma javob shart.
      const g = guruhMalumoti({ ...req.body, tur: p.tur, status: p.questions.length && p.questions.every(q => q.status === 'qoralama') ? 'qoralama' : 'faol' });
      const bor = new Map(p.questions.map(q => [q.id, q]));
      if (g.savollar.some(s => s.id && !bor.has(s.id))) return res.status(400).json({ error: 'Bu guruhga tegishli bo\'lmagan savol bor' });
      const qoladi = new Set(g.savollar.map(s => s.id).filter(Boolean));
      const ochadi = p.questions.filter(q => !qoladi.has(q.id));
      if (ochadi.some(q => q.usedCount > 0 || q.lastUsedAt)) return res.status(409).json({ error: "Imtihonda ishlatilgan savolni guruhdan olib bo'lmaydi" });
      const namuna = p.questions[0];
      const umumiy = namuna
        ? { passageId: p.id, bankTopicId: namuna.bankTopicId, subject: namuna.subject, topic: namuna.topic, difficulty: namuna.difficulty, status: namuna.status, language: namuna.language || 'uz', tagIds: namuna.tagIds, schoolId: namuna.schoolId, createdById: req.user.id || null }
        : null;
      if (!umumiy && g.savollar.some(s => !s.id)) return res.status(409).json({ error: "Guruh bo'sh — yangisini yarating" });
      await prisma.$transaction(async (tx) => {
        await tx.passage.update({ where: { id: p.id }, data: { text: g.text, variantlar: g.variantlar ?? undefined } });
        if (ochadi.length) await tx.question.deleteMany({ where: { id: { in: ochadi.map(q => q.id) } } });
        for (const s of g.savollar) {
          const d = guruhSavoli(g, s, {});
          if (s.id) await tx.question.update({ where: { id: s.id }, data: { text: d.text, correctAnswer: d.correctAnswer, options: d.options ?? Prisma.DbNull, answers: d.answers ?? Prisma.DbNull } });
          else await tx.question.create({ data: guruhSavoli(g, s, umumiy) });
        }
      });
      res.json({ id: p.id, tur: p.tur, soni: g.savollar.length });
    } catch (err) { xato(res, next)(err); }
  });

  // Guruhni o'chirish: sharti va hamma savollari. Imtihonda ishlatilgan savol o'chirilmaydi —
  // arxivga o'tadi (variantlar unga murojaat qiladi), shart ham u bilan qoladi.
  app.delete('/api/bank/guruhlar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const p = await prisma.passage.findUnique({ where: { id: ANY_ID(req.params.id) || 0 }, include: { questions: { select: { id: true, usedCount: true, lastUsedAt: true } } } });
      if (!p || !orgIds.includes(p.schoolId) || !GURUH_TURLARI[p.tur]) return res.status(404).json({ error: 'Guruhli savol topilmadi' });
      const ishlatilgan = p.questions.filter(q => q.usedCount > 0 || q.lastUsedAt).map(q => q.id);
      const ochadi = p.questions.filter(q => !ishlatilgan.includes(q.id)).map(q => q.id);
      await prisma.$transaction(async (tx) => {
        if (ochadi.length) await tx.question.deleteMany({ where: { id: { in: ochadi } } });
        if (ishlatilgan.length) await tx.question.updateMany({ where: { id: { in: ishlatilgan } }, data: { status: 'arxiv' } });
        else await tx.passage.delete({ where: { id: p.id } });
      });
      res.json({ id: p.id, tur: p.tur, ochirildi: ochadi.length, arxivlandi: ishlatilgan.length });
    } catch (err) { xato(res, next)(err); }
  });

  /** Guruhli savol — bir butun: ro'yxatda bo'lagi bo'lsa, qolgan bo'laklari ham qo'shiladi. */
  const guruhiBilan = async (ids, orgIds) => {
    const azolar = await prisma.question.findMany({ where: { id: { in: ids }, schoolId: { in: orgIds }, type: { in: Object.values(GURUH_TURLARI) }, passageId: { not: null } }, select: { passageId: true } });
    if (!azolar.length) return ids;
    const hammasi = await prisma.question.findMany({ where: { passageId: { in: [...new Set(azolar.map(q => q.passageId))] } }, select: { id: true } });
    return [...new Set([...ids, ...hammasi.map(q => q.id)])];
  };

  // --- Savollarni ommaviy o'zgartirish ---

  // Tanlangan savollar: qiyinlik, holat, mavzu, manba, belgilar (qo'shish, olib
  // tashlash yoki guruh bo'yicha almashtirish) va "ishlatilishini nolga" (Addmen RESET USE).
  app.put('/api/questions/bulk', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const ids = await guruhiBilan(idlarRoyxati(req.body.ids), orgIds);
      if (!ids.length) return res.status(400).json({ error: 'Savollar tanlanmagan' });
      const d = {};
      if (req.body.difficulty !== undefined) d.difficulty = yaqinDaraja(req.body.difficulty, await qiyinlikSozlamasi(orgIds));
      // Daraja (foydalanuvchi qo'shgan): qiyinlik uning asosiga tenglashadi; asosiy qiyinlik
      // qo'yilsa — eski daraja belgilari olinadi.
      const darajaOl = [], darajaQosh = [];
      if (req.body.darajaId !== undefined || req.body.difficulty !== undefined) {
        const g = await darajaGuruhi(orgIds);
        if (g) darajaOl.push(...g.tags.map(t => t.id));
        const did = ANY_ID(req.body.darajaId);
        if (did) {
          const t = g?.tags.find(x => x.id === did);
          if (!t) return res.status(404).json({ error: 'Daraja topilmadi' });
          d.difficulty = qiyinlikDarajasi(t.asos || 2);
          darajaQosh.push(t.id);
        }
      }
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
      const qosh = [...idlarRoyxati(req.body.tagQosh, 50), ...darajaQosh];
      const ol = [...idlarRoyxati(req.body.tagOl, 500), ...darajaOl];
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
      const ids = await guruhiBilan(idlarRoyxati(req.body.ids), orgIds);
      if (!ids.length) return res.status(400).json({ error: 'Savollar tanlanmagan' });
      const royxat = await prisma.question.findMany({ where: { id: { in: ids }, schoolId: { in: orgIds } }, select: { id: true, usedCount: true, lastUsedAt: true } });
      const ishlatilgan = royxat.filter(q => q.usedCount > 0 || q.lastUsedAt).map(q => q.id);
      const ochadi = royxat.filter(q => !ishlatilgan.includes(q.id)).map(q => q.id);
      const [o, a] = await Promise.all([
        ochadi.length ? prisma.question.deleteMany({ where: { id: { in: ochadi } } }) : { count: 0 },
        ishlatilgan.length ? prisma.question.updateMany({ where: { id: { in: ishlatilgan } }, data: { status: 'arxiv' } }) : { count: 0 },
      ]);
      // Hamma savoli o'chgan guruhli savolning sharti ham ketadi.
      await prisma.passage.deleteMany({ where: { schoolId: { in: orgIds }, tur: { not: null }, questions: { none: {} } } });
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
      // subjectId — filtr shu fanniki (boshqa fanda ko'rinmaydi); bo'lmasa hamma fanda.
      const subjectId = ANY_ID(req.body.subjectId) ? (await fanniOl(ANY_ID(req.body.subjectId), orgIds)).id : null;
      const bor = await prisma.questionTagGroup.findMany({ where: { schoolId: { in: orgIds } }, select: { name: true, order: true, subjectId: true } });
      if (bor.some(g => kalit(g.name) === kalit(name) && (!subjectId || !g.subjectId || g.subjectId === subjectId))) return res.status(409).json({ error: `«${name}» filtri bor` });
      const g = await prisma.questionTagGroup.create({ data: { name, subjectId, order: bor.reduce((a, x) => Math.max(a, x.order), 0) + 1, schoolId: req.user.schoolId || orgIds[0] } });
      res.status(201).json({ ...g, tags: [] });
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/belgi-guruhlari/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const g = await guruhniOl(parseInt(req.params.id), orgIds);
      if (g.tur === 'qiyinlik') return res.status(400).json({ error: "Qiyinlik darajalari «Qiyinlik» ustunida boshqariladi" });
      const d = {};
      if (req.body.subjectId !== undefined) d.subjectId = ANY_ID(req.body.subjectId) ? (await fanniOl(ANY_ID(req.body.subjectId), orgIds)).id : null;
      if (req.body.name !== undefined) {
        d.name = nomi(req.body.name, 120);
        if (!d.name) return res.status(400).json({ error: 'Filtr nomini kiriting' });
      }
      if (d.name !== undefined || d.subjectId !== undefined) {
        const yangiNom = d.name ?? g.name, fanId = d.subjectId !== undefined ? d.subjectId : g.subjectId;
        const boshqa = await prisma.questionTagGroup.findMany({ where: { schoolId: { in: orgIds }, id: { not: g.id } }, select: { name: true, subjectId: true } });
        if (boshqa.some(x => kalit(x.name) === kalit(yangiNom) && (!fanId || !x.subjectId || x.subjectId === fanId))) return res.status(409).json({ error: `«${yangiNom}» filtri bor` });
      }
      if (req.body.order !== undefined) d.order = parseInt(req.body.order) || 0;
      res.json(await prisma.questionTagGroup.update({ where: { id: g.id }, data: d }));
    } catch (err) { xato(res, next)(err); }
  });

  app.delete('/api/bank/belgi-guruhlari/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const g = await guruhniOl(parseInt(req.params.id), orgIds);
      if (g.tur === 'qiyinlik') return res.status(400).json({ error: "Qiyinlik darajalari «Qiyinlik» ustunida boshqariladi" });
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
      // Daraja boshqa guruhga (oson / o'rta / qiyin) o'tsa — shu darajadagi savollarning qiyinligi ham.
      if (t.group.tur === 'qiyinlik' && [1, 2, 3].includes(Number(req.body.asos)) && Number(req.body.asos) !== t.asos) {
        d.asos = Number(req.body.asos);
        await prisma.question.updateMany({ where: { schoolId: { in: orgIds }, tagIds: { has: t.id } }, data: { difficulty: d.asos } });
      }
      res.json(await prisma.questionTag.update({ where: { id: t.id }, data: d }));
    } catch (err) { xato(res, next)(err); }
  });

  app.delete('/api/bank/belgilar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const t = await belginiOl(parseInt(req.params.id), orgIds);
      if (t.group.tur === 'qiyinlik') {
        const sozlama = await qiyinlikSozlamasi(orgIds);
        const asos = qiyinlikDarajasi(t.asos || 2);
        const nishon = yaqinDaraja(asos, sozlama);
        if (nishon !== asos) await prisma.question.updateMany({ where: { schoolId: { in: orgIds }, tagIds: { has: t.id } }, data: { difficulty: nishon } });
      }
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
      // Rasmli va yechimli savollar soni — alohida so'rov (matn ustunlari bu yerga tortilmaydi);
      // u ishlamasa ham ekran ochiladi (filtr tugmalari sonsiz chiqadi).
      const rasmYechimKutish = rasmYechimSoni(orgIds, mavzular.map(t => t.id)).catch(e => { console.error('[bank] rasm/yechim sonlari:', e.message); return null; });
      const savollar = await prisma.question.findMany({
        where: { schoolId: { in: orgIds }, bankTopicId: { in: mavzular.map(t => t.id) } },
        select: { bankTopicId: true, difficulty: true, source: true, tagIds: true, toplam: true, status: true, type: true, remark: true, passageId: true, joylashuv: true },
      });
      const mavzuSoni = new Map(), bolimSoni = new Map(), manba = new Map(), toplam = new Map(), izoh = new Map(), belgi = {};
      const matnli = { bor: 0, yoq: 0 };
      const joylashuv = { 0: 0, 1: 0, 2: 0, 4: 0 };
      const qiyinlik = [0, 0, 0];
      const holat = { faol: 0, qoralama: 0, arxiv: 0 };
      const turlar = { yopiq: 0, raqamli: 0, moslash: 0, juft: 0, qismli: 0, yozma: 0 };
      const bolimi = new Map(mavzular.map(t => [t.id, t.section || '']));
      const oshir = (m, k) => m.set(k, (m.get(k) || 0) + 1);
      const hammaGuruh = await belgiGuruhlari(orgIds, fan.id);
      const darajaIdlar = new Set((hammaGuruh.find(g => g.tur === 'qiyinlik')?.tags || []).map(t => t.id));
      const ozGuruhlar = hammaGuruh.filter(g => g.tur !== 'qiyinlik').map(g => ({ id: g.id, idlar: new Set(g.tags.map(t => t.id)) }));
      // Mavzu kesimi: j — jami; q — asosiy darajalar (foydalanuvchi darajasi qo'yilmaganlari);
      // b — belgi (daraja yoki filtr qiymati) bo'yicha; y — filtrning hech bir qiymati qo'yilmaganlari.
      const kesim = {};
      for (const q of savollar) {
        holat[q.status] = (holat[q.status] || 0) + 1;
        if (q.status === 'arxiv') continue;
        const k = (kesim[q.bankTopicId] ||= { j: 0, q: [0, 0, 0], b: {}, y: {} });
        const teglar = q.tagIds || [];
        k.j++;
        for (const t of teglar) k.b[t] = (k.b[t] || 0) + 1;
        if (!teglar.some(t => darajaIdlar.has(t))) k.q[qiyinlikDarajasi(q.difficulty) - 1]++;
        for (const g of ozGuruhlar) if (!teglar.some(t => g.idlar.has(t))) k.y[g.id] = (k.y[g.id] || 0) + 1;
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
      // Bo'limlar: fan ro'yxatidagi tartibda (bo'shi ham), oxirida — bo'limsiz mavzular bo'lsa — ''.
      const bolimlar = [...bolimlarRoyxati(fan), ...(mavzular.some(t => !t.section) ? [''] : [])]
        .map(nom => ({ nom, soni: bolimSoni.get(nom) || 0, mavzular: mavzular.filter(t => kalit(t.section) === kalit(nom)).length }));
      const qatorlar = m => [...m.entries()].map(([nom, soni]) => ({ nom, soni })).sort((a, b) => (a.nom ? 0 : 1) - (b.nom ? 0 : 1) || a.nom.localeCompare(b.nom));
      const ry = await rasmYechimKutish;
      res.json({
        fan: { id: fan.id, name: fan.name },
        jami: savollar.length - holat.arxiv, yashirin: holat.arxiv, holat, turlar, qiyinlik,
        bolimlar,
        mavzular: mavzular.map(t => ({ id: t.id, nom: t.name, bolim: t.section || '', soni: mavzuSoni.get(t.id) || 0 })),
        manbalar: qatorlar(manba), toplamlar: qatorlar(toplam), izohlar: qatorlar(izoh), matnli, joylashuv, belgilar: belgi, kesim,
        // Rasmli / rasmsiz va yechimi bor / yo'q savollar (arxivsiz); null — sanab bo'lmadi.
        rasmli: ry ? { bor: ry.rasmli, yoq: ry.jami - ry.rasmli } : null,
        yechimli: ry ? { bor: ry.yechimli, yoq: ry.jami - ry.yechimli } : null,
        qiyinlikSozlama: await qiyinlikSozlamasi(orgIds),
        guruhlar: hammaGuruh.filter(g => g.tur !== 'qiyinlik'),
        darajalar: (hammaGuruh.find(g => g.tur === 'qiyinlik')?.tags || []).map(t => ({ id: t.id, name: t.name, asos: qiyinlikDarajasi(t.asos || 2), soni: belgi[t.id] || 0 })),
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
            remark: true, passageId: true, joylashuv: true, solution: true, solutionStatus: true,
            // Guruhli savol kartasi uchun: umumiy shart va javoblar ro'yxati.
            passage: { select: { id: true, tur: true, text: true, variantlar: true, questions: { select: { id: true }, orderBy: { id: 'asc' } } } },
          },
        }),
        prisma.question.count({ where }),
      ]);
      // Kartochkada savol to'liq ko'rinadi: matn, variantlar va to'g'ri javob. Yechimning o'zi
      // ro'yxatda kelmaydi — faqat bor-yo'qligi (`yechimBor`); matni «Yechimni ko'rish» da olinadi.
      res.json({
        items: items.map(({ optionA, optionB, optionC, optionD, solution, ...q }) => ({
          ...q, yechimBor: yechimBor(solution), text: String(q.text || '').slice(0, 2000),
          options: savolVariantlari({ options: q.options, optionA, optionB, optionC, optionD }).map(o => o.slice(0, 500)),
        })),
        total, sahifa, soni,
      });
    } catch (err) { xato(res, next)(err); }
  });

  // --- Andozalar (Addmen "Blueprint") ---
  // Andoza — nomi, savollar soni va bankdan qo'shilgan aniq savollar (tartibi bilan): imtihonga
  // aynan shular tushadi. Qatorlar (rows) — «Qoidalar bo'yicha avtomatik to'ldirish» retsepti;
  // savoli yo'q eski andozalarda — tuzilmaning o'zi (savollar har imtihonda tasodifiy olinadi).

  app.get('/api/bank/andozalar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const royxat = await prisma.questionBlueprint.findMany({ where: { schoolId: { in: orgIds } }, orderBy: { id: 'desc' } });
      const idlar = [...new Set(royxat.flatMap(a => a.questionIds || []))];
      const savollar = idlar.length ? await prisma.question.findMany({
        where: { id: { in: idlar }, schoolId: { in: orgIds } },
        select: { id: true, type: true, passageId: true, bankTopic: { select: { subjectId: true } } },
      }) : [];
      const byId = new Map(savollar.map(q => [q.id, q]));
      res.json(royxat.map(a => andozaKorinishi(a, (a.questionIds || []).map(id => byId.get(id)).filter(Boolean))));
    } catch (err) { xato(res, next)(err); }
  });

  // Bitta andoza savollari bilan (qog'ozdagi tartibda). ?qisqa=1 — matnsiz (imtihon tuzishda yetadi).
  app.get('/api/bank/andozalar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      // Imtihon tuzuvchi (bank ruxsatisiz) savollarni ko'radi, lekin to'g'ri javobni ko'rmaydi.
      res.json(await andozaTafsili(a, orgIds, { qisqa: req.query.qisqa === '1', kalitsiz: !yetadimi(req.ruxsat, 'imtihonlar.savollar', 1) }));
    } catch (err) { xato(res, next)(err); }
  });

  // Yangi andoza: nomi va savollar soni yetarli. `nusxa` — boshqa andozaning nusxasi (savollari bilan).
  app.post('/api/bank/andozalar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const asl = req.body.nusxa ? await andozaniOl(ANY_ID(req.body.nusxa), orgIds) : null;
      const d = await andozaMalumoti(req.body, orgIds);
      if (asl) Object.assign(d, { name: d.name || nomi(`${asl.name} (nusxa)`, 120), subjectId: asl.subjectId, rows: andozaQatorlari(asl.rows), soni: asl.soni || 0, questionIds: asl.questionIds || [] });
      if (!d.name) return res.status(400).json({ error: 'Andoza nomini kiriting' });
      if (!asl && !d.soni && !(d.rows || []).some(r => r.soni > 0)) return res.status(400).json({ error: 'Savollar sonini kiriting' });
      const a = await prisma.questionBlueprint.create({ data: { rows: [], ...d, schoolId: req.user.schoolId || orgIds[0] } });
      res.status(201).json(andozaKorinishi(a, await andozaSavollari(a.questionIds, orgIds)));
    } catch (err) { xato(res, next)(err); }
  });

  app.put('/api/bank/andozalar/:id', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      const d = await andozaMalumoti(req.body, orgIds);
      if (req.body.name !== undefined && !d.name) return res.status(400).json({ error: 'Andoza nomini kiriting' });
      const savollar = await andozaSavollari(a.questionIds, orgIds);
      if (d.soni !== undefined) {
        const bor = andozaSavolSoni(savollar);
        if (!d.soni) return res.status(400).json({ error: 'Savollar sonini kiriting' });
        if (d.soni < bor) return res.status(400).json({ error: `Andozada ${bor} ta savol bor — avval ortiqchasini olib tashlang` });
      }
      res.json(andozaKorinishi(await prisma.questionBlueprint.update({ where: { id: a.id }, data: d }), savollar));
    } catch (err) { xato(res, next)(err); }
  });

  // Savollarni andozaga qo'shish. Guruhli savol butunligicha qo'shiladi; faol bo'lmagan va chala
  // savollar qo'shilmaydi. Sig'masa — 409 (`kengaytir: true` bo'lsa savollar soni o'zi oshiriladi).
  app.post('/api/bank/andozalar/:id/savollar', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      const kelgan = idlarRoyxati(req.body.ids, ANDOZA_MAX * 4);
      if (!kelgan.length) return res.status(400).json({ error: 'Savol tanlanmagan' });
      const bor = await andozaSavollari(a.questionIds, orgIds);
      const tanlangan = await andozaSavollari(kelgan, orgIds);
      const azolar = await guruhAzolari(tanlangan, orgIds);
      const nomzodlar = await andozaSavollari(guruhlariBilan(tanlangan, azolar), orgIds);
      const r = andozagaQoshish({ bor, nomzodlar, azolar, topilmadi: kelgan.length - tanlangan.length, soni: andozaJami(a, bor), kengaytir: req.body.kengaytir === true });
      if (r.xato) return res.status(r.xato.status).json(r.xato);
      const y = await prisma.questionBlueprint.update({ where: { id: a.id }, data: { questionIds: andozaIdlari(r.hammasi), soni: r.soni } });
      res.json({ ...andozaKorinishi(y, r.hammasi), qoshildi: r.qoshildi, borEdi: r.borEdi, yaroqsiz: r.yaroqsiz });
    } catch (err) { xato(res, next)(err); }
  });

  // Savollarni andozadan olib tashlash (bankdagi savolga tegilmaydi). Guruhli savol butun olinadi.
  app.post('/api/bank/andozalar/:id/savollar/olib', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      const bor = await andozaSavollari(a.questionIds, orgIds);
      const { qoldi, olindi } = andozadanOlish(bor, idlarRoyxati(req.body.ids, ANDOZA_MAX * 4));
      if (qoldi.length === bor.length) return res.status(400).json({ error: "Bu savollar andozada yo'q" });
      const y = await prisma.questionBlueprint.update({ where: { id: a.id }, data: { questionIds: andozaIdlari(qoldi), soni: andozaJami(a, bor) } });
      res.json({ ...andozaKorinishi(y, qoldi), olindi });
    } catch (err) { xato(res, next)(err); }
  });

  // Savollar tartibi (jurnalga yozilmaydi): `questionIds` — andozadagi hamma savol, yangi tartibda.
  app.post('/api/bank/andozalar/:id/tartib', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      const tartibda = andozaTartibi(await andozaSavollari(a.questionIds, orgIds), idlarRoyxati(req.body.questionIds, ANDOZA_MAX * 4));
      if (!tartibda) return res.status(409).json({ error: "Andoza boshqa joyda o'zgargan — sahifani yangilang" });
      const y = await prisma.questionBlueprint.update({ where: { id: a.id }, data: { questionIds: andozaIdlari(tartibda) } });
      res.json(andozaKorinishi(y, tartibda));
    } catch (err) { xato(res, next)(err); }
  });

  // «Qoidalar bo'yicha avtomatik to'ldirish»: andozaning bo'sh o'rinlariga qoidalarga (qatorlarga)
  // mos savollar bankdan tanlanadi. Qatorlar andozada saqlanadi — keyin yana bosish mumkin.
  app.post('/api/bank/andozalar/:id/toldir', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const a = await andozaniOl(parseInt(req.params.id), orgIds);
      const rows = req.body.rows !== undefined ? andozaQatorlari(req.body.rows) : andozaQatorlari(a.rows);
      const fan = await fanniOl(ANY_ID(req.body.subjectId) || a.subjectId, orgIds);
      if (!rows.some(r => r.soni > 0)) return res.status(400).json({ error: 'Kamida bitta qoida yozing (nechta savol)' });
      const bor = await andozaSavollari(a.questionIds, orgIds);
      // Eski andozada qoidalar yig'indisi chegaradan katta bo'lishi mumkin — blok shunchasini olmaydi.
      const soni = Math.min(ANDOZA_MAX, andozaJami({ ...a, rows }, bor));
      const joriy = andozaSavolSoni(bor);
      if (joriy >= soni) return res.status(400).json({ error: "Andozada bo'sh o'rin yo'q — avval savollar sonini oshiring" });
      const [bank, hajm] = await Promise.all([fanBanki(fan, orgIds), guruhHajmi(orgIds)]);
      const t = andozaniToldir({
        qoidalar: rows.map(andozaQoidasi), blok: { subject: fan.name, fanId: fan.id }, bank, guruhHajmi: hajm,
        bor: bor.map(q => q.id), sigim: soni - joriy, seed: Date.now() % 2147483647,
      });
      const hammasi = [...bor, ...(await andozaSavollari(t.idlar, orgIds))];
      const y = await prisma.questionBlueprint.update({ where: { id: a.id }, data: { rows, subjectId: fan.id, questionIds: andozaIdlari(hammasi), soni } });
      res.json({ ...andozaKorinishi(y, hammasi), qoshildi: andozaSavolSoni(hammasi) - joriy, qatorlar: t.qatorlar });
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
      const asosiy = await qiyinlikSozlamasi(orgIds);
      // Faqat aniq mos kelmaydiganlari (chegara atrofidagilar o'zgarmaydi). Yashirilgan daraja
      // o'rniga — eng yaqin ko'rinadigani.
      for (const q of royxat) {
        const d = natijaQiyinligi(q.pCorrect);
        if (!d || !qiyinlikMosEmas(q.difficulty, q.pCorrect)) continue;
        const d2 = yaqinDaraja(d, asosiy);
        if (d2 !== qiyinlikDarajasi(q.difficulty)) guruh[d2].push(q.id);
      }
      const darajalar = (await darajaGuruhi(orgIds))?.tags || [];
      for (const [d, idlar] of Object.entries(guruh)) {
        if (!idlar.length) continue;
        await prisma.question.updateMany({ where: { id: { in: idlar } }, data: { difficulty: Number(d) } });
        // Qiyinligi o'zgargan savolda boshqa guruhdagi daraja belgisi qolmasin.
        const mosEmas = darajalar.filter(t => qiyinlikDarajasi(t.asos || 2) !== Number(d)).map(t => t.id);
        if (mosEmas.length) await prisma.$executeRaw`
          UPDATE "Question" SET "tagIds" = ARRAY(SELECT x FROM unnest("tagIds") AS x WHERE NOT (x = ANY(${mosEmas}::int[])))
          WHERE id = ANY(${idlar}::int[]) AND "tagIds" && ${mosEmas}::int[]`;
      }
      res.json({ ozgardi: guruh[1].length + guruh[2].length + guruh[3].length, tekshirildi: royxat.length });
    } catch (err) { xato(res, next)(err); }
  });
}

// --- Yordamchilar (belgilar, ro'yxat, andoza) ---

const IDLAR_MAX = 20000;
const idlarRoyxati = (v, max = IDLAR_MAX) => [...new Set((Array.isArray(v) ? v : []).map(ANY_ID).filter(Boolean))].slice(0, max);

/** Filtrlar (belgi guruhlari). `fanId` berilsa — shu fanniki va hamma fanga umumiylari. */
async function belgiGuruhlari(orgIds, fanId = null) {
  const guruhlar = await prisma.questionTagGroup.findMany({
    where: { schoolId: { in: orgIds }, ...(fanId ? { OR: [{ subjectId: null }, { subjectId: fanId }] } : {}) },
    include: { tags: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } }, orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  return guruhlar.map(g => ({
    id: g.id, name: g.name, order: g.order, subjectId: g.subjectId, tur: g.tur,
    tags: g.tags.map(t => ({ id: t.id, name: t.name, order: t.order, ...(t.asos ? { asos: t.asos } : {}) })),
  }));
}

/** Mavzuga bo'lim yozilganda u fan ro'yxatida bo'lmasa — qo'shiladi (tartib saqlansin). */
async function bolimniRoyxatga(fan, bolim) {
  const b = nomi(bolim);
  if (!fan || !b || (fan.bolimlar || []).some(x => kalit(x) === kalit(b))) return;
  await prisma.questionSubject.update({ where: { id: fan.id }, data: { bolimlar: [...(fan.bolimlar || []), b] } });
}

/** Bo'lim nomi o'zgarsa: shu fan andozalari va qulflanmagan imtihon qoidalaridagi nomi ham. */
async function bolimNominiTarqat(orgIds, fan, eski, yangi) {
  const andozalar = await prisma.questionBlueprint.findMany({ where: { schoolId: { in: orgIds }, subjectId: fan.id } });
  for (const a of andozalar) {
    const rows = Array.isArray(a.rows) ? a.rows : [];
    if (!rows.some(r => r?.bolim && kalit(r.bolim) === kalit(eski))) continue;
    await prisma.questionBlueprint.update({ where: { id: a.id }, data: { rows: rows.map(r => (r?.bolim && kalit(r.bolim) === kalit(eski) ? { ...r, bolim: yangi } : r)) } });
  }
  const exams = await prisma.exam.findMany({ where: { schoolId: { in: orgIds }, lockedAt: null }, select: { id: true, blocks: true } });
  for (const e of exams) {
    let ozgardi = false;
    const blocks = (Array.isArray(e.blocks) ? e.blocks : []).map(b => {
      if (Number(b.fanId) !== fan.id) return b;
      return { ...b, topicRules: (b.topicRules || []).map(r => { if (!r?.section || kalit(r.section) !== kalit(eski)) return r; ozgardi = true; return { ...r, section: yangi }; }) };
    });
    if (ozgardi) await prisma.exam.update({ where: { id: e.id }, data: { blocks } });
  }
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

// Rasm va yechim filtrlari: so'rov matni lib/bankFiltr.js da (qat'iy matn, qiymatlar — parametr).
/** Rasmi bor savollar id lari (`mavzuIdlar` null — butun bank; bo'sh — savol yo'q). */
async function rasmliIdlar(orgIds, mavzuIdlar) {
  if (mavzuIdlar && !mavzuIdlar.length) return [];
  const s = rasmliIdlarSorovi(orgIds, mavzuIdlar, IDLAR_MAX);
  return (await prisma.$queryRawUnsafe(s.sql, ...s.qiymatlar)).map(r => r.id);
}
/** Fan mavzularidagi (arxivsiz) savollar: {jami, rasmli, yechimli}. */
async function rasmYechimSoni(orgIds, mavzuIdlar) {
  if (!mavzuIdlar.length) return { jami: 0, rasmli: 0, yechimli: 0 };
  const s = rasmYechimSoniSorovi(orgIds, mavzuIdlar);
  const [r] = await prisma.$queryRawUnsafe(s.sql, ...s.qiymatlar);
  return { jami: Number(r?.jami) || 0, rasmli: Number(r?.rasmli) || 0, yechimli: Number(r?.yechimli) || 0 };
}

/**
 * Ro'yxat sharti. Bir ustun ichida tanlanganlar — "yoki", ustunlar orasida — "va"
 * (Addmen'dagidek). '' — qiymati yo'q (bo'limsiz, manbasiz, to'plamsiz).
 */
async function royxatSharti(f, orgIds) {
  const and = [{ schoolId: { in: orgIds } }];
  const fanId = ANY_ID(f.fanId);
  // Tanlangan fan, bo'lim va mavzular (null — fan tanlanmagan: butun bank).
  let mavzuIdlar = null;
  if (fanId) {
    const fan = await fanniOl(fanId, orgIds);
    let mavzular = fan.topics;
    const bolimlar = f.bolimlar !== undefined ? matnlar(f.bolimlar) : null;
    if (bolimlar && bolimlar.length) mavzular = mavzular.filter(t => bolimlar.includes(nomi(t.section)));
    const tanlangan = idlarRoyxati(f.mavzular, 2000);
    if (tanlangan.length) mavzular = mavzular.filter(t => tanlangan.includes(t.id));
    mavzuIdlar = mavzular.map(t => t.id);
    and.push({ bankTopicId: { in: mavzuIdlar } });
  }
  // Qiyinlik ustuni: asosiy darajalar va foydalanuvchi darajalari (belgi) — "yoki".
  const qiyin = (Array.isArray(f.qiyinlik) ? f.qiyinlik : []).map(Number).filter(d => [1, 2, 3].includes(d));
  const darajalar = idlarRoyxati(f.darajalar, 50);
  // qiyinlikSof — asosiy daraja faqat o'zi (foydalanuvchi darajasi qo'yilgan savollarsiz).
  const sof = f.qiyinlikSof === true;
  if ((qiyin.length || darajalar.length) && (sof || qiyin.length < 3)) {
    const ozDarajali = sof && qiyin.length ? ((await darajaGuruhi(orgIds))?.tags || []).map(t => t.id) : [];
    const ozisiz = ozDarajali.length ? { NOT: { tagIds: { hasSome: ozDarajali } } } : {};
    and.push({ OR: [...qiyin.map(d => ({ difficulty: d === 3 ? { gte: 3 } : d === 2 ? 2 : { lte: 1 }, ...ozisiz })), ...(darajalar.length ? [{ tagIds: { hasSome: darajalar } }] : [])] });
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
  // Filtr ichida — "yoki"; 0 — shu filtrning hech bir qiymati qo'yilmagan savollar.
  for (const [gid, ids] of Object.entries(f.belgilar && typeof f.belgilar === 'object' ? f.belgilar : {})) {
    const l = idlarRoyxati(ids, 200);
    const yoq = Array.isArray(ids) && ids.some(x => Number(x) === 0);
    const yoki = l.length ? [{ tagIds: { hasSome: l } }] : [];
    if (yoq) {
      const g = ANY_ID(gid) ? await prisma.questionTagGroup.findFirst({ where: { id: ANY_ID(gid), schoolId: { in: orgIds } }, include: { tags: { select: { id: true } } } }) : null;
      if (!g || !g.tags.length) continue;   // qiymati yo'q filtr: hamma savol "qo'yilmagan"
      yoki.push({ NOT: { tagIds: { hasSome: g.tags.map(t => t.id) } } });
    }
    if (yoki.length) and.push(yoki.length === 1 ? yoki[0] : { OR: yoki });
  }
  const dan = ANY_ID(f.qidDan), gacha = ANY_ID(f.qidGacha);
  if (dan || gacha) and.push({ id: { ...(dan ? { gte: dan } : {}), ...(gacha ? { lte: gacha } : {}) } });
  if (SAVOL_HOLATLARI.includes(f.holat)) and.push({ status: f.holat });
  else and.push({ status: { not: 'arxiv' } });
  if (SAVOL_TURLARI.includes(f.tur)) and.push({ type: f.tur });
  // Addmen REMARK, PASSAGE, DISPLAY CHOICES filtrlari.
  const izohlar = matnlar(f.izohlar);
  if (izohlar.length) {
    const bor = izohlar.filter(Boolean);
    and.push({ OR: [...(bor.length ? [{ remark: { in: bor } }] : []), ...(izohlar.includes('') ? [{ remark: null }, { remark: '' }] : [])] });
  }
  if (f.matnli === 'bor') and.push({ passageId: { not: null } });
  else if (f.matnli === 'yoq') and.push({ passageId: null });
  // Rasmli / rasmsiz: rasm savolning o'zida, matni yoki variantlari ichida, yoki umumiy shartida.
  if (f.rasm === 'bor' || f.rasm === 'yoq') {
    const idlar = await rasmliIdlar(orgIds, mavzuIdlar);
    and.push({ id: f.rasm === 'bor' ? { in: idlar } : { notIn: idlar } });
  }
  // Yechimi bor / yo'q (holati emas, matnining o'zi bo'yicha).
  if (f.yechim === 'bor') and.push({ solution: { not: null } }, { solution: { notIn: YECHIM_BOSH } });
  else if (f.yechim === 'yoq') and.push({ OR: [{ solution: null }, { solution: { in: YECHIM_BOSH } }] });
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
    ...(r.tagIds.length ? { tagIds: r.tagIds } : {}), ...(r.qiyinlik ? { difficulty: r.qiyinlik } : {}), type: r.tur,
    // Qismli savol: andozada savollar soni yoziladi — qoidada qismlar soni (har savol 2 qism, ustoz tekshiradi).
    ...(r.tur === 'qismli' ? { count: r.soni * 2, qism: 2, tekshir: 'ustoz' } : { count: r.soni }),
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
  if (body.soni !== undefined) d.soni = Math.max(0, Math.min(ANDOZA_MAX, parseInt(body.soni) || 0));
  return d;
}

async function andozaniOl(id, orgIds) {
  if (!ANY_ID(id)) throw new XatoJavob(400, 'Andoza tanlanmagan');
  const a = await prisma.questionBlueprint.findUnique({ where: { id } });
  if (!a || !orgIds.includes(a.schoolId)) throw new XatoJavob(404, 'Andoza topilmadi');
  return a;
}

/**
 * Andoza savollari — berilgan tartibda; bankdan o'chirilgan savol tushib qoladi.
 * `toliq` — kartasi bilan (mavzu, umumiy shart, ishlatilishi).
 */
async function andozaSavollari(idlar, orgIds, toliq = false) {
  const ids = idlarRoyxati(idlar, ANDOZA_MAX * 4);
  if (!ids.length) return [];
  const rows = await prisma.question.findMany({
    where: { id: { in: ids }, schoolId: { in: orgIds } },
    select: {
      id: true, text: true, imageUrl: true, type: true, status: true, difficulty: true, passageId: true,
      options: true, optionA: true, optionB: true, optionC: true, optionD: true, correctAnswer: true, answers: true,
      bankTopicId: true, bankTopic: { select: { id: true, name: true, subjectId: true } },
      ...(toliq ? {
        subject: true, topic: true, usedCount: true, pCorrect: true, tagIds: true, source: true, remark: true, points: true, joylashuv: true,
        passage: { select: { id: true, title: true, tur: true, text: true, variantlar: true } },
      } : {}),
    },
  });
  const byId = new Map(rows.map(q => [q.id, q]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

/** Guruhli savollarning (juft, qismli) hamma bo'laklari: umumiy shart id si → savol id lari (holatidan qat'i nazar). */
async function guruhAzolari(savollar, orgIds) {
  const pa = [...new Set(savollar.filter(q => q.passageId && guruhSavolimi(turi(q.type))).map(q => q.passageId))];
  const out = new Map();
  if (!pa.length) return out;
  const rows = await prisma.question.findMany({
    where: { schoolId: { in: orgIds }, passageId: { in: pa }, type: { in: Object.values(GURUH_TURLARI) } },
    select: { id: true, passageId: true }, orderBy: { id: 'asc' },
  });
  for (const r of rows) out.set(r.passageId, [...(out.get(r.passageId) || []), r.id]);
  return out;
}

/** Andozaga nechta savol kerak: yozilgani; eski (qoidali) andozada — qatorlar yig'indisi. */
const andozaJami = (a, savollar) => andozaSoni(a.soni, savollar, andozaQatorlari(a.rows).reduce((s, r) => s + r.soni, 0));

/**
 * Andozaning API ko'rinishi: `soni` — nechta savol kerak, `savolSoni` — nechta qo'shilgan (imtihon
 * sanaganidek), `fanId` — blok fani (savollarning ko'pchiligi qaysi fandan; savol yo'q — qoidalar fani).
 */
function andozaKorinishi(a, savollar) {
  return {
    id: a.id, name: a.name, subjectId: a.subjectId ?? null, fanId: andozaFani(savollar, a.subjectId), rows: andozaQatorlari(a.rows),
    soni: andozaJami(a, savollar), questionIds: andozaIdlari(savollar), savolSoni: andozaSavolSoni(savollar),
    schoolId: a.schoolId, updatedAt: a.updatedAt,
  };
}

/** Andoza savollari bilan: har savolda `tushmaydi` (qog'ozga tushmaslik sababi yoki null). */
async function andozaTafsili(a, orgIds, { qisqa = false, kalitsiz = false } = {}) {
  const savollar = await andozaSavollari(a.questionIds, orgIds, !qisqa);
  const tosiq = andozaTosiqlari(savollar, await guruhAzolari(savollar, orgIds));
  const byId = new Map(savollar.map(q => [q.id, q]));
  const korinish = andozaKorinishi(a, savollar);
  return {
    ...korinish,
    savollar: korinish.questionIds.map(id => {
      const { optionA, optionB, optionC, optionD, ...q } = byId.get(id);
      const tushmaydi = tosiq.get(id) || null;
      if (qisqa) return { id, type: turi(q.type), passageId: q.passageId, status: q.status, tushmaydi };
      const o = { ...q, text: String(q.text || '').slice(0, 2000), options: savolVariantlari({ options: q.options, optionA, optionB, optionC, optionD }).map(x => x.slice(0, 500)), tushmaydi };
      if (kalitsiz) {
        delete o.correctAnswer;
        if (o.type !== 'moslash') delete o.answers;
      }
      return o;
    }),
  };
}

/** Fanning faol savollari — variant yasashdagi shaklda (mavzu id si, bo'limi va fan id si bilan). */
async function fanBanki(fan, orgIds) {
  const bolimi = new Map(fan.topics.map(t => [t.id, t.section || '']));
  const rows = await prisma.question.findMany({
    where: { schoolId: { in: orgIds }, status: 'faol', bankTopicId: { in: fan.topics.map(t => t.id) } },
    select: {
      id: true, text: true, imageUrl: true, type: true, status: true, options: true, optionA: true, optionB: true, optionC: true, optionD: true,
      correctAnswer: true, answers: true, difficulty: true, source: true, tagIds: true, bankTopicId: true, passageId: true, usedCount: true, subject: true, topic: true,
    },
  });
  return rows.map(q => ({ ...q, section: bolimi.get(q.bankTopicId) || '', mavzuId: q.bankTopicId, fanId: fan.id }));
}

/** Guruhli savollarning to'liq hajmi (holatidan qat'i nazar): bir bo'lagi qoralamadagi guruh "butun" sanalmasin. */
async function guruhHajmi(orgIds) {
  const l = await prisma.question.groupBy({ by: ['passageId'], where: { schoolId: { in: orgIds }, passageId: { not: null }, type: { in: Object.values(GURUH_TURLARI) } }, _count: { _all: true } });
  return new Map(l.map(x => [x.passageId, x._count._all]));
}

