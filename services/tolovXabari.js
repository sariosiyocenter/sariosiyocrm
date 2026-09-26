// To'lov xabari — to'lov qabul qilinganda ota-onaga "to'lov qabul qilindi"
// SMS i (lib/tolovXabari.js — sozlama shakli va SMS matni qoidalari).
//
// Qanday ishlaydi:
//  1. Har bir kirim to'lov uchun bitta TolovXabari yozuvi (paymentId @unique) —
//     bir to'lovga ikki marta SMS ketmaydi, holati doim ko'rinadi.
//  2. Matn — Xabarlar → Shablonlar dagi tanlangan shablon. Eskiz faqat
//     tasdiqlangan shablonga mos matnni yuboradi, shuning uchun shablon hali
//     tekshiruvda bo'lsa yozuv "kutmoqda" turadi va tasdiqlangach navbatdan
//     o'zi ketadi (48 soat ichida).
//  3. Tarmoq yoki Eskiz xatosida — qayta urinish (2, 5, 15, 60, 180 daqiqa).
//  4. Eskiz callback'i SMS haqiqatan yetib bordimi-yo'qligini yozadi.
//  5. To'lov yuborilishidan oldin o'chirilsa — xabar bekor bo'ladi.
//
// Eskiz/Telegram bilan ishlash server.js da (sendSms, bot) — server ularni
// tolovXabariniUlash() orqali ulaydi (transportNotify.js dagi kabi).

import prisma from '../lib/prisma.js';
import { fillTemplate, kirimmi } from '../lib/xabarMatni.js';
import { markazNomi } from '../lib/markazBrendi.js';
import {
  sozlamaniTozala, shablonTaxmini, STANDART_SOZLAMA, eskizYuboradi, eskizRadEtdi,
  smsMatni, smsIsm, uzRaqam, KIMGA_NOMI,
} from '../lib/tolovXabari.js';

/**
 * Server ulaydigan funksiyalar:
 *  sms(phone, text, { schoolId, studentId }) → { success, eskizId, xato, lokal }
 *  telegram(schoolId, chatId, text, { studentId, toName }) → { success, xato }
 *  eskizHolatlari(schoolId) → Map(eskizTemplateId → status) | null
 *  eskizBalans(schoolId) → number | null
 */
let tr = null;
export function tolovXabariniUlash(transport) {
  tr = transport;
}

const MUDDAT_MS = 48 * 3600e3;              // shundan eski xabar endi yuborilmaydi
const QAYTA_MS = [2, 5, 15, 60, 180].map(m => m * 60e3);
const ENG_KOP_URINISH = QAYTA_MS.length + 1;
const QULF_MS = 2 * 60e3;                    // "yuborilmoqda" — shuncha vaqt boshqasi olmaydi
const SHABLON_KUT_MS = 10 * 60e3;           // Eskiz tasdig'ini tekshirish oralig'i
// To'lov javobi shundan ortiq kutmaydi (lokal sinovda baza uzoq — env bilan).
const DARHOL_KUT_MS = Number(process.env.TOLOV_XABAR_KUT_MS) || 8000;

/**
 * Lokal server (sinovlar) production bazasi bilan ishlaydi. U haqiqiy
 * filiallarning xabarlariga TEGMAYDI: yangi yozuv yaratmaydi, navbatdagisini
 * "yuborilmadi" yoki soxta "yuborildi" deb belgilab qo'ymaydi. Faqat nomi
 * "ZZ " bilan boshlanadigan sinov filiallari. SMS_REAL=1 — cheklovsiz.
 */
export async function lokalTegmaydi(schoolId) {
  if (process.env.VERCEL || process.env.SMS_REAL === '1') return false;
  const s = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
  return !String(s?.name || '').startsWith('ZZ ');
}

// ---------------------------------------------------------------------------
// Sozlama
// ---------------------------------------------------------------------------

