// Imtihon moduli API: savollar banki, imtihon tuzilmasi, variantlar (kalit
// serverda qoladi), o'rinlashtirish, skaner natijalari, tekshirish, tahlil va
// e'lon. Mantiq — lib/imtihon.js (toza funksiyalar), reja — docs/IMTIHON_PLAN.md.
//
// Kalit sirligi: brauzerga variant faqat kalitsiz ketadi (kitobcha chop etish
// uchun). To'g'ri javoblarni faqat "imtihonlar.kalit" ruxsati borlar ko'radi,
// ball esa faqat shu yerda hisoblanadi — brauzer yuborgan ball qabul qilinmaydi.

import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { JWT_SECRET } from '../lib/config.js';
import { authenticate, allowedSchoolIds, organizationSchoolIds, canAccessSchool, ozKurslari } from '../middleware/auth.js';
import { yetadimi } from '../lib/ruxsatlar.js';
import { markazBrendi } from '../lib/markazBrendi.js';
import { raschBaholash, tBallar, raschDarajasi } from '../lib/rasch.js';
import { registerImtihonAIRoutes } from './imtihonAI.js';
import {
  HARFLAR, VARIANT_KODLARI, IMTIHON_HOLATLARI, SAVOL_HOLATLARI, YECHIM_HOLATLARI,
  sozlamaniTozala, turi, savolVariantlari, savolXatosi, varaqTuzilmasi, variantlarniYasash,
  bankYetarliligi, natijaniHisobla, orinlashtirish, orinVarianti, xonaOrinlari, reytingOrinlari,
  savolTahlili, natijaXabari, ruxsatnomaMatni, sanaMatni, vergul, OYLAR,
} from '../lib/imtihon.js';
import { toDateStr } from '../lib/lessons.js';

const kor = (req, bolim, daraja = 1) => yetadimi(req.ruxsat, bolim, daraja);

// Natija sahifasi havolasi: natija id si + imzo. Imzosiz yoki boshqa id bilan
// ochib bo'lmaydi, shuning uchun havolani faqat xabar olgan ota-ona biladi.
export function natijaTokeni(resultId) {
  const imzo = crypto.createHmac('sha256', JWT_SECRET).update(`natija:${resultId}`).digest('base64url').slice(0, 16);
  return `${Number(resultId).toString(36)}.${imzo}`;
}

function tokendanId(token) {
  const [a, imzo] = String(token || '').split('.');
  const id = parseInt(a, 36);
  if (!Number.isInteger(id) || id <= 0 || !imzo) return null;
  const kutilgan = natijaTokeni(id).split('.')[1];
  if (imzo.length !== kutilgan.length) return null;
  return crypto.timingSafeEqual(Buffer.from(imzo), Buffer.from(kutilgan)) ? id : null;
}

/** Tashqaridan ochiladigan manzil (Vercel orqasida ham to'g'ri). */
function asosiyManzil(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0];
  return `${proto}://${req.get('x-forwarded-host') || req.get('host')}`;
}

const natijaSahifaCheklovi = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p so'rov. Birozdan keyin qayta oching." },
});

const KOD_HARFLARI = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function varaqKodi() {
  let s = '';
  for (let i = 0; i < 7; i++) s += KOD_HARFLARI[crypto.randomInt(KOD_HARFLARI.length)];
  return s;
}

/** Imtihon qatnashadigan filiallar (yaratilgan filial birinchi). */
export function imtihonFiliallari(e) {
  return [...new Set([e.schoolId, ...(Array.isArray(e.branchIds) ? e.branchIds : [])])];
}

/**
 * Imtihonni brauzerga beriladigan ko'rinishga keltiradi: eski `variants`
 * ustuni va urug' ketmaydi, kalit tuzatishlari faqat kalit ruxsati bilan.
 */
export function imtihonJavobi(e, req) {
  // eslint-disable-next-line no-unused-vars
  const { variants, seed, examVariants, ...qolgan } = e;
  const settings = sozlamaniTozala(e.settings);
  if (!kor(req, 'imtihonlar.kalit')) settings.keyFix = {};
  return { ...qolgan, settings };
}

/** Ko'rinadigan filiallar: tanlangan filial yoki ruxsat etilganlarning hammasi. */
async function korinadiganFiliallar(req) {
  const tanlangan = parseInt(req.query.schoolId);
  const ruxsat = await allowedSchoolIds(req.user);
  return tanlangan > 0 && ruxsat.includes(tanlangan) ? [tanlangan] : ruxsat;
}

function blokniTozala(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.slice(0, 20).map((b, i) => ({
    id: String(b?.id || `b${i + 1}`).slice(0, 40),
    subject: String(b?.subject || '').trim().slice(0, 120),
    pointsPerQuestion: Number.isFinite(Number(b?.pointsPerQuestion)) ? Number(b.pointsPerQuestion) : 1,
    topicRules: (Array.isArray(b?.topicRules) ? b.topicRules : []).slice(0, 60).map(r => {
      const rule = {
        topic: String(r?.topic || '').trim().slice(0, 200),
        count: Math.min(300, Math.max(0, parseInt(r?.count) || 0)),
        type: turi(r?.type),
      };
      const d = parseInt(r?.difficulty);
      if (d >= 1 && d <= 5) rule.difficulty = d;
      if (r?.points !== undefined && r?.points !== null && r?.points !== '' && Number.isFinite(Number(r.points))) rule.points = Number(r.points);
      return rule;
    }).filter(r => r.count > 0),
  })).filter(b => b.subject);
}

// --- Savollar ---------------------------------------------------------------

const LAVHA_MAX = 20000;

function savolMalumoti(body) {
  const d = {};
  if (body.text !== undefined) d.text = String(body.text ?? '').slice(0, LAVHA_MAX);
  if (body.imageUrl !== undefined) d.imageUrl = body.imageUrl || null;
  if (body.type !== undefined) d.type = turi(body.type);
  if (body.options !== undefined) {
    d.options = Array.isArray(body.options) ? body.options.slice(0, HARFLAR.length).map(x => String(x ?? '').slice(0, 4000)) : null;
  }
  if (body.correctAnswer !== undefined) d.correctAnswer = String(body.correctAnswer ?? '').trim().slice(0, 40);
  if (body.answers !== undefined) {
    d.answers = Array.isArray(body.answers) ? body.answers.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 10) : null;
  }
  if (body.points !== undefined) d.points = body.points === null || body.points === '' || !Number.isFinite(Number(body.points)) ? null : Number(body.points);
  if (body.lockOptions !== undefined) d.lockOptions = !!body.lockOptions;
  for (const k of ['subject', 'topic']) if (body[k] !== undefined) d[k] = String(body[k] ?? '').trim().slice(0, 200);
  for (const k of ['section', 'grade', 'source']) if (body[k] !== undefined) d[k] = body[k] ? String(body[k]).trim().slice(0, 200) : null;
  if (body.language !== undefined) d.language = ['uz', 'ru', 'en'].includes(body.language) ? body.language : 'uz';
  if (body.difficulty !== undefined) d.difficulty = Math.min(5, Math.max(1, parseInt(body.difficulty) || 1));
  if (body.solution !== undefined) d.solution = body.solution ? String(body.solution).slice(0, LAVHA_MAX) : null;
  if (body.solutionStatus !== undefined) d.solutionStatus = YECHIM_HOLATLARI.includes(body.solutionStatus) ? body.solutionStatus : 'yoq';
  if (body.status !== undefined) d.status = SAVOL_HOLATLARI.includes(body.status) ? body.status : 'faol';
  for (const k of ['passageId', 'topicId', 'parentId']) if (body[k] !== undefined) d[k] = parseInt(body[k]) || null;
  return d;
}

/** Faol savol imtihonga yaroqli bo'lishi shart; qoralama chala bo'lishi mumkin. */
function savolniTekshir(q) {
  if (!String(q.subject || '').trim()) return 'Fanni kiriting';
  if (!String(q.topic || '').trim()) return 'Mavzuni kiriting';
  if ((q.status || 'faol') === 'faol') return savolXatosi(q);
  return null;
}

async function matnTashkilotdami(passageId, orgIds) {
  if (!passageId) return true;
  const p = await prisma.passage.findUnique({ where: { id: passageId }, select: { schoolId: true } });
  return !!p && orgIds.includes(p.schoolId);
}

// Faqat imtihonda ishlatiladigan maydonlar (matnsiz bo'lsa ham yetadi) — variant
// yasash va bank yetarliligi uchun. Matnni tekshirish uchun `text` ham olinadi.
const BANK_SELECT = {
  id: true, text: true, imageUrl: true, subject: true, topic: true, type: true, options: true,
  optionA: true, optionB: true, optionC: true, optionD: true, correctAnswer: true, answers: true,
  lockOptions: true, passageId: true, difficulty: true, language: true, status: true, usedCount: true,
};

// --- Natija yordamchilari ---------------------------------------------------

/** Operator hal qilmagan shubhalar. n=0 — variant masalasi (manual.variant bilan yopiladi). */
function halQilinmagan(flags, manual) {
  return (Array.isArray(flags) ? flags : []).filter(f => {
    if (f.n === 0) return !(manual && manual.variant);
    return !(manual && Object.prototype.hasOwnProperty.call(manual, f.n));
  });
}

/** Yakuniy javoblar: skaner o'qigani ustiga operator qarori. */
function yakuniyJavoblar(raw, manual) {
  const out = { ...(raw || {}) };
  for (const [k, v] of Object.entries(manual || {})) if (k !== 'variant') out[k] = v;
  return out;
}

function natijaHolati({ flags, manual, hisob, oldingi }) {
  if (halQilinmagan(flags, manual).length || !hisob || hisob.baholanmagan > 0) return 'shubhali';
  return oldingi === 'tekshirildi' || Object.keys(manual || {}).length ? 'tekshirildi' : 'avto';
}

async function variantElementlari(examId) {
  const variants = await prisma.examVariant.findMany({ where: { examId } });
  return new Map(variants.map(v => [`${v.session}|${v.code}`, v.items]));
}

function hisobla(exam, items, raw, manual) {
  if (!items) return null;
  return natijaniHisobla({ items, javoblar: raw || {}, qolda: manual || {}, blocks: exam.blocks, settings: exam.settings });
}

/** Bitta natijani (xom javob va qarordan) qayta hisoblab yozish uchun maydonlar. */
function hisobMaydonlari(exam, items, r) {
  const variantCode = r.manual?.variant || r.variantCode;
  const h = hisobla(exam, items, r.raw, r.manual);
  const reviewStatus = natijaHolati({ flags: r.flags, manual: r.manual, hisob: h, oldingi: r.reviewStatus });
  return {
    variantCode,
    answers: yakuniyJavoblar(r.raw, r.manual),
    score: h ? h.ball : 0,
    percentage: h ? h.foiz : 0,
    blockScores: h ? h.blockScores : [],
    detail: h ? h.detail : null,
    reviewStatus,
  };
}

async function hammasiniQaytaHisobla(exam) {
  const vmap = await variantElementlari(exam.id);
  const results = await prisma.examResult.findMany({
    where: { examId: exam.id },
    select: { id: true, session: true, variantCode: true, raw: true, manual: true, flags: true, reviewStatus: true },
  });
  const yangilash = results.map(r => {
    const variantCode = r.manual?.variant || r.variantCode;
    const items = vmap.get(`${r.session}|${variantCode}`);
    return prisma.examResult.update({ where: { id: r.id }, data: hisobMaydonlari(exam, items, r) });
  });
  for (let i = 0; i < yangilash.length; i += 100) await prisma.$transaction(yangilash.slice(i, i + 100));
  return results.length;
}

/**
 * Rasch: har natija uchun {raschTheta, raschScore (T-ball), grade}. Faqat
 * yopiq va raqamli savollar (to'g'ri/xato); yozma, bekor qilingan va
 * baholanmagan savollar hisobga olinmaydi, bo'sh javob — xato.
 */
function raschNatijalari(results, variants, darajalar) {
  const tur = new Map();
  for (const v of variants) for (const it of Array.isArray(v.items) ? v.items : []) tur.set(it.q, it.t);
  const javoblar = results.map(r => {
    const j = {};
    for (const d of Array.isArray(r.detail) ? r.detail : []) {
      const t = tur.get(d.q);
      if (t !== 'yopiq' && t !== 'raqamli') continue;
      if (d.holat === 'togri') j[d.q] = 1;
      else if (d.holat === 'xato' || d.holat === 'bosh') j[d.q] = 0;
    }
    return j;
  });
  const { theta } = raschBaholash(javoblar);
  const T = tBallar(theta);
  return new Map(results.map((r, i) => [r.id, {
    raschTheta: Number.isFinite(theta[i]) ? Math.round(theta[i] * 1000) / 1000 : null,
    raschScore: T[i],
    grade: raschDarajasi(T[i], darajalar),
  }]));
}