async function tashkilot(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, organizationId: true, organization: { select: { tolovXabari: true } } },
  });
  if (!school) return null;
  const ids = school.organizationId
    ? (await prisma.school.findMany({ where: { organizationId: school.organizationId }, select: { id: true } })).map(s => s.id)
    : [school.id];
  return { school, ids, raw: school.organization?.tolovXabari ?? null };
}

/**
 * Amaldagi sozlama. Hali saqlanmagan bo'lsa — eski "To'lov qabul qilinganda"
 * avto-qoidasidan (kanal, kimga, yoqilganmi) va shablon nomi/matnidan taxmin.
 */
export async function tolovSozlamasi(schoolId) {
  const t = await tashkilot(schoolId);
  if (!t) return null;
  const shablonlar = await prisma.messageTemplate.findMany({
    where: { schoolId: { in: t.ids } },
    select: { id: true, name: true, body: true, eskizStatus: true, eskizTemplateId: true, schoolId: true },
    orderBy: { id: 'asc' },
  });
  const saqlangan = t.raw !== null && t.raw !== undefined;
  let sozlama;
  if (saqlangan) {
    sozlama = sozlamaniTozala(t.raw);
  } else {
    const qoida = await prisma.autoMessageRule.findFirst({
      where: { schoolId: { in: t.ids }, type: 'PAYMENT_CONFIRM' }, orderBy: { id: 'asc' },
    });
    const bir = (s) => smsMatni(s).replace(/\s+/g, ' ').trim();
    const mos = qoida ? shablonlar.find(s => bir(s.body) === bir(qoida.body)) : null;
    sozlama = sozlamaniTozala({
      ...STANDART_SOZLAMA,
      ...(qoida ? { yoqilgan: qoida.enabled, kanal: qoida.channel, kimga: qoida.recipientTo } : {}),
      shablonId: mos?.id ?? shablonTaxmini(shablonlar),
    });
  }
  if (sozlama.shablonId && !shablonlar.some(s => s.id === sozlama.shablonId)) sozlama.shablonId = null;
  return { sozlama, saqlangan, shablonlar, organizationId: t.school.organizationId, schoolIds: t.ids };
}

export async function tolovSozlamasiniSaqla(schoolId, raw) {
  const t = await tashkilot(schoolId);
  if (!t?.school.organizationId) return { error: "Filial tashkilotga bog'lanmagan" };
  const sozlama = sozlamaniTozala(raw);
  if (sozlama.shablonId) {
    const bor = await prisma.messageTemplate.findFirst({ where: { id: sozlama.shablonId, schoolId: { in: t.ids } }, select: { id: true } });
    if (!bor) return { error: 'Shablon topilmadi' };
  }
  await prisma.organization.update({ where: { id: t.school.organizationId }, data: { tolovXabari: sozlama } });
  return { sozlama };
}

// ---------------------------------------------------------------------------
// Yuborish
// ---------------------------------------------------------------------------

/** Eskiz/xato matnidan sabab turi — qayta urinish kerakmi. */
export function xatoTuri(m) {
  const s = String(m || '');
  if (/lokal server/i.test(s)) return 'lokal';
  if (/модерац|moderat/i.test(s)) return 'shablon';
  if (/баланс|средств|balance|limit|недостаточно/i.test(s)) return 'balans';
  if (/sozlamalari|token|auth|unauthor|401/i.test(s)) return 'sozlama';
  if (/timeout|abort|fetch failed|ECONN|ENOTFOUND|socket|network|kutish vaqti/i.test(s)) return 'tarmoq';
  return 'boshqa';
}

export const XATO_SABABI = {
  shablon: "Matn Eskizdagi tasdiqlangan shablonga mos kelmadi — shablonni tekshiring",
  balans: "Eskiz balansida pul tugagan — to'ldirilgach o'zi qayta yuboriladi",
  sozlama: "Eskiz sozlamasi (email/parol) noto'g'ri yoki kiritilmagan — Sozlamalar → Integratsiyalar",
  tarmoq: "Eskiz javob bermadi — o'zi qayta urinadi",
  lokal: "Lokal server: haqiqiy SMS yuborilmaydi (sinov)",
};