const NATIJA_ROYXAT_SELECT = {
  id: true, studentId: true, examId: true, seatId: true, session: true, variantCode: true, score: true,
  percentage: true, blockScores: true, reviewStatus: true, flags: true, manual: true, pages: true,
  source: true, scannedAt: true, schoolId: true, rank: true, rankBranch: true, rankGroup: true,
  notifiedAt: true, notifyStatus: true, raschScore: true, grade: true,
};

/** Natija varaqlari rasmlarining Storage dagi nomlari (pages[].url dan). */
function rasmNomlari(pages) {
  return Object.values(pages && typeof pages === 'object' ? pages : {})
    .map(v => String(v?.url || '').split('/object/public/uploads/')[1])
    .filter(Boolean)
    .map(nom => decodeURIComponent(nom));
}

// --- Ruxsatnoma ---------------------------------------------------------------

// server.js dagi sendToOne va botning o'quvchi menyusi — ro'yxatdan o'tishda
// keladi (avtomatik yuborish ham shular bilan).
let xabarYuboruvchi = null;
let oquvchiMenyusi = null;

const kimgaQiymati = (to) => (to === 'STUDENT' ? 'STUDENT' : to === 'ALL' ? 'STUDENT,FATHER,MOTHER' : 'FATHER,MOTHER');

/** Telegram xabariga "Natijani ochish" Mini App tugmasi (faqat https — Telegram shuni qabul qiladi). */
export function natijaTugmasi(havola, matn = '📊 Natijani ochish') {
  if (!/^https:\/\//.test(String(havola || ''))) return undefined;
  return { reply_markup: { inline_keyboard: [[{ text: matn, web_app: { url: havola } }]] } };
}

/**
 * Imtihonning o'rin berilgan, hali ruxsatnoma olmagan qatnashchilariga
 * ruxsatnoma yuboradi — bir chaqiruvda `limit` tagacha va `muddat` (ms,
 * Date.now() bo'yicha) tugaguncha. Qaytaradi: {yuborildi, xato, qoldi}.
 */
export async function ruxsatnomalarniYubor(examId, { limit = 10, muddat = Infinity } = {}) {
  if (!xabarYuboruvchi) return { yuborildi: 0, xato: 0, qoldi: 0 };
  const e = await prisma.exam.findUnique({ where: { id: examId } });
  if (!e) return { yuborildi: 0, xato: 0, qoldi: 0 };
  const s = sozlamaniTozala(e.settings);
  const kutmoqda = { examId, admitSentAt: null, roomId: { not: null } };
  if (s.admit.channel === 'NONE') return { yuborildi: 0, xato: 0, qoldi: await prisma.examSeat.count({ where: kutmoqda }) };
  const seats = await prisma.examSeat.findMany({ where: kutmoqda, include: { student: true }, orderBy: { id: 'asc' }, take: limit });
  const roomIds = [...new Set(seats.map(x => x.roomId))];
  const [rooms, brend] = await Promise.all([
    prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, name: true, schoolId: true } }),
    markazBrendi(e.schoolId),
  ]);
  const schools = await prisma.school.findMany({ where: { id: { in: [...new Set(rooms.map(r => r.schoolId))] } }, select: { id: true, name: true } });
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const schoolMap = new Map(schools.map(x => [x.id, x.name]));
  let yuborildi = 0, xato = 0;
  for (const o of seats) {
    if (Date.now() > muddat) break;
    // Avval band qilinadi: ikki jarayon (qo'lda va avtomatik) bir vaqtda ishlasa ham bitta o'ringa bir marta ketadi.
    const band = await prisma.examSeat.updateMany({ where: { id: o.id, admitSentAt: null }, data: { admitSentAt: new Date(), admitStatus: 'yuborilmoqda' } });
    if (!band.count) continue;
    const room = roomMap.get(o.roomId);
    const smena = s.sessions.find(x => x.id === o.session);
    const matn = ruxsatnomaMatni(s.admit.template, {
      ism: o.student?.name || o.guestName || '',
      imtihon: e.name,
      sana: sanaMatni(e.date),
      vaqt: smena?.time ? `${smena.time}${s.sessions.length > 1 ? ` (${smena.name})` : ''}` : '',
      // Qatnashchi borishi kerak bo'lgan joy — xonaning filiali.
      filial: room ? schoolMap.get(room.schoolId) || '' : '',
      xona: room?.name || '',
      qator: o.row != null ? o.row + 1 : '',
      orin: o.col != null ? o.col + 1 : '',
      markaz: brend.orgName,
    });
    let natija;
    try {
      if (o.student) {
        // Menyu klaviaturasi bilan: botni ilgari ochganlarga ham "📝 Imtihonlar" tugmasi chiqadi.
        natija = await xabarYuboruvchi({ student: o.student, message: matn, channel: s.admit.channel, recipientTo: kimgaQiymati(s.admit.to), type: 'EXAM_ADMIT', schoolId: o.schoolId, telegramExtra: oquvchiMenyusi ? oquvchiMenyusi() : undefined });
      } else if (o.guestPhone && s.admit.channel !== 'TELEGRAM') {
        natija = await xabarYuboruvchi({ student: { id: null, name: o.guestName, phone: o.guestPhone }, message: matn, channel: 'SMS', recipientTo: 'STUDENT', type: 'EXAM_ADMIT', schoolId: o.schoolId });
      } else {
        natija = { attempted: false, success: false };
      }
    } catch (err) {
      console.error('[imtihon] ruxsatnoma:', err.message);
      natija = { attempted: true, success: false };
    }
    if (natija.success) yuborildi++; else xato++;
    await prisma.examSeat.update({
      where: { id: o.id },
      data: { admitStatus: natija.success ? 'yuborildi' : natija.attempted ? 'xato' : 'aloqa yoq' },
    });
  }
  return { yuborildi, xato, qoldi: await prisma.examSeat.count({ where: kutmoqda }) };
}

/**
 * Avtomatik ruxsatnoma: ertangi (O'zbekiston vaqti) imtihonlarga, soat 12:00
 * dan keyin, sozlamada yoqilgan bo'lsa. Server.js dagi avtomatik ishlar bilan
 * birga chaqiriladi; har safar ozginasi — qolgani keyingi safar.
 */
export async function ruxsatnomaNavbati({ vaqtChegarasi = 20000, hozir = new Date() } = {}) {
  const uz = new Date(hozir.getTime() + 5 * 3600 * 1000);
  if (uz.getUTCHours() < 12) return { yuborildi: 0, imtihonlar: 0 };
  const ertaga = toDateStr(new Date(hozir.getTime() + 24 * 3600 * 1000));
  const exams = await prisma.exam.findMany({
    where: { date: ertaga, publishedAt: null, seats: { some: { admitSentAt: null, roomId: { not: null } } } },
    select: { id: true, settings: true },
  });
  const muddat = Date.now() + vaqtChegarasi;
  let yuborildi = 0;
  for (const e of exams) {
    if (!sozlamaniTozala(e.settings).admit.auto || Date.now() > muddat) continue;
    const r = await ruxsatnomalarniYubor(e.id, { limit: 25, muddat });
    yuborildi += r.yuborildi;
  }
  return { yuborildi, imtihonlar: exams.length };
}

/**
 * Oylik imtihon hisoboti (reja 2.3): `bugun` dan oldingi oyda e'lon qilingan
 * imtihonlar — har o'quvchiga bitta matn ({imtihon_oylik}). Xabarlar →
 * Avtomatik qoidalar → "Oylik imtihon hisoboti" chaqiradi (server.js).
 * Qaytaradi: o'quvchi qatorlari + `oylikImtihon`.
 */
export async function oylikImtihonHisoboti(schoolId, bugun) {
  const [y, m] = String(bugun).split('-').map(Number);
  const oy = m === 1 ? 12 : m - 1;
  const yil = m === 1 ? y - 1 : y;
  const prefiks = `${yil}-${String(oy).padStart(2, '0')}-`;
  const natijalar = await prisma.examResult.findMany({
    where: { schoolId, studentId: { not: null }, exam: { publishedAt: { not: null }, date: { startsWith: prefiks } } },
    include: { student: true, exam: { select: { id: true, name: true, date: true, maxScore: true, settings: true } } },
  });
  natijalar.sort((a, b) => a.exam.date.localeCompare(b.exam.date) || a.examId - b.examId);
  const examIds = [...new Set(natijalar.map(r => r.examId))];
  const soni = examIds.length ? await prisma.examResult.groupBy({ by: ['examId'], where: { examId: { in: examIds } }, _count: { _all: true } }) : [];
  const jami = new Map(soni.map(x => [x.examId, x._count._all]));
  const oyNomi = OYLAR[oy - 1].charAt(0).toUpperCase() + OYLAR[oy - 1].slice(1);
  const boyicha = new Map();
  for (const r of natijalar) {
    if (!r.student || r.student.status === 'Ochirilgan') continue;
    if (!boyicha.has(r.studentId)) boyicha.set(r.studentId, { student: r.student, l: [] });
    boyicha.get(r.studentId).l.push(r);
  }
  return [...boyicha.values()].map(({ student, l }) => {
    const qatorlar = l.map(r => {
      const s = sozlamaniTozala(r.exam.settings);
      let orin = '';
      if (r.rank && s.ranking === 'hammasi') orin = `, ${r.rank}/${jami.get(r.examId) || '?'}-o'rin`;
      else if (r.rank && s.ranking === 'top' && r.rank <= s.topN) orin = `, ${r.rank}-o'rin`;
      const rasch = r.raschScore != null ? `, Rasch ${vergul(r.raschScore)}${r.grade ? ` (${r.grade})` : ''}` : '';
      return `• ${r.exam.name} (${sanaMatni(r.exam.date).replace(/ \d{4}$/, '')}): ${vergul(r.score)}/${vergul(r.exam.maxScore)} ball, ${vergul(r.percentage)}%${rasch}${orin}`;
    });
    const ortacha = Math.round((l.reduce((a, r) => a + r.percentage, 0) / l.length) * 10) / 10;
    const matn = [`${oyNomi} oyi: ${l.length} ta imtihon`, ...qatorlar, ...(l.length > 1 ? [`O'rtacha: ${vergul(ortacha)}%`] : [])].join('\n');
    return { ...student, oylikImtihon: matn };
  });
}