/** Qabul qiluvchilar: kimga ro'yxati bo'yicha telefon va Telegram (qarz eslatmasi ham shundan). */
export function qabulQiluvchilar(student, kimga) {
  const out = [];
  const tur = kimga.split(',');
  const qosh = (k, tel, tg) => out.push({ kimga: k, tel: uzRaqam(tel), telXom: tel || null, tg: tg || null });
  if (tur.includes('FATHER')) qosh('FATHER', student.fatherPhone, student.fatherTelegramId);
  if (tur.includes('MOTHER')) qosh('MOTHER', student.motherPhone, student.motherTelegramId);
  if (tur.includes('STUDENT')) qosh('STUDENT', student.phone, student.telegramId);
  // Tanlanganlarning hech birida raqam bo'lmasa — o'quvchining o'z raqami
  // (kichik bolada yo'q bo'lishi mumkin): xabar yo'qolib qolmasin.
  if (!out.some(q => q.tel) && !tur.includes('STUDENT') && uzRaqam(student.phone)) qosh('STUDENT', student.phone, null);
  return out;
}

async function matnniTuz(payment, student, shablon) {
  const [school, orgName, kurslar] = await Promise.all([
    prisma.school.findUnique({ where: { id: payment.schoolId } }),
    markazNomi(payment.schoolId),
    prisma.group.findMany({
      where: { students: { some: { id: student.id } } },
      select: { id: true, name: true, course: { select: { name: true } }, teacher: { select: { name: true } } },
    }),
  ]);
  const oqKurslari = kurslar.map(g => ({ id: g.id, name: g.name, courseName: g.course?.name || '', teacherName: g.teacher?.name || '' }));
  const target = { ...student, name: smsIsm(student.name) || student.name, customPaymentAmount: payment.amount, lastPaymentAmount: payment.amount };
  return smsMatni(fillTemplate(shablon.body, target, oqKurslari, { ...(school || {}), orgName }));
}

/**
 * Bitta yozuvni yuborishga urinish. Natijani yozuvga yozadi va qaytaradi.
 * opts.payme — Telegram xabarini Payme o'zi yuborgan (routes/payme.js).
 * opts.qolda — xodim "Qayta yuborish"ni bosgan: 48 soatlik cheklov yo'q.
 */
async function yuborish(rowId, opts = {}) {
  const row = await prisma.tolovXabari.findUnique({ where: { id: rowId } });
  if (!row || ['yuborildi', 'yetkazildi', 'yetkazilmadi', 'bekor'].includes(row.holat)) return row;
  if (await lokalTegmaydi(row.schoolId)) return row;
  const saqla = (data) => prisma.tolovXabari.update({ where: { id: row.id }, data });
  const urinish = row.urinish + 1;

  if (!opts.qolda && Date.now() - new Date(row.createdAt).getTime() > MUDDAT_MS) {
    return saqla({ holat: 'xato', sabab: "48 soat ichida yuborib bo'lmadi — endi yuborilmaydi" });
  }
  // Parallel: to'lov javobi kutib turibdi (yangi to'lovda sozlama tayyor keladi).
  const [payment, student, s] = await Promise.all([
    prisma.payment.findUnique({ where: { id: row.paymentId } }),
    prisma.student.findUnique({ where: { id: row.studentId } }),
    opts.sozlama ? Promise.resolve(opts.sozlama) : tolovSozlamasi(row.schoolId),
  ]);
  if (!payment) return saqla({ holat: 'bekor', sabab: "To'lov o'chirilgan" });
  if (!student) return saqla({ holat: 'bekor', sabab: "O'quvchi o'chirilgan" });

  if (!s?.sozlama.yoqilgan) return saqla({ holat: 'xato', sabab: "To'lov xabari o'chirilgan (Xabarlar → Shablonlar)" });
  const shablon = s.shablonlar.find(t => t.id === s.sozlama.shablonId);
  if (!shablon) return saqla({ holat: 'xato', sabab: "Shablon tanlanmagan — Xabarlar → Shablonlar → To'lov xabari" });

  const { kanal, kimga } = s.sozlama;
  const matn = await matnniTuz(payment, student, shablon);
  const odamlar = qabulQiluvchilar(student, kimga);
  const raqamlar = [];

  // 1. Telegram (kanal TELEGRAM yoki "Telegram, bo'lmasa SMS").
  let tgOk = false;
  if (kanal === 'TELEGRAM' || kanal === 'BOTH') {
    for (const q of odamlar.filter(o => o.tg)) {
      if (opts.payme) {
        // Payme ota-onaga Telegram xabarini o'zi yuborgan.
        raqamlar.push({ kimga: q.kimga, kanal: 'TELEGRAM', manzil: String(q.tg), holat: 'yuborildi', izoh: 'Payme xabari' });
        tgOk = true;
        continue;
      }
      const r = tr?.telegram ? await tr.telegram(row.schoolId, q.tg, matn, { studentId: student.id, toName: `${student.name} (${KIMGA_NOMI[q.kimga]})` }) : { success: false, xato: 'bot ulanmagan' };
      raqamlar.push({ kimga: q.kimga, kanal: 'TELEGRAM', manzil: String(q.tg), holat: r.success ? 'yuborildi' : 'xato', xato: r.success ? null : r.xato });
      if (r.success) tgOk = true;
    }
  }

  // 2. SMS
  const smsKerak = kanal === 'SMS' || (kanal === 'BOTH' && !tgOk);
  if (smsKerak) {
    const tellar = odamlar.filter(o => o.tel).filter((o, i, a) => a.findIndex(x => x.tel === o.tel) === i);
    if (!tellar.length) {
      if (!tgOk) {
        const bor = odamlar.filter(o => o.telXom).map(o => `${KIMGA_NOMI[o.kimga]}: ${o.telXom}`);
        return saqla({
          holat: 'xato', matn, raqamlar,
          sabab: bor.length ? `Telefon raqami noto'g'ri (${bor.join(', ')})` : `Telefon raqami yo'q (${kimga.split(',').map(k => KIMGA_NOMI[k]).join(', ')})`,
        });
      }
    } else if (eskizRadEtdi(shablon.eskizStatus)) {
      if (!tgOk) return saqla({ holat: 'xato', matn, sabab: "Eskiz shablonni rad etgan — matnni o'zgartiring (Xabarlar → Shablonlar)" });
    } else if (!eskizYuboradi(shablon.eskizStatus)) {
      // Shablon tekshiruvda: SMS navbatda turadi, tasdiqlangach o'zi ketadi.
      if (!tgOk) {
        return saqla({
          holat: 'kutmoqda', matn, raqamlar,
          sabab: "Eskiz shablonni hali tasdiqlamagan — tasdiqlangach o'zi yuboriladi",
          keyingiUrinish: new Date(Date.now() + SHABLON_KUT_MS),
        });
      }
    } else {
      for (const q of tellar) {
        const r = tr?.sms ? await tr.sms(q.tel, matn, { schoolId: row.schoolId, studentId: student.id }) : { success: false, xato: 'SMS ulanmagan' };
        raqamlar.push({ kimga: q.kimga, kanal: 'SMS', manzil: q.tel, holat: r.success ? 'yuborildi' : 'xato', eskizId: r.eskizId || null, xato: r.success ? null : String(r.xato || '').slice(0, 200) });
      }
    }
  }

  const ok = raqamlar.filter(q => q.holat === 'yuborildi');
  if (ok.length) {
    return saqla({
      holat: 'yuborildi', sabab: null, matn, raqamlar, urinish,
      kanal: ok.some(q => q.kanal === 'SMS') ? 'SMS' : 'TELEGRAM', yuborilganAt: new Date(),
    });
  }
  // Hech biri ketmadi — sababiga qarab qayta urinish yoki to'xtatish.
  const turlar = raqamlar.filter(q => q.holat === 'xato').map(q => xatoTuri(q.xato));
  const tur = ['balans', 'tarmoq', 'sozlama', 'boshqa', 'shablon', 'lokal'].find(t => turlar.includes(t)) || 'boshqa';
  const yakuniy = tur === 'shablon' || tur === 'lokal' || urinish >= ENG_KOP_URINISH;
  const birinchiXato = raqamlar.find(q => q.xato)?.xato || '';
  return saqla({
    holat: yakuniy ? 'xato' : 'kutmoqda', matn, raqamlar, urinish,
    sabab: XATO_SABABI[tur] || `Yuborilmadi: ${birinchiXato.slice(0, 150)}`,
    keyingiUrinish: new Date(Date.now() + (QAYTA_MS[Math.min(urinish - 1, QAYTA_MS.length - 1)] || 60e3)),
  });
}