export function registerImtihonRoutes(app, { sendToOne, rasmniSaqla, rasmlarniOchir = async () => {}, oquvchiMenyusi: menyu = null }) {
  xabarYuboruvchi = sendToOne;
  oquvchiMenyusi = menyu;
  // AI yo'llari (savol import, yechim, klon, tarjima, yozma baho) — routes/imtihonAI.js.
  registerImtihonAIRoutes(app);
  // Varaq rasmlari o'chirilgan imtihon/natija bilan birga ketadi. Xato bo'lsa
  // ham asosiy amal buzilmaydi — rasm yetim qolgani yozuv qolganidan yaxshi.
  const rasmlarniTozala = async (nomlar) => {
    try { if (nomlar.length) await rasmlarniOchir(nomlar); } catch (e) { console.error('[imtihon] rasm o\'chmadi:', e.message); }
  };
  // ========================= Savollar banki =========================

  // Bank butun tashkilotniki: Langar ham Sariosiyo kiritgan savoldan foydalanadi.
  app.get('/api/questions', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const where = { schoolId: { in: orgIds } };
      const q = req.query;
      const ins = v => ({ equals: String(v), mode: 'insensitive' });
      if (q.fan) where.subject = ins(q.fan);
      if (q.mavzu) where.topic = ins(q.mavzu);
      if (q.tur && ['yopiq', 'raqamli', 'yozma'].includes(q.tur)) where.type = q.tur;
      if (q.holat && SAVOL_HOLATLARI.includes(q.holat)) where.status = q.holat;
      if (q.manba) where.source = ins(q.manba);
      if (q.til && ['uz', 'ru', 'en'].includes(q.til)) where.language = q.til;
      if (q.yechim && YECHIM_HOLATLARI.includes(q.yechim)) where.solutionStatus = q.yechim;
      if (parseInt(q.passageId)) where.passageId = parseInt(q.passageId);
      if (q.qidiruv) where.text = { contains: String(q.qidiruv).slice(0, 200), mode: 'insensitive' };
      const soni = Math.min(200, Math.max(1, parseInt(q.soni) || 50));
      const sahifa = Math.max(1, parseInt(q.sahifa) || 1);
      const [items, total] = await Promise.all([
        prisma.question.findMany({
          where, orderBy: { id: 'desc' }, skip: (sahifa - 1) * soni, take: soni,
          include: { passage: { select: { id: true, title: true } } },
        }),
        prisma.question.count({ where }),
      ]);
      res.json({ items: items.map(x => ({ ...x, options: savolVariantlari(x), xato: savolXatosi(x) })), total, sahifa, soni });
    } catch (err) { next(err); }
  });

  // Filtrlar va shablon uchun: fanlar, mavzular (turi bo'yicha), manbalar.
  app.get('/api/questions/meta', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const [rows, manbalar] = await Promise.all([
        prisma.question.groupBy({ by: ['subject', 'topic', 'type', 'status'], where: { schoolId: { in: orgIds } }, _count: { _all: true } }),
        prisma.question.groupBy({ by: ['source'], where: { schoolId: { in: orgIds }, source: { not: null } }, _count: { _all: true } }),
      ]);
      const fanlar = new Map();
      const mavzular = new Map();
      let jami = 0;
      for (const r of rows) {
        const n = r._count._all;
        jami += n;
        const fk = r.subject.trim().toLowerCase();
        if (!fanlar.has(fk)) fanlar.set(fk, { nomi: r.subject.trim(), soni: 0, faol: 0 });
        const f = fanlar.get(fk);
        f.soni += n;
        if (r.status === 'faol') f.faol += n;
        const mk = `${fk}|${r.topic.trim().toLowerCase()}`;
        if (!mavzular.has(mk)) mavzular.set(mk, { fan: r.subject.trim(), mavzu: r.topic.trim(), soni: 0, faol: { yopiq: 0, raqamli: 0, yozma: 0 } });
        const m = mavzular.get(mk);
        m.soni += n;
        if (r.status === 'faol') m.faol[turi(r.type)] += n;
      }
      res.json({
        jami,
        fanlar: [...fanlar.values()].sort((a, b) => a.nomi.localeCompare(b.nomi)),
        mavzular: [...mavzular.values()].sort((a, b) => a.fan.localeCompare(b.fan) || a.mavzu.localeCompare(b.mavzu)),
        manbalar: manbalar.map(m => m.source).filter(Boolean).sort(),
      });
    } catch (err) { next(err); }
  });

  app.get('/api/questions/:id', authenticate, async (req, res, next) => {
    try {
      const q = await prisma.question.findUnique({ where: { id: parseInt(req.params.id) }, include: { passage: true } });
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      res.json({ ...q, options: savolVariantlari(q), xato: savolXatosi(q) });
    } catch (err) { next(err); }
  });

  app.post('/api/questions', authenticate, async (req, res, next) => {
    try {
      const schoolId = parseInt(req.body.schoolId) || req.user.schoolId;
      const d = savolMalumoti(req.body);
      d.type = d.type || 'yopiq';
      d.status = d.status || 'faol';
      const xato = savolniTekshir(d);
      if (xato) return res.status(400).json({ error: xato });
      const orgIds = await organizationSchoolIds(req.user);
      if (!(await matnTashkilotdami(d.passageId, orgIds))) return res.status(400).json({ error: 'Matn topilmadi' });
      if (d.imageUrl) d.imageUrl = (await rasmniSaqla(d.imageUrl, 'savol')) ?? null;
      const q = await prisma.question.create({ data: { ...d, text: d.text ?? '', subject: d.subject, topic: d.topic, schoolId, createdById: req.user.id || null } });
      res.status(201).json({ ...q, options: savolVariantlari(q), xato: savolXatosi(q) });
    } catch (err) { next(err); }
  });

  // Excel importi: yaroqlilari yoziladi, yaroqsizlari qator raqami bilan qaytadi.
  app.post('/api/questions/bulk', authenticate, async (req, res, next) => {
    try {
      const { questions } = req.body;
      const schoolId = parseInt(req.body.schoolId) || req.user.schoolId;
      if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: "Savollar ro'yxati bo'sh" });
      if (questions.length > 2000) return res.status(400).json({ error: "Bir martada ko'pi bilan 2000 ta savol" });
      const data = [];
      const xatolar = [];
      questions.forEach((raw, i) => {
        const d = savolMalumoti(raw || {});
        d.type = d.type || 'yopiq';
        d.status = d.status || 'faol';
        const xato = savolniTekshir(d);
        if (xato) { xatolar.push({ qator: raw?.qator ?? i + 1, xato }); return; }
        data.push({ ...d, text: d.text ?? '', schoolId, createdById: req.user.id || null });
      });
      const result = data.length ? await prisma.question.createMany({ data }) : { count: 0 };
      res.status(201).json({ count: result.count, xatolar });
    } catch (err) { next(err); }
  });

  app.put('/api/questions/:id', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const eski = await prisma.question.findUnique({ where: { id } });
      if (!eski) return res.status(404).json({ error: 'Savol topilmadi' });
      const d = savolMalumoti(req.body);
      const xato = savolniTekshir({ ...eski, ...d });
      if (xato) return res.status(400).json({ error: xato });
      const orgIds = await organizationSchoolIds(req.user);
      if (d.passageId && !(await matnTashkilotdami(d.passageId, orgIds))) return res.status(400).json({ error: 'Matn topilmadi' });
      if (typeof d.imageUrl === 'string' && d.imageUrl.startsWith('data:')) {
        const url = await rasmniSaqla(d.imageUrl, 'savol');
        if (url) d.imageUrl = url; else delete d.imageUrl;
      }
      const q = await prisma.question.update({ where: { id }, data: d });
      res.json({ ...q, options: savolVariantlari(q), xato: savolXatosi(q) });
    } catch (err) { next(err); }
  });

  // Imtihonda ishlatilgan savol o'chirilmaydi: variantlar unga murojaat qiladi.
  app.delete('/api/questions/:id', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const q = await prisma.question.findUnique({ where: { id }, select: { usedCount: true } });
      if (!q) return res.status(404).json({ error: 'Savol topilmadi' });
      if (q.usedCount > 0) {
        return res.status(409).json({ error: "Bu savol imtihonda ishlatilgan — o'chirib bo'lmaydi. Holatini «Arxiv» qiling." });
      }
      await prisma.question.delete({ where: { id } });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // --- Matnlar (bir nechta savolga umumiy matn yoki rasm) ---

  app.get('/api/passages', authenticate, async (req, res, next) => {
    try {
      const orgIds = await organizationSchoolIds(req.user);
      const where = { schoolId: { in: orgIds } };
      if (req.query.fan) where.subject = { equals: String(req.query.fan), mode: 'insensitive' };
      const list = await prisma.passage.findMany({ where, orderBy: { id: 'desc' }, include: { _count: { select: { questions: true } } } });
      res.json(list);
    } catch (err) { next(err); }
  });

  app.post('/api/passages', authenticate, async (req, res, next) => {
    try {
      const text = String(req.body.text || '').slice(0, LAVHA_MAX);
      const subject = String(req.body.subject || '').trim().slice(0, 200);
      if (!subject) return res.status(400).json({ error: 'Fanni kiriting' });
      if (!text.trim() && !req.body.imageUrl) return res.status(400).json({ error: 'Matn yoki rasm kerak' });
      const imageUrl = req.body.imageUrl ? (await rasmniSaqla(req.body.imageUrl, 'matn')) ?? null : null;
      const p = await prisma.passage.create({
        data: { text, subject, title: req.body.title ? String(req.body.title).slice(0, 200) : null, imageUrl, schoolId: parseInt(req.body.schoolId) || req.user.schoolId },
      });
      res.status(201).json(p);
    } catch (err) { next(err); }
  });

  app.put('/api/passages/:id', authenticate, async (req, res, next) => {
    try {
      const d = {};
      if (req.body.text !== undefined) d.text = String(req.body.text || '').slice(0, LAVHA_MAX);
      if (req.body.title !== undefined) d.title = req.body.title ? String(req.body.title).slice(0, 200) : null;
      if (req.body.subject !== undefined) d.subject = String(req.body.subject || '').trim().slice(0, 200);
      if (req.body.imageUrl !== undefined) {
        const v = req.body.imageUrl;
        d.imageUrl = !v ? null : String(v).startsWith('data:') ? (await rasmniSaqla(v, 'matn')) ?? undefined : v;
        if (d.imageUrl === undefined) delete d.imageUrl;
      }
      res.json(await prisma.passage.update({ where: { id: parseInt(req.params.id) }, data: d }));
    } catch (err) { next(err); }
  });

  app.delete('/api/passages/:id', authenticate, async (req, res, next) => {
    try {
      await prisma.passage.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ============================ Imtihonlar ============================

  app.get('/api/exams', authenticate, async (req, res, next) => {
    try {
      const ids = await korinadiganFiliallar(req);
      const exams = await prisma.exam.findMany({
        where: { OR: [{ schoolId: { in: ids } }, { branchIds: { hasSome: ids } }] },
        include: { _count: { select: { results: true, seats: true, assignments: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(exams.map(e => imtihonJavobi(e, req)));
    } catch (err) { next(err); }
  });

  app.get('/api/exams/:id', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({
        where: { id },
        include: {
          _count: { select: { results: true, seats: true } },
          assignments: { include: { group: { select: { id: true, name: true, schoolId: true } } } },
          examVariants: { select: { session: true, code: true } },
        },
      });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      res.json({
        ...imtihonJavobi(e, req),
        variantlar: e.examVariants.map(v => ({ session: v.session, code: v.code })).sort((a, b) => a.session - b.session || a.code.localeCompare(b.code)),
      });
    } catch (err) { next(err); }
  });

  async function imtihonMalumoti(req, eski) {
    const b = req.body;
    const d = {};
    if (b.name !== undefined) {
      d.name = String(b.name || '').trim().slice(0, 200);
      if (!d.name) throw Object.assign(new Error('Imtihon nomini kiriting'), { status: 400 });
    }
    if (b.date !== undefined) d.date = String(b.date || '').slice(0, 20);
    if (b.duration !== undefined) d.duration = Math.min(600, Math.max(1, parseInt(b.duration) || 60));
    const qulf = !!eski?.lockedAt;
    if (!qulf) {
      if (b.blocks !== undefined) d.blocks = blokniTozala(b.blocks);
      if (b.scoring !== undefined) d.scoring = b.scoring === 'foiz' ? 'foiz' : 'blok';
      if (b.branchIds !== undefined) {
        const ruxsat = await allowedSchoolIds(req.user);
        d.branchIds = [...new Set((Array.isArray(b.branchIds) ? b.branchIds : []).map(Number))].filter(id => ruxsat.includes(id));
      }
    }
    if (b.settings !== undefined) {
      const joriy = sozlamaniTozala(eski?.settings);
      const kelgan = b.settings && typeof b.settings === 'object' ? b.settings : {};
      let yangi;
      if (!qulf) {
        yangi = sozlamaniTozala({ ...joriy, ...kelgan });
      } else {
        // Qulflangan imtihonda variantlarga ta'sir qilmaydigan sozlamalargina o'zgaradi.
        const ruxsatli = ['notify', 'ranking', 'topN', 'showQuestionsAfter', 'seatMode', 'sessionFill', 'roomIds', 'variantBubble'];
        const qism = Object.fromEntries(Object.entries(kelgan).filter(([k]) => ruxsatli.includes(k)));
        if (Array.isArray(kelgan.sessions) && kelgan.sessions.length === joriy.sessions.length) qism.sessions = kelgan.sessions;
        yangi = sozlamaniTozala({ ...joriy, ...qism });
      }
      // Kalit va bekor qilingan savollar faqat /key orqali o'zgaradi.
      yangi.cancelled = joriy.cancelled;
      yangi.keyFix = joriy.keyFix;
      yangi.optionCount = joriy.optionCount;
      d.settings = yangi;
    }
    const blocks = d.blocks ?? eski?.blocks;
    const scoring = d.scoring ?? eski?.scoring ?? 'blok';
    if (d.blocks !== undefined || d.scoring !== undefined) {
      const t = varaqTuzilmasi(blocks, scoring);
      d.totalQuestions = t.jami;
      d.maxScore = t.maks;
    }
    return d;
  }

  app.post('/api/exams', authenticate, async (req, res, next) => {
    try {
      const schoolId = parseInt(req.body.schoolId);
      if (!schoolId) return res.status(400).json({ error: 'Filial tanlanmagan' });
      const d = await imtihonMalumoti({ ...req, body: { settings: {}, ...req.body } }, null);
      if (!d.name || !d.date) return res.status(400).json({ error: 'Nomi va sanasi kerak' });
      if (!d.blocks?.length || !d.totalQuestions) return res.status(400).json({ error: "Kamida bitta fan va savol qoidasi kerak" });
      const e = await prisma.exam.create({
        data: { ...d, duration: d.duration || 60, status: IMTIHON_HOLATLARI.QORALAMA, schoolId, branchIds: d.branchIds || [] },
      });
      res.status(201).json(imtihonJavobi(e, req));
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  app.put('/api/exams/:id', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const eski = await prisma.exam.findUnique({ where: { id } });
      if (!eski) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const d = await imtihonMalumoti(req, eski);
      if (d.blocks && !d.totalQuestions) return res.status(400).json({ error: "Kamida bitta savol qoidasi kerak" });
      const e = await prisma.exam.update({ where: { id }, data: d });
      res.json(imtihonJavobi(e, req));
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  app.delete('/api/exams/:id', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const sahifalar = await prisma.examResult.findMany({ where: { examId: id }, select: { pages: true } });
      await prisma.exam.delete({ where: { id } });
      await rasmlarniTozala(sahifalar.flatMap(r => rasmNomlari(r.pages)));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // O'tgan oyning imtihonidan nusxa: tuzilma, sozlama va kurslar. Kalit
  // tuzatishlari, variantlar, o'rinlar va natijalar ko'chmaydi.
  app.post('/api/exams/:id/copy', authenticate, async (req, res, next) => {
    try {
      const eski = await prisma.exam.findUnique({ where: { id: parseInt(req.params.id) }, include: { assignments: true } });
      if (!eski) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const s = sozlamaniTozala(eski.settings);
      s.cancelled = {};
      s.keyFix = {};
      const e = await prisma.exam.create({
        data: {
          name: `${eski.name} (nusxa)`.slice(0, 200), date: eski.date, duration: eski.duration,
          status: IMTIHON_HOLATLARI.QORALAMA, blocks: eski.blocks, totalQuestions: eski.totalQuestions,
          maxScore: eski.maxScore, scoring: eski.scoring, branchIds: eski.branchIds, settings: s, schoolId: eski.schoolId,
        },
      });
      if (eski.assignments.length) {
        await prisma.examAssignment.createMany({
          data: eski.assignments.map(a => ({ examId: e.id, groupId: a.groupId, schoolId: a.schoolId })),
          skipDuplicates: true,
        });
      }
      res.status(201).json(imtihonJavobi(e, req));
    } catch (err) { next(err); }
  });

  // --- Kurslar ---

  app.get('/api/exams/:id/assignments', authenticate, async (req, res, next) => {
    try {
      const assignments = await prisma.examAssignment.findMany({
        where: { examId: parseInt(req.params.id) },
        include: { group: { select: { id: true, name: true, schoolId: true } } },
      });
      res.json(assignments);
    } catch (err) { next(err); }
  });

  app.post('/api/exams/:id/assignments', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId }, select: { schoolId: true, branchIds: true } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const ids = (Array.isArray(req.body.groupIds) ? req.body.groupIds : []).map(Number).filter(Number.isInteger);
      if (!ids.length) return res.status(400).json({ error: 'Kurs tanlanmagan' });
      const filiallar = imtihonFiliallari(e);
      const groups = await prisma.group.findMany({ where: { id: { in: ids }, schoolId: { in: filiallar } }, select: { id: true, schoolId: true } });
      if (groups.length !== ids.length) return res.status(400).json({ error: "Kurs imtihonga qatnashadigan filialda emas" });
      await prisma.examAssignment.createMany({
        data: groups.map(g => ({ examId, groupId: g.id, schoolId: g.schoolId })),
        skipDuplicates: true,
      });
      res.status(201).json(await prisma.examAssignment.findMany({ where: { examId }, include: { group: { select: { id: true, name: true, schoolId: true } } } }));
    } catch (err) { next(err); }
  });

  app.delete('/api/exams/:id/assignments/:groupId', authenticate, async (req, res, next) => {
    try {
      await prisma.examAssignment.deleteMany({ where: { examId: parseInt(req.params.id), groupId: parseInt(req.params.groupId) } });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // --- Bank va variantlar ---

  app.get('/api/exams/:id/check', authenticate, async (req, res, next) => {
    try {
      const e = await prisma.exam.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const orgIds = await organizationSchoolIds(req.user);
      const bank = await prisma.question.findMany({ where: { schoolId: { in: orgIds }, status: 'faol' }, select: BANK_SELECT });
      res.json({ bloklar: bankYetarliligi({ blocks: e.blocks, settings: e.settings, bank }) });
    } catch (err) { next(err); }
  });

  // Savollarni qulflash: bankdan tanlanadi, variantlar yasaladi, kalit shu
  // yerda saqlanadi. Shundan keyin tuzilma o'zgarmaydi (natija yo'q bo'lsa
  // qulfni ochish mumkin).
  app.post('/api/exams/:id/lock', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (e.lockedAt) return res.status(409).json({ error: 'Savollar allaqachon qulflangan' });
      const tuzilma = varaqTuzilmasi(e.blocks, e.scoring);
      if (!tuzilma.jami) return res.status(400).json({ error: "Imtihonda savol qoidasi yo'q" });

      const orgIds = await organizationSchoolIds(req.user);
      const bank = await prisma.question.findMany({ where: { schoolId: { in: orgIds }, status: 'faol' }, select: BANK_SELECT });
      const seed = e.seed ?? crypto.randomInt(1, 2 ** 31 - 1);
      const r = variantlarniYasash({ blocks: e.blocks, scoring: e.scoring, settings: e.settings, seed, bank });
      if (r.kamchiliklar.length) {
        return res.status(400).json({ error: 'Savollar banki yetmaydi', kamchiliklar: r.kamchiliklar, ogohlantirishlar: r.ogohlantirishlar });
      }
      const s = sozlamaniTozala(e.settings);
      s.optionCount = r.optionCount;
      const hozir = new Date();
      await prisma.$transaction([
        prisma.examVariant.deleteMany({ where: { examId: id } }),
        prisma.examVariant.createMany({ data: r.variants.map(v => ({ examId: id, session: v.session, code: v.code, items: v.items })) }),
        prisma.exam.update({
          where: { id },
          data: { lockedAt: hozir, status: IMTIHON_HOLATLARI.TAYYOR, seed, settings: s, totalQuestions: tuzilma.jami, maxScore: tuzilma.maks },
        }),
        prisma.question.updateMany({ where: { id: { in: r.ishlatilgan } }, data: { usedCount: { increment: 1 }, lastUsedAt: hozir } }),
      ]);
      // O'rinlar oldin tuzilgan bo'lsa — variant soni o'zgargan bo'lishi mumkin.
      await orinVariantlariniYangila(id, s.variantCount);
      const yangi = await prisma.exam.findUnique({ where: { id } });
      res.json({ exam: imtihonJavobi(yangi, req), ogohlantirishlar: r.ogohlantirishlar, variantlar: r.variants.length });
    } catch (err) { next(err); }
  });

  async function orinVariantlariniYangila(examId, variantCount) {
    const seats = await prisma.examSeat.findMany({ where: { examId, row: { not: null }, col: { not: null } }, select: { id: true, row: true, col: true, variant: true } });
    const guruh = new Map();
    for (const s of seats) {
      const v = orinVarianti(s.row, s.col, variantCount);
      if (v === s.variant) continue;
      if (!guruh.has(v)) guruh.set(v, []);
      guruh.get(v).push(s.id);
    }
    for (const [variant, ids] of guruh) await prisma.examSeat.updateMany({ where: { id: { in: ids } }, data: { variant } });
  }

  app.post('/api/exams/:id/unlock', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id }, include: { _count: { select: { results: true } }, examVariants: { select: { items: true } } } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (!e.lockedAt) return res.json({ exam: imtihonJavobi(e, req) });
      if (e._count.results > 0) return res.status(409).json({ error: "Natijalar kiritilgan — qulfni ochib bo'lmaydi" });
      const qids = [...new Set(e.examVariants.flatMap(v => (v.items || []).map(it => it.q)))];
      await prisma.$transaction([
        prisma.examVariant.deleteMany({ where: { examId: id } }),
        prisma.exam.update({ where: { id }, data: { lockedAt: null, status: IMTIHON_HOLATLARI.QORALAMA } }),
        prisma.question.updateMany({ where: { id: { in: qids }, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } }),
      ]);
      res.json({ exam: imtihonJavobi(await prisma.exam.findUnique({ where: { id } }), req) });
    } catch (err) { next(err); }
  });

  // Kitobcha chop etish uchun: variantlar kalitsiz (javoblar tartibi bor,
  // qaysi biri to'g'ri ekani yo'q) va savollar matni.
  app.get('/api/exams/:id/booklets', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const session = parseInt(req.query.session);
      const variants = await prisma.examVariant.findMany({
        where: { examId, ...(session ? { session } : {}) },
        orderBy: [{ session: 'asc' }, { code: 'asc' }],
      });
      const qids = [...new Set(variants.flatMap(v => v.items.map(it => it.q)))];
      const savollar = await prisma.question.findMany({
        where: { id: { in: qids } },
        select: { id: true, text: true, imageUrl: true, type: true, options: true, optionA: true, optionB: true, optionC: true, optionD: true, passageId: true, points: true },
      });
      const pids = [...new Set(savollar.map(q => q.passageId).filter(Boolean))];
      const matnlar = pids.length ? await prisma.passage.findMany({ where: { id: { in: pids } } }) : [];
      res.json({
        variants: variants.map(v => ({
          session: v.session, code: v.code,
          // eslint-disable-next-line no-unused-vars
          items: v.items.map(({ k, j, ...qolgan }) => qolgan),
        })),
        savollar: savollar.map(q => ({ id: q.id, text: q.text, imageUrl: q.imageUrl, type: q.type, options: savolVariantlari(q), passageId: q.passageId })),
        matnlar,
      });
    } catch (err) { next(err); }
  });

  // Kalit jadvali: har variantdagi to'g'ri javob, savolning fani/mavzusi.
  app.get('/api/exams/:id/key', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId }, select: { settings: true } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const variants = await prisma.examVariant.findMany({ where: { examId }, orderBy: [{ session: 'asc' }, { code: 'asc' }] });
      const qids = [...new Set(variants.flatMap(v => v.items.map(it => it.q)))];
      const savollar = await prisma.question.findMany({
        where: { id: { in: qids } },
        select: { id: true, text: true, subject: true, topic: true, type: true, correctAnswer: true, answers: true, options: true, optionA: true, optionB: true, optionC: true, optionD: true },
      });
      const s = sozlamaniTozala(e.settings);
      res.json({
        variants: variants.map(v => ({
          session: v.session, code: v.code,
          items: v.items.map(it => ({ n: it.n, q: it.q, t: it.t, b: it.b, p: it.p, javob: it.t === 'yopiq' ? HARFLAR[it.k] : it.t === 'raqamli' ? it.j : null, m: it.m })),
        })),
        savollar: savollar.map(q => ({ id: q.id, text: q.text, subject: q.subject, topic: q.topic, type: q.type, correctAnswer: q.correctAnswer, answers: q.answers, options: savolVariantlari(q) })),
        cancelled: s.cancelled,
        keyFix: s.keyFix,
      });
    } catch (err) { next(err); }
  });

  // Kalitni tuzatish va savolni bekor qilish — hamma natija darhol qayta hisoblanadi.
  app.put('/api/exams/:id/key', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const joriy = sozlamaniTozala(e.settings);
      const yangi = sozlamaniTozala({
        ...joriy,
        cancelled: req.body.cancelled !== undefined ? req.body.cancelled : joriy.cancelled,
        keyFix: req.body.keyFix !== undefined ? req.body.keyFix : joriy.keyFix,
      });
      const yangilangan = await prisma.exam.update({ where: { id }, data: { settings: yangi } });
      const soni = await hammasiniQaytaHisobla(yangilangan);
      res.json({ cancelled: yangi.cancelled, keyFix: yangi.keyFix, qaytaHisoblandi: soni });
    } catch (err) { next(err); }
  });

  // ============================ O'rinlar ============================

  async function qatnashchilarniYigish(e) {
    const filiallar = imtihonFiliallari(e);
    const assignments = await prisma.examAssignment.findMany({ where: { examId: e.id }, select: { groupId: true }, orderBy: { id: 'asc' } });
    const gids = assignments.map(a => a.groupId);
    const groups = await prisma.group.findMany({
      where: { id: { in: gids }, schoolId: { in: filiallar } },
      select: {
        id: true, name: true, schoolId: true,
        students: { where: { status: { in: ['Faol', 'Sinov'] }, attendsExam: true }, select: { id: true, name: true } },
      },
    });
    groups.sort((a, b) => gids.indexOf(a.id) - gids.indexOf(b.id));
    const oquvchilar = new Map();
    for (const g of groups) {
      for (const s of g.students) {
        if (!oquvchilar.has(s.id)) oquvchilar.set(s.id, { studentId: s.id, name: s.name, schoolId: g.schoolId, groupId: g.id });
      }
    }
    return { filiallar, groups, oquvchilar };
  }

  // O'rinlashtirishdan oldin: kim qatnashadi va xonalar yetadimi.
  app.get('/api/exams/:id/participants', authenticate, async (req, res, next) => {
    try {
      const e = await prisma.exam.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const { filiallar, groups, oquvchilar } = await qatnashchilarniYigish(e);
      const mehmonlar = await prisma.examSeat.count({ where: { examId: e.id, studentId: null } });
      const xonalar = await prisma.room.findMany({ where: { schoolId: { in: filiallar } }, orderBy: { name: 'asc' } });
      res.json({
        filiallar,
        kurslar: groups.map(g => ({ id: g.id, name: g.name, schoolId: g.schoolId, soni: g.students.length })),
        oquvchilar: oquvchilar.size,
        mehmonlar,
        xonalar,
      });
    } catch (err) { next(err); }
  });

  app.post('/api/exams/:id/seating', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId }, include: { _count: { select: { results: true } } } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (e._count.results > 0) return res.status(409).json({ error: "Natijalar kiritilgan — qayta o'rinlashtirib bo'lmaydi" });
      const s = sozlamaniTozala(e.settings);
      const { filiallar, oquvchilar } = await qatnashchilarniYigish(e);
      const eski = await prisma.examSeat.findMany({ where: { examId } });
      const eskiOquvchi = new Map(eski.filter(x => x.studentId).map(x => [x.studentId, x]));
      const mehmonlar = eski.filter(x => !x.studentId);

      const qatnashchilar = [
        ...[...oquvchilar.values()].map(p => ({ ...p, seatId: eskiOquvchi.get(p.studentId)?.id })),
        ...mehmonlar.map(m => ({ seatId: m.id, guestName: m.guestName, schoolId: m.schoolId, groupId: null })),
      ];
      const xonalar = await prisma.room.findMany({ where: { schoolId: { in: filiallar } } });
      const { seats, sigmadi } = orinlashtirish({ qatnashchilar, xonalar, settings: s });

      const amallar = [];
      const yangilar = [];
      const joy = (x, o) => ({
        schoolId: x.schoolId, groupId: x.groupId ?? null,
        session: o?.session ?? 1, roomId: o?.roomId ?? null, row: o?.row ?? null, col: o?.col ?? null, variant: o?.variant ?? null,
      });
      for (const o of seats) {
        if (o.seatId) amallar.push(prisma.examSeat.update({ where: { id: o.seatId }, data: joy(o, o) }));
        else yangilar.push({ examId, studentId: o.studentId, sheetCode: varaqKodi(), status: 'rejada', ...joy(o, o) });
      }
      for (const p of sigmadi) {
        if (p.seatId) amallar.push(prisma.examSeat.update({ where: { id: p.seatId }, data: joy(p, null) }));
        else yangilar.push({ examId, studentId: p.studentId, sheetCode: varaqKodi(), status: 'rejada', ...joy(p, null) });
      }
      // Kursdan chiqqan yoki "imtihonga kelmaydi" bo'lgan o'quvchining o'rni bo'shaydi.
      const qolmaydi = eski.filter(x => x.studentId && !oquvchilar.has(x.studentId)).map(x => x.id);
      if (qolmaydi.length) amallar.push(prisma.examSeat.deleteMany({ where: { id: { in: qolmaydi } } }));
      for (let i = 0; i < amallar.length; i += 100) await prisma.$transaction(amallar.slice(i, i + 100));
      if (yangilar.length) await prisma.examSeat.createMany({ data: yangilar });

      res.json({
        joylashdi: seats.length,
        sigmadi: sigmadi.map(p => p.name || p.guestName || `#${p.studentId}`),
        olibTashlandi: qolmaydi.length,
      });
    } catch (err) { next(err); }
  });

  app.get('/api/exams/:id/seats', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const filiallar = await allowedSchoolIds(req.user);
      const where = { examId, schoolId: { in: filiallar } };
      if (req.ruxsat?.faqatOz) where.studentId = { in: [...(await ozKurslari(req.user)).studentIds] };
      const seats = await prisma.examSeat.findMany({
        where,
        include: {
          student: { select: { id: true, name: true, photo: true, phone: true } },
          results: { select: { id: true, reviewStatus: true, score: true } },
        },
        orderBy: [{ session: 'asc' }, { roomId: 'asc' }, { row: 'asc' }, { col: 'asc' }, { id: 'asc' }],
      });
      const roomIds = [...new Set(seats.map(s => s.roomId).filter(Boolean))];
      const groupIds = [...new Set(seats.map(s => s.groupId).filter(Boolean))];
      const [rooms, groups] = await Promise.all([
        prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, name: true, rows: true, cols: true, capacity: true, blocked: true, schoolId: true } }),
        prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }),
      ]);
      const roomMap = new Map(rooms.map(r => [r.id, r]));
      const groupMap = new Map(groups.map(g => [g.id, g.name]));
      res.json({
        seats: seats.map(s => ({
          id: s.id, studentId: s.studentId, name: s.student?.name || s.guestName || '', photo: s.student?.photo || null,
          phone: s.student?.phone || s.guestPhone || null, mehmon: !s.studentId, schoolId: s.schoolId,
          groupId: s.groupId, groupName: s.groupId ? groupMap.get(s.groupId) || '' : '',
          session: s.session, roomId: s.roomId, roomName: s.roomId ? roomMap.get(s.roomId)?.name || '' : '',
          row: s.row, col: s.col, variant: s.variant, sheetCode: s.sheetCode, status: s.status,
          admitSentAt: s.admitSentAt, admitStatus: s.admitStatus, leadId: s.leadId,
          resultId: s.results[0]?.id ?? null, reviewStatus: s.results[0]?.reviewStatus ?? null, score: s.results[0]?.score ?? null,
        })),
        rooms,
      });
    } catch (err) { next(err); }
  });

  // Tashqi qatnashchi: markazda o'qimaydi, varaqqa ismi va telefoni yoziladi.
  app.post('/api/exams/:id/guests', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId }, select: { schoolId: true, branchIds: true } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const royxat = Array.isArray(req.body.guests) ? req.body.guests : [req.body];
      const filiallar = imtihonFiliallari(e);
      const data = [];
      for (const g of royxat.slice(0, 500)) {
        const name = String(g?.name || '').trim().slice(0, 120);
        if (!name) continue;
        const schoolId = parseInt(g?.schoolId) || e.schoolId;
        if (!filiallar.includes(schoolId) || !(await canAccessSchool(req.user, schoolId))) {
          return res.status(403).json({ error: "Bu filialga qatnashchi qo'sha olmaysiz" });
        }
        data.push({ examId, schoolId, guestName: name, guestPhone: g?.phone ? String(g.phone).slice(0, 30) : null, sheetCode: varaqKodi(), status: 'rejada' });
      }
      if (!data.length) return res.status(400).json({ error: 'Qatnashchi ismini kiriting' });
      await prisma.examSeat.createMany({ data });
      res.status(201).json({ qoshildi: data.length });
    } catch (err) { next(err); }
  });

  // Tashqi qatnashchilar → lidlar (sotuv bo'limi qo'ng'iroq qiladi). Telefoni
  // shu markazdagi lidda bor bo'lsa — yangisi ochilmaydi, o'sha lidga imtihon
  // izohi qo'shiladi. Lid manbasi — "Imtihon", izohda natija.
  app.post('/api/exams/:id/guests/leads', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, name: true, date: true, maxScore: true, blocks: true, publishedAt: true } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const where = { examId, studentId: null, leadId: null };
      if (Array.isArray(req.body.seatIds) && req.body.seatIds.length) where.id = { in: req.body.seatIds.map(Number).filter(Number.isInteger) };
      const seats = await prisma.examSeat.findMany({
        where,
        include: { results: { select: { score: true, percentage: true, rank: true, raschScore: true, grade: true } } },
        orderBy: { id: 'asc' },
      });
      const fanlar = [...new Set((Array.isArray(e.blocks) ? e.blocks : []).map(b => b?.subject).filter(Boolean))].join(', ').slice(0, 120) || 'Imtihon';
      let yaratildi = 0, bor = 0, telefonsiz = 0;
      for (const o of seats) {
        if (!(await canAccessSchool(req.user, o.schoolId))) continue;
        const raqam = String(o.guestPhone || '').replace(/\D/g, '');
        if (raqam.length < 9) { telefonsiz++; continue; }
        const r = o.results[0];
        // Natija e'londan oldin sotuvga bermaymiz — tekshirilmagan ball bo'lishi mumkin.
        const izoh = `Imtihon: ${e.name} (${sanaMatni(e.date)})` + (r && e.publishedAt
          ? ` — ${vergul(r.score)} / ${vergul(e.maxScore)} ball, ${vergul(r.percentage)}%${r.raschScore != null ? `, Rasch ${vergul(r.raschScore)}${r.grade ? ` (${r.grade})` : ''}` : ''}${r.rank ? `, ${r.rank}-o'rin` : ''}`
          : '');
        const qardosh = await organizationSchoolIds({ schoolId: o.schoolId });
        const mavjud = await prisma.lead.findFirst({ where: { schoolId: { in: qardosh }, phone: { contains: raqam.slice(-9) } }, select: { id: true, notes: true } });
        if (mavjud) {
          await prisma.$transaction([
            prisma.lead.update({ where: { id: mavjud.id }, data: { notes: [mavjud.notes, izoh].filter(Boolean).join('\n').slice(0, 4000) } }),
            prisma.examSeat.update({ where: { id: o.id }, data: { leadId: mavjud.id } }),
          ]);
          bor++;
          continue;
        }
        const lead = await prisma.lead.create({
          data: { name: o.guestName || 'Nomsiz', phone: String(o.guestPhone).trim(), course: fanlar, source: 'Imtihon', status: 'Yangi', notes: izoh, schoolId: o.schoolId },
        });
        await prisma.examSeat.update({ where: { id: o.id }, data: { leadId: lead.id } });
        yaratildi++;
      }
      res.json({ yaratildi, bor, telefonsiz });
    } catch (err) { next(err); }
  });

  // O'rinni ko'chirish (band o'ringa — `almashtir: true` bilan joy almashadi)
  // yoki keldi/kelmadi belgisi. Variant o'ringa bog'liq: ko'chgan qatnashchi
  // yangi o'rnining variantini oladi (qo'shnilar bilan bir xil bo'lmasin).
  app.put('/api/exams/:id/seats/:seatId', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const seatId = parseInt(req.params.seatId);
      const seat = await prisma.examSeat.findFirst({ where: { id: seatId, examId }, include: { _count: { select: { results: true } } } });
      if (!seat) return res.status(404).json({ error: "O'rin topilmadi" });
      if (!(await canAccessSchool(req.user, seat.schoolId))) return res.status(403).json({ error: "Bu filialga ruxsatingiz yo'q" });
      const d = {};
      let juft = null;
      if (req.body.status !== undefined) {
        if (!['rejada', 'keldi', 'kelmadi'].includes(req.body.status)) return res.status(400).json({ error: "Holat noto'g'ri" });
        d.status = req.body.status;
      }
      if (req.body.guestName !== undefined && !seat.studentId) d.guestName = String(req.body.guestName || '').trim().slice(0, 120) || seat.guestName;
      if (req.body.guestPhone !== undefined && !seat.studentId) d.guestPhone = req.body.guestPhone ? String(req.body.guestPhone).slice(0, 30) : null;
      if (req.body.roomId !== undefined || req.body.row !== undefined || req.body.col !== undefined || req.body.session !== undefined) {
        // Keldi/kelmadi belgisini natija xodimi ham qo'yadi, o'rinni esa faqat imtihon tuzuvchi.
        if (!kor(req, 'imtihonlar.imtihon', 2)) return res.status(403).json({ error: "O'rinni o'zgartirishga ruxsatingiz yo'q" });
        if (seat._count.results > 0) return res.status(409).json({ error: "Natijasi bor qatnashchini ko'chirib bo'lmaydi" });
        const e = await prisma.exam.findUnique({ where: { id: examId }, select: { settings: true, schoolId: true, branchIds: true } });
        const s = sozlamaniTozala(e.settings);
        const session = parseInt(req.body.session ?? seat.session) || 1;
        const roomId = req.body.roomId === null ? null : parseInt(req.body.roomId ?? seat.roomId) || null;
        const row = roomId ? parseInt(req.body.row ?? seat.row) : null;
        const col = roomId ? parseInt(req.body.col ?? seat.col) : null;
        if (!s.sessions.some(x => x.id === session)) return res.status(400).json({ error: 'Smena topilmadi' });
        if (roomId) {
          if (!(row >= 0 && col >= 0)) return res.status(400).json({ error: "Qator va o'rinni kiriting" });
          const room = await prisma.room.findUnique({ where: { id: roomId } });
          if (!room || !imtihonFiliallari(e).includes(room.schoolId)) return res.status(400).json({ error: 'Xona topilmadi' });
          // Shaxmat tartibi faqat avtomatik taqsimotga: qo'lda istalgan ishlaydigan o'rin.
          if (!xonaOrinlari(room, 'hammasi').some(j => j.row === row && j.col === col)) return res.status(400).json({ error: "Bu o'rin xona sxemasida yo'q yoki yopilgan" });
          const band = await prisma.examSeat.findFirst({
            where: { examId, session, roomId, row, col, NOT: { id: seatId } },
            include: { student: { select: { name: true } }, _count: { select: { results: true } } },
          });
          if (band) {
            const ism = band.student?.name || band.guestName || '';
            if (!req.body.almashtir) return res.status(409).json({ error: `Bu o'rinda ${ism} o'tiribdi`, band: { id: band.id, name: ism } });
            if (band._count.results > 0) return res.status(409).json({ error: `${ism}ning natijasi bor — uni ko'chirib bo'lmaydi` });
            // Joy almashish: band o'rindagi qatnashchi bu qatnashchining eski o'rniga o'tadi.
            juft = {
              id: band.id,
              data: {
                session: seat.session, roomId: seat.roomId, row: seat.row, col: seat.col,
                variant: seat.roomId != null && seat.row != null && seat.col != null ? orinVarianti(seat.row, seat.col, s.variantCount) : null,
                // Ruxsatnomasi eski o'rin bilan ketgan bo'lsa — yangisi qayta yuboriladi.
                ...(band.admitSentAt ? { admitSentAt: null, admitStatus: 'yangilanadi' } : {}),
              },
            };
          }
        }
        Object.assign(d, { session, roomId, row, col, variant: roomId ? orinVarianti(row, col, s.variantCount) : null });
        if (seat.admitSentAt) Object.assign(d, { admitSentAt: null, admitStatus: 'yangilanadi' });
      }
      if (juft) {
        const [yangi] = await prisma.$transaction([
          prisma.examSeat.update({ where: { id: seatId }, data: d }),
          prisma.examSeat.update({ where: { id: juft.id }, data: juft.data }),
        ]);
        return res.json({ ...yangi, almashdi: juft.id });
      }
      const yangi = await prisma.examSeat.update({ where: { id: seatId }, data: d });
      res.json(yangi);
    } catch (err) { next(err); }
  });

  app.delete('/api/exams/:id/seats/:seatId', authenticate, async (req, res, next) => {
    try {
      const seatId = parseInt(req.params.seatId);
      const seat = await prisma.examSeat.findFirst({ where: { id: seatId, examId: parseInt(req.params.id) }, include: { _count: { select: { results: true } } } });
      if (!seat) return res.status(404).json({ error: "O'rin topilmadi" });
      if (seat._count.results > 0) return res.status(409).json({ error: "Bu qatnashchining natijasi bor — avval natijani o'chiring" });
      await prisma.examSeat.delete({ where: { id: seatId } });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // Ruxsatnoma — qo'lda: bir so'rovda `limit` tagacha, mijoz `qoldi` 0
  // bo'lguncha qayta chaqiradi. `qayta: true` — hammasiga boshidan yuborish.
  app.post('/api/exams/:id/admit-cards', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, settings: true, publishedAt: true } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (sozlamaniTozala(e.settings).admit.channel === 'NONE') return res.status(409).json({ error: "Ruxsatnoma kanali: «Yubormaslik» — imtihon sozlamasida o'zgartiring" });
      if (req.body.qayta === true) await prisma.examSeat.updateMany({ where: { examId }, data: { admitSentAt: null, admitStatus: null } });
      const limit = Math.min(30, Math.max(1, parseInt(req.body.limit) || 10));
      res.json(await ruxsatnomalarniYubor(examId, { limit, muddat: Date.now() + 25000 }));
    } catch (err) { next(err); }
  });

  // ============================ Skaner ============================

  // Bitta varaq sahifasining o'qilgan javoblari. Varaq kodi (QR) bo'yicha
  // o'rin topiladi; universal varaqda — o'quvchi id si bo'yicha. Operator
  // oldin tasdiqlagan javoblar (manual) qayta skan bilan o'zgarmaydi.
  app.post('/api/exams/:id/scans', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const b = req.body;
      const page = Math.max(1, parseInt(b.page) || 1);
      // Skaner varaqlarni ketma-ket yuboradi: mustaqil so'rovlar parallel.
      const seatInclude = { student: { select: { name: true } } };
      const [e, kodliOrin] = await Promise.all([
        prisma.exam.findUnique({ where: { id: examId } }),
        b.sheetCode ? prisma.examSeat.findFirst({ where: { examId, sheetCode: String(b.sheetCode).trim().toUpperCase() }, include: seatInclude }) : null,
      ]);
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (!e.lockedAt) return res.status(409).json({ error: 'Imtihon savollari hali qulflanmagan' });
      const s = sozlamaniTozala(e.settings);

      let seat = kodliOrin;
      if (b.sheetCode) {
        if (!seat) return res.status(404).json({ error: 'Varaq kodi bu imtihonga tegishli emas' });
      } else if (parseInt(b.studentId)) {
        const studentId = parseInt(b.studentId);
        seat = await prisma.examSeat.findFirst({ where: { examId, studentId }, include: seatInclude });
        if (!seat) {
          const st = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
          if (!st || !imtihonFiliallari(e).includes(st.schoolId)) return res.status(404).json({ error: "O'quvchi topilmadi yoki bu imtihon filialida emas" });
          const session = s.sessions.some(x => x.id === parseInt(b.session)) ? parseInt(b.session) : 1;
          seat = await prisma.examSeat.create({ data: { examId, studentId, schoolId: st.schoolId, session, sheetCode: varaqKodi(), status: 'keldi' }, include: seatInclude });
        }
      } else {
        return res.status(400).json({ error: "Varaq kodi yoki o'quvchi kerak" });
      }
      if (!(await canAccessSchool(req.user, seat.schoolId))) return res.status(403).json({ error: "Bu filial varag'iga ruxsatingiz yo'q" });

      const tuzilma = varaqTuzilmasi(e.blocks, e.scoring);
      const tur = new Map(tuzilma.savollar.map(x => [x.n, x.tur]));
      const answers = {};
      for (const [k, v] of Object.entries(b.answers && typeof b.answers === 'object' ? b.answers : {})) {
        const n = parseInt(k);
        if (!tur.has(n) || tur.get(n) === 'yozma') continue;
        answers[n] = String(v ?? '').slice(0, 12);
      }
      const sahifaSavollari = new Set([...Object.keys(answers).map(Number), ...(Array.isArray(b.pageItems) ? b.pageItems.map(Number) : [])]);
      const yangiFlags = (Array.isArray(b.flags) ? b.flags : [])
        .map(f => ({ n: parseInt(f?.n), sabab: String(f?.sabab || '').slice(0, 120), ...(Array.isArray(f?.f) ? { f: f.f.slice(0, 20).map(Number) } : {}) }))
        .filter(f => f.n > 0 && tur.has(f.n));

      let variant = seat.variant;
      const bubbled = VARIANT_KODLARI.slice(0, s.variantCount).includes(String(b.variant || '').toUpperCase()) ? String(b.variant).toUpperCase() : null;
      if (bubbled && bubbled !== variant) {
        if (variant) yangiFlags.push({ n: 0, sabab: `Varaqda ${bubbled} variant bo'yalgan, o'rindagi variant ${variant}` });
        variant = bubbled;
      }
      if (!variant) yangiFlags.push({ n: 0, sabab: 'Variant aniqlanmadi' });

      const variantOl = code => (code ? prisma.examVariant.findFirst({ where: { examId, session: seat.session, code }, select: { items: true } }) : null);
      const [oldingi, taxminiy, url] = await Promise.all([
        prisma.examResult.findFirst({ where: { examId, seatId: seat.id } }),
        variantOl(variant),
        typeof b.image === 'string' && b.image.startsWith('data:image/') ? rasmniSaqla(b.image, `imtihon_${examId}_${seat.id}_${page}`) : null,
      ]);
      const raw = { ...(oldingi?.raw || {}), ...answers };
      const flags = [
        ...(Array.isArray(oldingi?.flags) ? oldingi.flags : []).filter(f => f.n !== 0 && !sahifaSavollari.has(f.n)),
        ...yangiFlags,
      ];
      const pages = { ...(oldingi?.pages || {}) };
      if (url) pages[page] = { url, at: new Date().toISOString() };
      const manual = oldingi?.manual || {};
      const variantCode = manual.variant || variant || oldingi?.variantCode || null;
      // Operator variantni oldin qo'lda tanlagan bo'lsa — o'sha variantning kaliti.
      const items = (variantCode === variant ? taxminiy : await variantOl(variantCode))?.items || null;
      const source = ['skaner', 'kamera', 'qolda'].includes(b.source) ? b.source : 'skaner';
      const hisob = hisobMaydonlari(e, items, { raw, manual, flags, variantCode, reviewStatus: oldingi?.reviewStatus });

      const data = { ...hisob, raw, flags, pages, session: seat.session, source, scannedAt: new Date() };
      const [natija] = await Promise.all([
        oldingi
          ? prisma.examResult.update({ where: { id: oldingi.id }, data, select: NATIJA_ROYXAT_SELECT })
          : prisma.examResult.create({
            data: { ...data, manual: {}, examId, seatId: seat.id, studentId: seat.studentId, schoolId: seat.schoolId },
            select: NATIJA_ROYXAT_SELECT,
          }),
        prisma.examSeat.update({ where: { id: seat.id }, data: { status: 'keldi', ...(bubbled && !seat.variant ? { variant: bubbled } : {}) } }),
        e.status === IMTIHON_HOLATLARI.TAYYOR
          ? prisma.exam.update({ where: { id: examId }, data: { status: IMTIHON_HOLATLARI.TEKSHIRILMOQDA } })
          : null,
      ]);
      res.json({ ...natija, name: seat.student?.name || seat.guestName || '', sheetCode: seat.sheetCode, shubhalar: halQilinmagan(flags, manual).length });
    } catch (err) { next(err); }
  });

  app.get('/api/exams/:id/results', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const where = { examId, schoolId: { in: await allowedSchoolIds(req.user) } };
      if (req.query.holat) where.reviewStatus = String(req.query.holat);
      if (req.ruxsat?.faqatOz) where.studentId = { in: [...(await ozKurslari(req.user)).studentIds] };
      const results = await prisma.examResult.findMany({
        where,
        select: { ...NATIJA_ROYXAT_SELECT, student: { select: { id: true, name: true, photo: true } }, seat: { select: { guestName: true, groupId: true, sheetCode: true, roomId: true, row: true, col: true } } },
        orderBy: [{ score: 'desc' }, { id: 'asc' }],
      });
      const groupIds = [...new Set(results.map(r => r.seat?.groupId).filter(Boolean))];
      const groups = groupIds.length ? await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }) : [];
      const gmap = new Map(groups.map(g => [g.id, g.name]));
      res.json(results.map(r => {
        const { student, seat, manual, flags, ...qolgan } = r;
        return {
          ...qolgan,
          name: student?.name || seat?.guestName || '',
          photo: student?.photo || null,
          groupId: seat?.groupId ?? null,
          groupName: seat?.groupId ? gmap.get(seat.groupId) || '' : '',
          sheetCode: seat?.sheetCode || null,
          havola: natijaTokeni(r.id),
          shubhalar: halQilinmagan(flags, manual).length,
          flags,
          manual,
        };
      }));
    } catch (err) { next(err); }
  });

  // Tekshirish oynasi uchun bitta natija: varaq rasmi, xom javoblar, shubhalar va
  // variant tartibi. Kalit (k, j) faqat kalit ruxsati bilan.
  app.get('/api/exam-results/:id', authenticate, async (req, res, next) => {
    try {
      const r = await prisma.examResult.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { student: { select: { id: true, name: true, photo: true } }, seat: true },
      });
      if (!r) return res.status(404).json({ error: 'Natija topilmadi' });
      if (req.ruxsat?.faqatOz && r.studentId && !(await ozKurslari(req.user)).studentIds.has(r.studentId)) {
        return res.status(403).json({ error: "Bu o'quvchi sizning kurslaringizda emas", ruxsat: true });
      }
      const variant = r.variantCode ? await prisma.examVariant.findFirst({ where: { examId: r.examId, session: r.session ?? 1, code: r.variantCode } }) : null;
      const kalit = kor(req, 'imtihonlar.kalit');
      res.json({
        ...r,
        name: r.student?.name || r.seat?.guestName || '',
        items: variant ? variant.items.map(it => {
          if (kalit) return it;
          // eslint-disable-next-line no-unused-vars
          const { k, j, ...qolgan } = it;
          return qolgan;
        }) : [],
        shubhalar: halQilinmagan(r.flags, r.manual),
      });
    } catch (err) { next(err); }
  });

  // Operator qarori: {manual: {n: 'B' | '' | {ball} | null}, variant?} — null qarorni olib tashlaydi.
  app.put('/api/exam-results/:id/review', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const r = await prisma.examResult.findUnique({ where: { id } });
      if (!r) return res.status(404).json({ error: 'Natija topilmadi' });
      const e = await prisma.exam.findUnique({ where: { id: r.examId } });
      const s = sozlamaniTozala(e.settings);
      const tuzilma = varaqTuzilmasi(e.blocks, e.scoring);
      const tur = new Map(tuzilma.savollar.map(x => [x.n, x.tur]));
      const manual = { ...(r.manual || {}) };
      for (const [k, v] of Object.entries(req.body.manual && typeof req.body.manual === 'object' ? req.body.manual : {})) {
        const n = parseInt(k);
        if (!tur.has(n)) continue;
        if (v === null) { delete manual[n]; continue; }
        if (tur.get(n) === 'yozma') {
          const ball = Number(v?.ball);
          if (Number.isFinite(ball)) manual[n] = { ball };
        } else {
          manual[n] = String(v ?? '').slice(0, 12);
        }
      }
      if (req.body.variant !== undefined) {
        const v = String(req.body.variant || '').toUpperCase();
        if (v && !VARIANT_KODLARI.slice(0, s.variantCount).includes(v)) return res.status(400).json({ error: "Variant noto'g'ri" });
        if (v) manual.variant = v; else delete manual.variant;
      }
      const variantCode = manual.variant || r.variantCode;
      const items = variantCode ? (await prisma.examVariant.findFirst({ where: { examId: r.examId, session: r.session ?? 1, code: variantCode } }))?.items : null;
      const hisob = hisobMaydonlari(e, items, { ...r, manual, variantCode, reviewStatus: 'tekshirildi' });
      const yangi = await prisma.examResult.update({
        where: { id },
        data: { ...hisob, manual, reviewedById: req.user.id || null, reviewedAt: new Date() },
        select: NATIJA_ROYXAT_SELECT,
      });
      res.json({ ...yangi, shubhalar: halQilinmagan(r.flags, manual).length });
    } catch (err) { next(err); }
  });

  app.post('/api/exams/:id/recalculate', authenticate, async (req, res, next) => {
    try {
      const e = await prisma.exam.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      res.json({ qaytaHisoblandi: await hammasiniQaytaHisobla(e) });
    } catch (err) { next(err); }
  });

  app.delete('/api/exam-results/:id', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const r = await prisma.examResult.findUnique({ where: { id }, select: { pages: true } });
      await prisma.examResult.delete({ where: { id } });
      await rasmlarniTozala(rasmNomlari(r?.pages));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // Barcha imtihonlar natijalari (o'quvchi profili va umumiy hisobot uchun).
  app.get('/api/exam-results', authenticate, async (req, res, next) => {
    try {
      const where = {};
      if (req.query.examId) where.examId = parseInt(req.query.examId);
      if (req.query.studentId) where.studentId = parseInt(req.query.studentId);
      const filial = parseInt(req.query.schoolId);
      where.schoolId = filial > 0 ? filial : { in: await allowedSchoolIds(req.user) };
      if (req.ruxsat?.faqatOz && !req.query.studentId) where.studentId = { in: [...(await ozKurslari(req.user)).studentIds] };
      if (!kor(req, 'imtihonlar.natija')) where.exam = { publishedAt: { not: null } };
      const results = await prisma.examResult.findMany({
        where,
        select: {
          id: true, studentId: true, examId: true, variantCode: true, score: true, percentage: true, blockScores: true,
          scannedAt: true, schoolId: true, rank: true, rankBranch: true, rankGroup: true, reviewStatus: true,
          raschScore: true, grade: true,
          student: { select: { id: true, name: true, photo: true } },
          exam: { select: { id: true, name: true, maxScore: true, date: true, publishedAt: true } },
        },
        orderBy: { scannedAt: 'desc' },
      });
      // O'quvchi profili uchun: har imtihonda nechta qatnashchi (o'rin "12 / 80"
      // ko'rinishida) va e'lon qilinganining ota-ona sahifasi havolasi.
      if (req.query.studentId) {
        const examIds = [...new Set(results.map(r => r.examId))];
        const soni = examIds.length ? await prisma.examResult.groupBy({ by: ['examId'], where: { examId: { in: examIds } }, _count: { _all: true } }) : [];
        const jami = new Map(soni.map(x => [x.examId, x._count._all]));
        return res.json(results.map(r => ({ ...r, jami: jami.get(r.examId) || 0, havola: r.exam?.publishedAt ? natijaTokeni(r.id) : null })));
      }
      res.json(results);
    } catch (err) { next(err); }
  });

  // ============================ Tahlil ============================

  app.get('/api/exams/:id/analysis', authenticate, async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id: examId } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const [variants, results] = await Promise.all([
        prisma.examVariant.findMany({ where: { examId } }),
        prisma.examResult.findMany({
          where: { examId, variantCode: { not: null } },
          select: { id: true, session: true, variantCode: true, score: true, detail: true, schoolId: true, seat: { select: { groupId: true } } },
        }),
      ]);
      const natijalar = results.map(r => ({ ...r, detail: Array.isArray(r.detail) ? r.detail : [] }));
      const tahlil = savolTahlili({ variants, natijalar });
      const qids = tahlil.map(t => t.q);
      const savollar = await prisma.question.findMany({
        where: { id: { in: qids } },
        select: { id: true, text: true, subject: true, topic: true, type: true, correctAnswer: true },
      });
      const smap = new Map(savollar.map(q => [q.id, q]));
      const kalit = kor(req, 'imtihonlar.kalit');

      // Mavzu × kurs: har kursda mavzu bo'yicha to'g'ri javoblar ulushi.
      const vmap = new Map(variants.map(v => [`${v.session}|${v.code}`, new Map(v.items.map(it => [it.n, it]))]));
      const mavzular = new Map();
      for (const r of natijalar) {
        const imap = vmap.get(`${r.session}|${r.variantCode}`);
        if (!imap) continue;
        const kurs = r.seat?.groupId ?? 0;
        for (const d of r.detail) {
          if (d.holat === 'bekor' || d.holat === 'baholanmagan') continue;
          const it = imap.get(d.n);
          const q = it && smap.get(it.q);
          if (!q) continue;
          const k = `${q.subject}|${q.topic}`;
          if (!mavzular.has(k)) mavzular.set(k, { fan: q.subject, mavzu: q.topic, jami: 0, togri: 0, kurslar: {} });
          const m = mavzular.get(k);
          m.jami++;
          if (d.holat === 'togri') m.togri++;
          if (!m.kurslar[kurs]) m.kurslar[kurs] = { jami: 0, togri: 0 };
          m.kurslar[kurs].jami++;
          if (d.holat === 'togri') m.kurslar[kurs].togri++;
        }
      }
      const s = sozlamaniTozala(e.settings);
      res.json({
        savollar: tahlil.map(t => {
          const q = smap.get(t.q);
          return {
            ...t, subject: q?.subject || '', topic: q?.topic || '', text: q?.text || '', type: q?.type || t.t,
            togriJavob: kalit ? (s.keyFix[t.q]?.join(', ') || q?.correctAnswer || '') : null,
            bekor: s.cancelled[t.q] || null,
            ...(kalit ? {} : { tanlov: null }),
          };
        }).sort((a, b) => a.b - b.b || a.foiz - b.foiz),
        mavzular: [...mavzular.values()].map(m => ({ ...m, foiz: m.jami ? Math.round((m.togri / m.jami) * 1000) / 10 : 0 })).sort((a, b) => a.foiz - b.foiz),
        natijaSoni: natijalar.length,
      });
    } catch (err) { next(err); }
  });

  // ============================ E'lon ============================

  async function elonXulosasi(e) {
    const [seats, results] = await Promise.all([
      prisma.examSeat.findMany({ where: { examId: e.id }, select: { id: true, status: true, studentId: true } }),
      prisma.examResult.findMany({ where: { examId: e.id }, select: { id: true, seatId: true, reviewStatus: true, score: true, detail: true, notifiedAt: true, notifyStatus: true } }),
    ]);
    const natijali = new Set(results.map(r => r.seatId));
    const baholanmagan = results.filter(r => (Array.isArray(r.detail) ? r.detail : []).some(d => d.holat === 'baholanmagan')).length;
    return {
      qatnashchi: seats.length,
      skanerlangan: results.length,
      kelmagan: seats.filter(s => s.status === 'kelmadi').length,
      skanerlanmagan: seats.filter(s => s.status !== 'kelmadi' && !natijali.has(s.id)).length,
      shubhali: results.filter(r => r.reviewStatus === 'shubhali').length,
      baholanmagan,
      nolBall: results.filter(r => !r.score).length,
      yuborilgan: results.filter(r => r.notifiedAt).length,
      yuborilmagan: results.filter(r => !r.notifiedAt).length,
      published: !!e.publishedAt,
      publishedAt: e.publishedAt,
    };
  }

  app.get('/api/exams/:id/publish-summary', authenticate, async (req, res, next) => {
    try {
      const e = await prisma.exam.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      res.json(await elonXulosasi(e));
    } catch (err) { next(err); }
  });

  // E'lon: reytinglar hisoblanadi, savollar statistikasi yangilanadi, natija
  // ota-onaga ko'rinadigan bo'ladi. Xabarlar alohida (/notify) — bo'lib-bo'lib.
  app.post('/api/exams/:id/publish', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (!e.lockedAt) return res.status(409).json({ error: 'Imtihon hali qulflanmagan' });
      const x = await elonXulosasi(e);
      if (!x.skanerlangan) return res.status(409).json({ error: "Hali birorta natija yo'q" });
      if ((x.shubhali || x.baholanmagan) && req.body.force !== true) {
        return res.status(409).json({ error: `${x.shubhali} ta varaq tekshirilmagan — avval tekshiring`, xulosa: x });
      }

      await hammasiniQaytaHisobla(e);
      const s = sozlamaniTozala(e.settings);
      const [results, variants] = await Promise.all([
        prisma.examResult.findMany({ where: { examId: id }, select: { id: true, score: true, schoolId: true, session: true, variantCode: true, detail: true, seat: { select: { groupId: true } } } }),
        prisma.examVariant.findMany({ where: { examId: id } }),
      ]);
      // Rasch yoqilgan bo'lsa — T-ball va daraja, reyting ham shu ball bo'yicha.
      const rasch = s.rasch.enabled ? raschNatijalari(results, variants, s.rasch.grades) : new Map();
      const reytingUchun = results.map(r => ({ ...r, score: rasch.get(r.id)?.raschScore ?? r.score }));
      const umumiy = reytingOrinlari(reytingUchun).orin;
      const filial = reytingOrinlari(reytingUchun, r => r.schoolId).orin;
      const kurs = reytingOrinlari(reytingUchun, r => r.seat?.groupId ?? null).orin;
      const bosh = { raschTheta: null, raschScore: null, grade: null };
      const amallar = results.map(r => prisma.examResult.update({
        where: { id: r.id },
        data: { rank: umumiy.get(r.id) ?? null, rankBranch: filial.get(r.id) ?? null, rankGroup: kurs.get(r.id) ?? null, ...(rasch.get(r.id) || bosh) },
      }));
      for (let i = 0; i < amallar.length; i += 100) await prisma.$transaction(amallar.slice(i, i + 100));

      // Savollarning haqiqiy qiyinligi — bankda keyingi imtihonlar uchun.
      const natijalar = results.filter(r => r.variantCode);
      const tahlil = savolTahlili({ variants, natijalar: natijalar.map(r => ({ ...r, detail: Array.isArray(r.detail) ? r.detail : [] })) });
      const statlar = tahlil.filter(t => t.jami > 0).map(t => prisma.question.update({ where: { id: t.q }, data: { pCorrect: t.foiz, discrimination: t.farq } }));
      for (let i = 0; i < statlar.length; i += 100) await prisma.$transaction(statlar.slice(i, i + 100));

      const yangi = await prisma.exam.update({
        where: { id },
        data: { publishedAt: e.publishedAt || new Date(), publishedById: req.user.id || null, status: IMTIHON_HOLATLARI.ELON },
      });
      res.json({ exam: imtihonJavobi(yangi, req), xulosa: await elonXulosasi(yangi) });
    } catch (err) { next(err); }
  });

  // Natija xabarlari — bir so'rovda `limit` tagacha (Vercel vaqt chegarasi).
  // Mijoz `qoldi` 0 bo'lguncha qayta chaqiradi. Yuborilgani qayta ketmaydi.
  app.post('/api/exams/:id/notify', authenticate, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const e = await prisma.exam.findUnique({ where: { id } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      if (!e.publishedAt) return res.status(409).json({ error: "Avval natijalarni e'lon qiling" });
      const s = sozlamaniTozala(e.settings);
      if (s.notify.channel === 'NONE') return res.json({ yuborildi: 0, xato: 0, qoldi: 0 });
      // Bir SMS Eskiz'da 12 s gacha kutishi mumkin — Vercel vaqt chegarasiga sig'sin.
      const limit = Math.min(30, Math.max(1, parseInt(req.body.limit) || 8));
      const navbat = await prisma.examResult.findMany({
        where: { examId: id, notifiedAt: null },
        include: { student: true, seat: { select: { guestName: true, guestPhone: true, groupId: true } } },
        orderBy: { id: 'asc' },
        take: limit,
      });
      const [jamiSoni, filialSoni, kursSoni, markaz] = await Promise.all([
        prisma.examResult.count({ where: { examId: id } }),
        prisma.examResult.groupBy({ by: ['schoolId'], where: { examId: id }, _count: { _all: true } }),
        prisma.examSeat.groupBy({ by: ['groupId'], where: { examId: id, results: { some: {} } }, _count: { _all: true } }),
        markazBrendi(e.schoolId),
      ]);
      const kursSon = new Map(kursSoni.map(k => [k.groupId, k._count._all]));
      const kimga = kimgaQiymati(s.notify.to);
      let yuborildi = 0, xato = 0;
      for (const r of navbat) {
        const bloklar = (Array.isArray(r.blockScores) ? r.blockScores : []).filter(b => b.max > 0);
        const orinQismi = [];
        if (s.ranking === 'hammasi') {
          if (r.rankGroup && r.seat?.groupId) orinQismi.push(`kursda ${r.rankGroup}/${kursSon.get(r.seat.groupId) || '?'}`);
          if (r.rank) orinQismi.push(`umumiy ${r.rank}/${jamiSoni}`);
        } else if (s.ranking === 'top' && r.rank && r.rank <= s.topN) {
          orinQismi.push(`umumiy ${r.rank}-o'rin`);
        }
        const havola = `${asosiyManzil(req)}/natija/${natijaTokeni(r.id)}`;
        const matn = natijaXabari(s.notify.template, {
          ism: r.student?.name || r.seat?.guestName || '',
          imtihon: e.name,
          sana: sanaMatni(e.date),
          ball: vergul(r.score),
          maks: vergul(e.maxScore),
          foiz: vergul(r.percentage),
          bloklar: bloklar.length > 1 ? bloklar.map(b => `• ${b.subject}: ${vergul(b.earned)} / ${vergul(b.max)}`).join('\n') : '',
          orin: orinQismi.length ? `🏆 O'rni: ${orinQismi.join(' · ')}` : '',
          markaz: markaz?.orgName || '',
          rasch: r.raschScore != null ? vergul(r.raschScore) : '',
          daraja: r.raschScore != null ? r.grade || "yetmadi" : '',
          havola,
        });
        let natija;
        if (r.student) {
          // Telegramda natija sahifasi Mini App bo'lib ochiladi (SMS da — havola matnda).
          natija = await sendToOne({ student: r.student, message: matn, channel: s.notify.channel, recipientTo: kimga, type: 'EXAM_RESULT', schoolId: r.schoolId, telegramExtra: natijaTugmasi(havola) });
        } else if (r.seat?.guestPhone && s.notify.channel !== 'TELEGRAM') {
          natija = await sendToOne({ student: { id: null, name: r.seat.guestName, phone: r.seat.guestPhone }, message: matn, channel: 'SMS', recipientTo: 'STUDENT', type: 'EXAM_RESULT', schoolId: r.schoolId });
        } else {
          natija = { attempted: false, success: false };
        }
        const holat = natija.success ? 'yuborildi' : natija.attempted ? 'xato' : 'aloqa yoq';
        if (natija.success) yuborildi++; else xato++;
        await prisma.examResult.update({ where: { id: r.id }, data: { notifiedAt: new Date(), notifyStatus: holat } });
      }
      const qoldi = await prisma.examResult.count({ where: { examId: id, notifiedAt: null } });
      res.json({ yuborildi, xato, qoldi, filiallar: filialSoni.length });
    } catch (err) { next(err); }
  });

  // Katta ekran (televizor, proyektor) uchun reyting. Faqat e'lon qilingan
  // imtihon va sozlamadagi qoida bo'yicha: 'top' — birinchi topN (teng ball
  // bilan birga), 'yoq' — ro'yxat berilmaydi. Umumiy o'rin imtihonning hamma
  // filiallari bo'yicha, `filial` bilan — shu filial ichidagi o'rin.
  app.get('/api/exams/:id/leaderboard', authenticate, async (req, res, next) => {
    try {
      const e = await prisma.exam.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!e) return res.status(404).json({ error: 'Imtihon topilmadi' });
      const s = sozlamaniTozala(e.settings);
      const filiallar = imtihonFiliallari(e);
      const [brend, maktablar] = await Promise.all([
        markazBrendi(e.schoolId),
        prisma.school.findMany({ where: { id: { in: filiallar } }, select: { id: true, name: true } }),
      ]);
      const javob = {
        imtihon: { id: e.id, name: e.name, date: e.date, maxScore: e.maxScore, scoring: e.scoring, publishedAt: e.publishedAt },
        markaz: brend.orgName, logo: brend.logo, ranking: s.ranking, topN: s.topN, rasch: s.rasch.enabled,
        filiallar: filiallar.map(id => maktablar.find(m => m.id === id)).filter(Boolean),
        jami: 0, qatorlar: [],
      };
      if (!e.publishedAt || s.ranking === 'yoq') return res.json(javob);
      const filial = parseInt(req.query.filial) || null;
      if (filial && !filiallar.includes(filial)) return res.status(400).json({ error: 'Filial topilmadi' });
      const maydon = filial ? 'rankBranch' : 'rank';
      const doira = { examId: e.id, ...(filial ? { schoolId: filial } : {}) };
      const [jami, rows] = await Promise.all([
        prisma.examResult.count({ where: doira }),
        prisma.examResult.findMany({
          where: { ...doira, [maydon]: s.ranking === 'top' ? { not: null, lte: s.topN } : { not: null } },
          orderBy: [{ [maydon]: 'asc' }, { id: 'asc' }],
          take: 1000,
          select: {
            id: true, score: true, percentage: true, blockScores: true, schoolId: true, rank: true, rankBranch: true,
            raschScore: true, grade: true,
            student: { select: { name: true, photo: true } }, seat: { select: { guestName: true, groupId: true } },
          },
        }),
      ]);
      const gids = [...new Set(rows.map(r => r.seat?.groupId).filter(Boolean))];
      const kurslar = gids.length ? await prisma.group.findMany({ where: { id: { in: gids } }, select: { id: true, name: true } }) : [];
      const kmap = new Map(kurslar.map(g => [g.id, g.name]));
      javob.jami = jami;
      javob.qatorlar = rows.map(r => ({
        id: r.id, orin: r[maydon], ism: r.student?.name || r.seat?.guestName || '',
        // Rasm faqat birinchi o'ntaga — sahna uchun; qolgani ro'yxat.
        rasm: r[maydon] <= 10 ? r.student?.photo || null : null,
        filialId: r.schoolId, kurs: r.seat?.groupId ? kmap.get(r.seat.groupId) || '' : '',
        ball: r.score, foiz: r.percentage, rasch: r.raschScore, daraja: r.grade,
        bloklar: (Array.isArray(r.blockScores) ? r.blockScores : []).filter(b => b.max > 0).map(b => ({ subject: b.subject, earned: b.earned, max: b.max })),
      }));
      res.json(javob);
    } catch (err) { next(err); }
  });

  // ============================ Natija sahifasi ============================

  // Ota-ona xabardagi havola orqali ochadi (kirishsiz). Faqat e'lon qilingan
  // imtihon. Sozlamada yoqilgan bo'lsa — savollar, o'quvchining javobi, to'g'ri
  // javob va faqat TASDIQLANGAN yechim ("xatolar ustida ishlash").
  app.get('/api/public/natija/:token', natijaSahifaCheklovi, async (req, res, next) => {
    try {
      const id = tokendanId(req.params.token);
      if (!id) return res.status(404).json({ error: 'Havola noto\'g\'ri yoki eskirgan' });
      const r = await prisma.examResult.findUnique({
        where: { id },
        include: { exam: true, student: { select: { name: true } }, seat: { select: { guestName: true, groupId: true } } },
      });
      if (!r || !r.exam.publishedAt) return res.status(404).json({ error: "Natija hali e'lon qilinmagan" });
      const e = r.exam;
      const s = sozlamaniTozala(e.settings);
      const [markaz, guruh, jami, kursJami] = await Promise.all([
        markazBrendi(e.schoolId),
        r.seat?.groupId ? prisma.group.findUnique({ where: { id: r.seat.groupId }, select: { name: true } }) : null,
        prisma.examResult.count({ where: { examId: e.id } }),
        r.seat?.groupId ? prisma.examSeat.count({ where: { examId: e.id, groupId: r.seat.groupId, results: { some: {} } } }) : 0,
      ]);
      let orin = null;
      if (s.ranking === 'hammasi') orin = { umumiy: r.rank, jami, kurs: r.rankGroup, kursJami };
      else if (s.ranking === 'top' && r.rank && r.rank <= s.topN) orin = { umumiy: r.rank };

      let savollar = null;
      let matnlar = [];
      if (s.showQuestionsAfter && r.variantCode) {
        const v = await prisma.examVariant.findFirst({ where: { examId: e.id, session: r.session ?? 1, code: r.variantCode } });
        const items = Array.isArray(v?.items) ? v.items : [];
        const qids = items.map(it => it.q);
        const qs = await prisma.question.findMany({
          where: { id: { in: qids } },
          select: { id: true, text: true, imageUrl: true, options: true, optionA: true, optionB: true, optionC: true, optionD: true, solution: true, solutionStatus: true, passageId: true, correctAnswer: true, answers: true },
        });
        const qmap = new Map(qs.map(q => [q.id, q]));
        const detail = new Map((Array.isArray(r.detail) ? r.detail : []).map(d => [d.n, d]));
        savollar = items.map(it => {
          const q = qmap.get(it.q);
          const d = detail.get(it.n) || {};
          const variantlar = savolVariantlari(q || {});
          const tartib = it.m || variantlar.map((_, i) => i);
          let togri = null;
          if (it.t === 'yopiq') {
            const tuz = s.keyFix[it.q];
            togri = tuz ? tuz.map(h => HARFLAR[tartib.indexOf(HARFLAR.indexOf(h))]).filter(Boolean) : [HARFLAR[it.k]];
          } else if (it.t === 'raqamli') togri = s.keyFix[it.q] || it.j || [];
          return {
            n: it.n, t: it.t, p: it.p, pa: it.pa || null,
            matn: q?.text || '', rasm: q?.imageUrl || null,
            variantlar: it.t === 'yopiq' ? tartib.map(i => variantlar[i] ?? '') : [],
            javob: typeof d.javob === 'object' && d.javob ? (d.javob.ball ?? '') : (d.javob ?? ''),
            togri, holat: d.holat || null, ball: d.ball ?? 0,
            yechim: q?.solutionStatus === 'tasdiqlangan' ? q.solution : null,
          };
        });
        const pids = [...new Set(qs.map(q => q.passageId).filter(Boolean))];
        if (pids.length) matnlar = await prisma.passage.findMany({ where: { id: { in: pids } }, select: { id: true, title: true, text: true, imageUrl: true } });
        // O'quvchilarga ko'rsatilgan savol — keyingi imtihonlarda ehtiyot bo'lish uchun belgi.
        await prisma.question.updateMany({ where: { id: { in: qids }, shownAt: null }, data: { shownAt: new Date() } });
      }

      res.json({
        markaz: markaz?.orgName || '',
        imtihon: { name: e.name, date: e.date, maxScore: e.maxScore, scoring: e.scoring },
        ism: r.student?.name || r.seat?.guestName || '',
        kurs: guruh?.name || '',
        ball: r.score, foiz: r.percentage,
        bloklar: (Array.isArray(r.blockScores) ? r.blockScores : []).map(b => ({ subject: b.subject, earned: b.earned, max: b.max })),
        rasch: r.raschScore != null ? { ball: r.raschScore, daraja: r.grade } : null,
        orin, savollar, matnlar,
      });
    } catch (err) { next(err); }
  });
}