/** Yozuvning qisqa ko'rinishi — chek ostida va ro'yxatda. */
export function qisqa(row) {
  if (!row) return null;
  const raqamlar = Array.isArray(row.raqamlar) ? row.raqamlar : [];
  return {
    id: row.id, paymentId: row.paymentId, studentId: row.studentId, holat: row.holat, sabab: row.sabab, kanal: row.kanal,
    qabul: raqamlar.filter(q => q.holat !== 'xato').map(q => ({ kimga: q.kimga, kanal: q.kanal, holat: q.holat })),
  };
}

/**
 * Yangi to'lovdan keyin chaqiriladi (POST /api/payments, Klik tasdig'i,
 * Payme). Idempotent: shu to'lov uchun yozuv bo'lsa — o'sha qaytadi.
 * To'lov javobini ko'pi bilan DARHOL_KUT_MS kutadi; ulgurmasa navbatdan ketadi.
 */
export async function tolovXabari(payment, opts = {}) {
  try {
    if (!payment || !kirimmi(payment) || payment.type === 'Qaytarish') return null;
    if (await lokalTegmaydi(payment.schoolId)) return { holat: 'xato', sabab: XATO_SABABI.lokal, qabul: [] };
    const s = await tolovSozlamasi(payment.schoolId);
    if (!s?.sozlama.yoqilgan) return { holat: 'ochiq_emas', sabab: "To'lov xabari o'chirilgan" };
    let row;
    try {
      row = await prisma.tolovXabari.create({
        data: {
          paymentId: payment.id, schoolId: payment.schoolId, studentId: payment.studentId,
          holat: 'yuborilmoqda', keyingiUrinish: new Date(Date.now() + QULF_MS),
        },
      });
    } catch (e) {
      if (e.code === 'P2002') return qisqa(await prisma.tolovXabari.findUnique({ where: { paymentId: payment.id } }));
      throw e;
    }
    let timer;
    const natija = await Promise.race([
      yuborish(row.id, { ...opts, sozlama: s }),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), DARHOL_KUT_MS); }),
    ]).finally(() => clearTimeout(timer));
    if (!natija) return { id: row.id, paymentId: payment.id, holat: 'kutmoqda', sabab: "Eskiz sekin javob bermoqda — o'zi qayta urinadi", qabul: [] };
    return qisqa(natija);
  } catch (e) {
    console.error("[To'lov xabari]", e.message);
    return { holat: 'xato', sabab: e.message };
  }
}

/** To'lov o'chirilganda: hali ketmagan xabar bekor qilinadi. */
export async function tolovXabariniBekorQil(paymentId) {
  await prisma.tolovXabari.updateMany({
    where: { paymentId, holat: { in: ['kutmoqda', 'yuborilmoqda'] } },
    data: { holat: 'bekor', sabab: "To'lov o'chirildi" },
  }).catch(() => {});
}

/** Qo'lda qayta yuborish (ro'yxatdagi tugma). */
export async function qaytaYubor(rowId) {
  const row = await prisma.tolovXabari.findUnique({ where: { id: rowId } });
  if (!row) return { status: 404, error: 'Topilmadi' };
  if (['yuborildi', 'yetkazildi'].includes(row.holat)) return { status: 409, error: 'Bu xabar allaqachon yuborilgan' };
  if (row.holat === 'bekor') return { status: 409, error: "To'lov o'chirilgan — xabar yuborilmaydi" };
  if (await lokalTegmaydi(row.schoolId)) return { status: 409, error: XATO_SABABI.lokal };
  await prisma.tolovXabari.update({
    where: { id: row.id },
    // Qo'lda bosilganda urinishlar hisobi yangidan boshlanadi.
    data: { holat: 'yuborilmoqda', urinish: 0, keyingiUrinish: new Date(Date.now() + QULF_MS) },
  });
  await eskizHolatlariniYangila([row.schoolId], { majburiy: true });
  // 48 soatlik cheklov faqat avtomatik navbat uchun: xodim o'zi bossa — yuboriladi.
  return { row: qisqa(await yuborish(row.id, { qolda: true })) };
}

// ---------------------------------------------------------------------------
// Navbat: kutayotgan va qayta urinadigan xabarlar
// ---------------------------------------------------------------------------

let oxirgiEskizYangilash = 0;

/** Eskizda tekshiruvdagi shablonlar holatini yangilaydi (5 daqiqada bir). */
export async function eskizHolatlariniYangila(schoolIds, { majburiy = false } = {}) {
  if (!tr?.eskizHolatlari) return;
  if (!majburiy && Date.now() - oxirgiEskizYangilash < 5 * 60e3) return;
  oxirgiEskizYangilash = Date.now();
  const kutayotgan = await prisma.messageTemplate.findMany({
    where: { schoolId: { in: schoolIds }, eskizTemplateId: { not: null }, NOT: { eskizStatus: { in: ['service', 'reklama', 'confirmed'] } } },
    select: { id: true, schoolId: true, eskizTemplateId: true, eskizStatus: true },
  });
  if (!kutayotgan.length) return;
  const holatlar = await tr.eskizHolatlari(kutayotgan[0].schoolId).catch(() => null);
  if (!holatlar) return;
  for (const t of kutayotgan) {
    const h = holatlar.get(String(t.eskizTemplateId));
    if (h && h !== t.eskizStatus) await prisma.messageTemplate.update({ where: { id: t.id }, data: { eskizStatus: h } });
  }
}

/**
 * Navbatdagi xabarlarni yuboradi. Lazy cron (10 daqiqada bir), Vercel cron
 * va "To'lov xabari" oynasi ochilganda chaqiriladi.
 */
export async function tolovNavbati({ cheklov = 20, byudjetMs = 20000 } = {}) {
  const boshi = Date.now();
  // Lokal server faqat "ZZ " sinov filiallarining navbatiga tegadi (lokalTegmaydi).
  const lokal = !process.env.VERCEL && process.env.SMS_REAL !== '1';
  const sinovFiliallari = lokal
    ? (await prisma.school.findMany({ where: { name: { startsWith: 'ZZ ' } }, select: { id: true } })).map(s => s.id)
    : null;
  if (lokal && !sinovFiliallari.length) return { korildi: 0, yuborildi: 0 };
  const filial = sinovFiliallari ? { schoolId: { in: sinovFiliallari } } : {};
  // 48 soatdan eski, hali ketmaganlar — yakunlanadi.
  await prisma.tolovXabari.updateMany({
    where: { ...filial, holat: { in: ['kutmoqda', 'yuborilmoqda'] }, createdAt: { lt: new Date(Date.now() - MUDDAT_MS) } },
    data: { holat: 'xato', sabab: "48 soat ichida yuborib bo'lmadi — endi yuborilmaydi" },
  });
  const rows = await prisma.tolovXabari.findMany({
    where: { ...filial, holat: { in: ['kutmoqda', 'yuborilmoqda'] }, keyingiUrinish: { lte: new Date() } },
    orderBy: { id: 'asc' }, take: cheklov,
  });
  if (!rows.length) return { korildi: 0, yuborildi: 0 };
  await eskizHolatlariniYangila([...new Set(rows.map(r => r.schoolId))]);
  let yuborildi = 0;
  for (const r of rows) {
    if (Date.now() - boshi > byudjetMs) break;
    // Bir vaqtda ikki joydan olinmasin: holat va vaqt o'zgarmagan bo'lsagina.
    const band = await prisma.tolovXabari.updateMany({
      where: { id: r.id, holat: r.holat, keyingiUrinish: r.keyingiUrinish },
      data: { holat: 'yuborilmoqda', keyingiUrinish: new Date(Date.now() + QULF_MS) },
    });
    if (!band.count) continue;
    const natija = await yuborish(r.id).catch(e => { console.error("[To'lov xabari navbati]", e.message); return null; });
    if (natija?.holat === 'yuborildi') yuborildi++;
  }
  return { korildi: rows.length, yuborildi };
}

// ---------------------------------------------------------------------------
// Eskiz callback: SMS yetib bordimi
// ---------------------------------------------------------------------------

const YETKAZILDI = ['DELIVRD', 'DELIVERED'];
const YETMADI = ['UNDELIV', 'UNDELIVERABLE', 'EXPIRED', 'REJECTD', 'REJECTED', 'DELETED', 'FAILED'];

// Eskiz callback'i SMS ni qaysi yozuvdan ekanini bilmaydi: to'lov xabari ham,
// qarz eslatmasi ham (services/qarzXabari.js) shu yerda yangilanadi.
const JADVALLAR = [
  { nom: 'TolovXabari', model: () => prisma.tolovXabari },
  { nom: 'QarzXabari', model: () => prisma.qarzXabari },
];

/** Eskiz yuborgan holat bo'yicha to'lov xabari va qarz eslatmasini yangilaydi. */
export async function yetkazishHolati(eskizId, status) {
  const st = String(status || '').toUpperCase();
  const yetdi = YETKAZILDI.includes(st);
  const yetmadi = YETMADI.includes(st);
  if (!yetdi && !yetmadi) return 0;
  let jami = 0;
  for (const j of JADVALLAR) jami += await jadvaldaYetkazish(j, eskizId, st, yetdi);
  return jami;
}

async function jadvaldaYetkazish(jadval, eskizId, st, yetdi) {
  const model = jadval.model();
  const rows = await prisma.$queryRawUnsafe(`SELECT id FROM "${jadval.nom}" WHERE raqamlar @> $1::jsonb LIMIT 5`, JSON.stringify([{ eskizId }]));
  for (const { id } of rows) {
    const row = await model.findUnique({ where: { id } });
    const raqamlar = (Array.isArray(row.raqamlar) ? row.raqamlar : []).map(q => q.eskizId === eskizId
      ? { ...q, holat: yetdi ? 'yetkazildi' : 'yetkazilmadi', operator: st, vaqt: new Date().toISOString() } : q);
    const sms = raqamlar.filter(q => q.kanal === 'SMS' && q.eskizId);
    const birortasi = raqamlar.some(q => q.holat === 'yetkazildi');
    const hammasiYetmadi = sms.length > 0 && sms.every(q => q.holat === 'yetkazilmadi') && !raqamlar.some(q => q.kanal === 'TELEGRAM' && q.holat === 'yuborildi');
    await model.update({
      where: { id },
      data: {
        raqamlar,
        ...(birortasi ? { holat: 'yetkazildi', sabab: null, yetkazilganAt: row.yetkazilganAt || new Date() } : {}),
        ...(!birortasi && hammasiYetmadi ? { holat: 'yetkazilmadi', sabab: `Operator yetkazmadi (${st}) — raqam o'chiq yoki noto'g'ri bo'lishi mumkin` } : {}),
      },
    });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Ro'yxat va statistika ("To'lov xabari" oynasi)
// ---------------------------------------------------------------------------

export async function tolovXabarlariRoyxati(schoolIds, { cheklov = 40 } = {}) {
  const rows = await prisma.tolovXabari.findMany({
    where: { schoolId: { in: schoolIds } }, orderBy: { id: 'desc' }, take: cheklov,
  });
  const [students, payments] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, name: true } }),
    prisma.payment.findMany({ where: { id: { in: rows.map(r => r.paymentId) } }, select: { id: true, amount: true, type: true, date: true } }),
  ]);
  const ism = new Map(students.map(s => [s.id, s.name]));
  const tolov = new Map(payments.map(p => [p.id, p]));
  const hafta = new Date(Date.now() - 7 * 864e5);
  const guruh = await prisma.tolovXabari.groupBy({
    by: ['holat'], where: { schoolId: { in: schoolIds }, createdAt: { gte: hafta } }, _count: true,
  });
  const statistika = Object.fromEntries(guruh.map(g => [g.holat, g._count]));
  return {
    statistika,
    royxat: rows.map(r => ({
      ...qisqa(r),
      raqamlar: Array.isArray(r.raqamlar) ? r.raqamlar : [],
      studentId: r.studentId,
      ism: ism.get(r.studentId) || "o'chirilgan o'quvchi",
      summa: tolov.get(r.paymentId)?.amount ?? null,
      turi: tolov.get(r.paymentId)?.type ?? null,
      createdAt: r.createdAt, yuborilganAt: r.yuborilganAt, yetkazilganAt: r.yetkazilganAt,
      urinish: r.urinish, keyingiUrinish: r.keyingiUrinish,
    })),
  };
}

/**
 * Sinov SMS: tanlangan shablon namuna ism va summa bilan ko'rsatilgan
 * raqamga yuboriladi — butun zanjir (shablon, Eskiz, balans) ishlashini
 * bitta SMS bilan tekshirish uchun.
 */
export async function sinovXabari(schoolId, telefon) {
  const tel = uzRaqam(telefon);
  if (!tel) return { status: 400, error: "Telefon raqami noto'g'ri" };
  const s = await tolovSozlamasi(schoolId);
  const shablon = s?.shablonlar.find(t => t.id === s.sozlama.shablonId);
  if (!shablon) return { status: 400, error: 'Shablon tanlanmagan' };
  if (!eskizYuboradi(shablon.eskizStatus)) return { status: 400, error: "Eskiz shablonni hali tasdiqlamagan — SMS yetib bormaydi" };
  const orgName = await markazNomi(schoolId);
  const matn = smsMatni(fillTemplate(shablon.body, { name: 'Alimov Jasur', balance: 0, customPaymentAmount: 500000, lastPaymentAmount: 500000 }, [], { orgName }));
  const r = tr?.sms ? await tr.sms(tel, matn, { schoolId, studentId: null }) : { success: false, xato: 'SMS ulanmagan' };
  return r.success ? { ok: true, matn } : { status: 502, error: `SMS ketmadi: ${XATO_SABABI[xatoTuri(r.xato)] || r.xato}` };
}

export async function eskizBalansi(schoolId) {
  if (!tr?.eskizBalans) return null;
  return tr.eskizBalans(schoolId).catch(() => null);
}
