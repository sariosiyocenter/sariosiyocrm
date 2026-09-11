// Payme (Paycom) Merchant API — protokol va pul mantiqi.
//
// Ishlash tartibi:
//   1. CRM (xodim) yoki bot (ota-ona) `createOrder()` bilan buyurtma yaratadi:
//      o'quvchi + guruh + summa. Payme'ga faqat buyurtmaning tasodifiy ID si
//      va summa ketadi — ism, telefon, o'quvchi ID si ketmaydi.
//   2. To'lovchi `checkoutUrl()` havolasida Payme sahifasida karta kiritadi.
//      Karta ma'lumotlari bizga hech qachon kelmaydi.
//   3. Payme bizning webhook'ga JSON-RPC so'rovlar yuboradi (`handleRpc`):
//      CheckPerformTransaction → CreateTransaction → PerformTransaction.
//      Summa buyurtmadagi bilan tiyinigacha solishtiriladi — havolani
//      o'zgartirib boshqa summa to'lab bo'lmaydi.
//   4. PerformTransaction bitta DB tranzaksiyasida: holat 1→2 (atomar,
//      `updateMany WHERE state = 1`), `Payment` (Peyme, kursga biriktirilgan)
//      yoziladi, balans oshadi. Payme bir so'rovni qayta yuborsa ikkinchi
//      marta kreditlanmaydi.
//
// Xavfsizlik qatlamlari (har biri alohida yetarli emas, birga ishlaydi):
//   - webhook manzilida maxfiy token (/api/payme/<token>) — taxmin qilinmaydi;
//   - Basic auth kaliti doimiy-vaqtli solishtiriladi (timingSafeEqual);
//   - jonli rejimda faqat Payme IP manzillari;
//   - test/live rejim: test kaliti jonli rejimda qabul qilinmaydi, test
//     buyurtmasi jonli rejimda to'lanmaydi (aks holda pul kelib, balans
//     oshmay qolardi);
//   - har bir so'rov PaymeLog ga yoziladi (Authorization sarlavhasisiz).
//
// Summalar: bazada so'm (butun son), Payme bilan tiyinda (x100).

import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { decryptSecret } from '../lib/secrets.js';
import { toDateStr } from '../lib/lessons.js';

export const ACCOUNT_FIELD = 'order_id';
export const TIMEOUT_MS = 43_200_000;          // 12 soat — protokol talabi
export const ORDER_TTL_MS = 7 * 24 * 3600_000; // havola shuncha amal qiladi
export const MIN_AMOUNT = 1_000;               // so'm
export const MAX_AMOUNT = 50_000_000;          // so'm — xato kiritishdan himoya
export const MODES = ['off', 'test', 'live'];
export const CHECKOUT_HOST = { live: 'https://checkout.paycom.uz', test: 'https://checkout.test.paycom.uz' };

// Payme so'rovlarni faqat shu manzillardan yuboradi (developer.help.paycom.uz,
// "Схема взаимодействия"). O'zgarsa — sozlamalarda tekshiruvni o'chirib turish mumkin.
export const PAYME_IPS = Array.from({ length: 15 }, (_, i) => `185.234.113.${i + 1}`);

export const STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1, CANCELLED_AFTER_PERFORM: -2 };
export const REASON_TIMEOUT = 4;

// ---------------------------------------------------------------------------
// Xatolar. Payme uch tilda xabar kutadi; -3105x oralig'i "hisob (buyurtma)
// xatosi" — Payme bu xabarni to'lovchiga ko'rsatadi, shuning uchun tushunarli
// bo'lishi kerak.
// ---------------------------------------------------------------------------

export class PaymeError extends Error {
  constructor(code, message, data) {
    super(typeof message === 'string' ? message : message.uz);
    this.code = code;
    this.rpcMessage = typeof message === 'string' ? { uz: message, ru: message, en: message } : message;
    this.data = data;
  }
}

const msg = (uz, ru, en) => ({ uz, ru, en });

export const ERR = {
  parse: () => new PaymeError(-32700, msg('JSON o\'qib bo\'lmadi', 'Ошибка разбора JSON', 'Parse error')),
  request: (what = '') => new PaymeError(-32600, msg(`So'rov noto'g'ri ${what}`.trim(), `Неверный запрос ${what}`.trim(), `Invalid request ${what}`.trim())),
  method: () => new PaymeError(-32601, msg('Metod topilmadi', 'Метод не найден', 'Method not found')),
  auth: () => new PaymeError(-32504, msg('Ruxsat yo\'q', 'Недостаточно привилегий', 'Insufficient privileges')),
  amount: () => new PaymeError(-31001, msg('Summa noto\'g\'ri', 'Неверная сумма', 'Invalid amount')),
  notFound: () => new PaymeError(-31003, msg('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found')),
  cannotCancel: () => new PaymeError(-31007, msg('To\'lovni bekor qilib bo\'lmaydi', 'Невозможно отменить транзакцию', 'Unable to cancel transaction')),
  cannotPerform: (uz = 'Amalni bajarib bo\'lmaydi', ru = 'Невозможно выполнить операцию', en = 'Unable to perform operation') =>
    new PaymeError(-31008, msg(uz, ru, en)),
  orderNotFound: () => new PaymeError(-31050, msg('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'), ACCOUNT_FIELD),
  orderExpired: () => new PaymeError(-31051, msg('Havola muddati o\'tgan — yangi havola oling', 'Срок ссылки истёк — запросите новую', 'Payment link expired — request a new one'), ACCOUNT_FIELD),
  orderPaid: () => new PaymeError(-31052, msg('Bu buyurtma allaqachon to\'langan', 'Этот заказ уже оплачен', 'This order is already paid'), ACCOUNT_FIELD),
  orderClosed: () => new PaymeError(-31053, msg('Buyurtma bekor qilingan', 'Заказ отменён', 'Order cancelled'), ACCOUNT_FIELD),
  orderMode: () => new PaymeError(-31054, msg('Buyurtma boshqa rejimda yaratilgan', 'Заказ создан в другом режиме', 'Order was created in a different mode'), ACCOUNT_FIELD),
};

// ---------------------------------------------------------------------------
// Tokenlar va havola
// ---------------------------------------------------------------------------

// Crockford base32 — 0/O, 1/I/L kabi o'xshash belgilar yo'q, telefonda
// ko'rsatilsa ham adashtirmaydi. 16 belgi = 80 bit tasodif.
const ORDER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function generateOrderId() {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (const b of bytes) out += ORDER_ALPHABET[b & 31];
  return out;
}

export const isOrderId = (s) => typeof s === 'string' && /^[0-9A-HJKMNP-TV-Z]{16}$/.test(s);

export function generateEndpointToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Payme kassa sahifasi havolasi. Parametrlar base64 ichida:
 *   m — merchant ID, ac.order_id — buyurtma, a — summa (tiyin), l — til,
 *   c — to'lovdan keyin qaytish manzili, ct — qaytishgacha kutish (ms).
 */
export function checkoutUrl({ merchantId, mode, orderId, amount, returnUrl }) {
  const host = CHECKOUT_HOST[mode === 'test' ? 'test' : 'live'];
  const parts = [`m=${merchantId}`, `ac.${ACCOUNT_FIELD}=${orderId}`, `a=${amount * 100}`, 'l=uz'];
  if (returnUrl) parts.push(`c=${returnUrl}`, 'ct=15000');
  return `${host}/${Buffer.from(parts.join(';'), 'utf8').toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Sozlamalar va autentifikatsiya
// ---------------------------------------------------------------------------

/** Kesh yo'q — kalit almashtirilsa darhol kuchga kirsin. */
export async function loadSettings(schoolId) {
  return prisma.setting.findUnique({ where: { schoolId: Number(schoolId) } });
}

export const isConfigured = (s) => !!(s && s.paymeMerchantId && MODES.includes(s.paymeMode) && s.paymeMode !== 'off');

/** Joriy rejimga mos kalit. Test kaliti jonli rejimda hech qachon qabul qilinmaydi. */
export function keyForMode(settings) {
  if (!settings) return null;
  if (settings.paymeMode === 'live') return decryptSecret(settings.paymeKey) || null;
  if (settings.paymeMode === 'test') return decryptSecret(settings.paymeTestKey) || null;
  return null;
}

function digest(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest();
}

/** Uzunligi har xil satrlarni ham doimiy vaqtda solishtiradi. */
export function safeEqual(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

/**
 * `Authorization: Basic base64("Paycom:KEY")`. Login har doim "Paycom".
 * Kalitda ':' bo'lishi mumkin — birinchi ':' dan bo'linadi.
 */
export function checkBasicAuth(header, expectedKey) {
  if (!expectedKey || typeof header !== 'string') return false;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/.exec(header);
  if (!m) return false;
  let decoded;
  try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const loginOk = safeEqual(decoded.slice(0, i), 'Paycom');
  const keyOk = safeEqual(decoded.slice(i + 1), expectedKey);
  return loginOk && keyOk;
}

export function normalizeIp(ip) {
  const s = String(ip || '');
  return s.startsWith('::ffff:') ? s.slice(7) : s;
}

export const isPaymeIp = (ip) => PAYME_IPS.includes(normalizeIp(ip));

// ---------------------------------------------------------------------------
// Buyurtma
// ---------------------------------------------------------------------------

export function validateAmount(amount) {
  const n = Number(amount);
  if (!Number.isInteger(n)) return "Summa butun son bo'lishi kerak";
  if (n < MIN_AMOUNT) return `Eng kam summa ${MIN_AMOUNT.toLocaleString('ru-RU')} so'm`;
  if (n > MAX_AMOUNT) return `Eng ko'p summa ${MAX_AMOUNT.toLocaleString('ru-RU')} so'm`;
  return null;
}

/**
 * Buyurtma yaratadi. Guruh o'quvchining guruhi bo'lishi shart — pul kursga
 * biriktiriladi (lib/allocation.js). Guruhsiz buyurtma faqat o'quvchi hech
 * qaysi guruhda bo'lmasa (umumiy hamyon).
 *
 * @returns {{ order, url, error? }}
 */
export async function createOrder({ schoolId, studentId, groupId, amount, source, createdById = null, chatId = null, returnBase = '' }) {
  const settings = await loadSettings(schoolId);
  if (!isConfigured(settings)) return { error: 'Payme sozlanmagan (Sozlamalar → Payme)' };
  if (source === 'bot' && settings.paymeMode !== 'live') return { error: 'Payme hozircha test rejimida' };

  const amountError = validateAmount(amount);
  if (amountError) return { error: amountError };

  const student = await prisma.student.findFirst({
    where: { id: Number(studentId), schoolId: Number(schoolId) },
    select: { id: true, status: true, groups: { select: { id: true, courseId: true } } },
  });
  if (!student) return { error: "O'quvchi topilmadi" };
  if (student.status === 'Ochirilgan') return { error: "O'quvchi o'chirilgan" };

  let group = null;
  if (groupId) {
    group = student.groups.find(g => g.id === Number(groupId));
    if (!group) return { error: "Guruh o'quvchiniki emas" };
  } else if (student.groups.length) {
    return { error: 'Qaysi kurs uchun ekanini tanlang' };
  }

  const order = await prisma.paymeOrder.create({
    data: {
      id: generateOrderId(),
      schoolId: Number(schoolId),
      studentId: student.id,
      groupId: group ? group.id : null,
      courseId: group ? group.courseId : null,
      amount: Number(amount),
      status: 'new',
      source,
      createdById,
      chatId: chatId ? String(chatId) : null,
      test: settings.paymeMode === 'test',
      expiresAt: new Date(Date.now() + ORDER_TTL_MS),
    },
  });
  return { order, url: orderUrl(settings, order, returnBase) };
}

export function orderUrl(settings, order, returnBase = '') {
  return checkoutUrl({
    merchantId: settings.paymeMerchantId,
    mode: settings.paymeMode,
    orderId: order.id,
    amount: order.amount,
    returnUrl: returnBase ? `${returnBase}/pay/${order.id}` : '',
  });
}

/** Buyurtmaning to'lanish holati — CRM ro'yxati va ochiq sahifa uchun. */
export function orderStatus(order) {
  if (order.status === 'new' && order.expiresAt && new Date(order.expiresAt) < new Date()) return 'expired';
  return order.status;
}

// ---------------------------------------------------------------------------
// JSON-RPC
// ---------------------------------------------------------------------------

const toNum = (v) => (typeof v === 'bigint' ? Number(v) : v);
const expired = (t, now) => now - Number(t) > TIMEOUT_MS;

/**
 * Muddati o'tgan tranzaksiyani -1/4 qiladi. Ataylab tashqi `prisma` bilan
 * (interaktiv tranzaksiya ichidagi `db` bilan emas): keyin xato tashlanadi,
 * xato esa tranzaksiyani orqaga qaytaradi — bu yozuv esa qolishi kerak.
 */
async function expireTx(txId, now) {
  await prisma.paymeTransaction.updateMany({
    where: { id: txId, state: STATE.CREATED },
    data: { state: STATE.CANCELLED, reason: REASON_TIMEOUT, cancelTime: BigInt(now) },
  });
  return ERR.cannotPerform('Tranzaksiya muddati o\'tgan', 'Срок транзакции истёк', 'Transaction expired');
}

function txResult(tx) {
  return {
    create_time: toNum(tx.createTime),
    perform_time: toNum(tx.performTime),
    cancel_time: toNum(tx.cancelTime),
    transaction: String(tx.id),
    state: tx.state,
    reason: tx.reason ?? null,
  };
}

function requireId(params) {
  const id = params?.id;
  if (typeof id !== 'string' || !id || id.length > 64) throw ERR.request('(id)');
  return id;
}

function requireInt(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) throw ERR.request(`(${name})`);
  return v;
}

function requireOrderId(params) {
  const raw = params?.account?.[ACCOUNT_FIELD];
  const id = typeof raw === 'string' ? raw.trim().toUpperCase() : (typeof raw === 'number' ? String(raw) : '');
  if (!isOrderId(id)) throw ERR.orderNotFound();
  return id;
}

/** Buyurtma bormi va shu summaga to'lasa bo'ladimi. */
async function loadPayableOrder(db, orderId, schoolId, settings, amountTiyin, now) {
  const order = await db.paymeOrder.findFirst({ where: { id: orderId, schoolId } });
  if (!order) throw ERR.orderNotFound();
  if (order.status === 'paid') throw ERR.orderPaid();
  if (order.status !== 'new') throw ERR.orderClosed();
  if (order.expiresAt.getTime() < now) throw ERR.orderExpired();
  if (order.test !== (settings.paymeMode === 'test')) throw ERR.orderMode();
  requireInt(amountTiyin, 'amount');
  if (amountTiyin !== order.amount * 100) throw ERR.amount();
  return order;
}

/** Fiskal chek qatori — IKPU kodi kiritilgan bo'lsa. */
async function receiptDetail(settings, order) {
  if (!settings.paymeMxik) return undefined;
  const course = order.courseId ? await prisma.course.findUnique({ where: { id: order.courseId }, select: { name: true } }) : null;
  return {
    receipt_type: 0,
    items: [{
      title: course ? `${course.name} — o'quv xizmati` : "O'quv xizmati",
      price: order.amount * 100,
      count: 1,
      code: settings.paymeMxik,
      package_code: settings.paymePackageCode || undefined,
      vat_percent: settings.paymeVatPercent || 0,
    }],
  };
}

/**
 * Bitta JSON-RPC so'rovni bajaradi. Autentifikatsiya allaqachon o'tgan.
 * Qaytaradi: { result } yoki tashlaydi PaymeError. `fresh` maydonlari —
 * marshrut xabar yuborishi uchun (to'lov o'tdi / qaytarildi).
 */
export async function handleRpc({ settings, method, params, now = Date.now() }) {
  const schoolId = settings.schoolId;

  switch (method) {
    case 'CheckPerformTransaction': {
      const orderId = requireOrderId(params);
      const order = await loadPayableOrder(prisma, orderId, schoolId, settings, params.amount, now);
      const detail = await receiptDetail(settings, order);
      return { result: detail ? { allow: true, detail } : { allow: true }, orderId };
    }

    case 'CreateTransaction': {
      const id = requireId(params);
      const time = requireInt(params.time, 'time');
      const orderId = requireOrderId(params);

      const result = await prisma.$transaction(async (db) => {
        // Bir buyurtma bo'yicha parallel so'rovlar navbatga turadi — ikkita
        // faol tranzaksiya yaratilib qolmaydi. Qulf tranzaksiya bilan ochiladi.
        // $executeRaw: funksiya `void` qaytaradi, $queryRaw uni o'qiy olmaydi.
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;

        const existing = await db.paymeTransaction.findUnique({ where: { paymeId: id } });
        if (existing) {
          if (existing.schoolId !== schoolId) throw ERR.notFound();
          if (existing.state !== STATE.CREATED) throw ERR.cannotPerform('Tranzaksiya faol emas', 'Транзакция не активна', 'Transaction is not active');
          if (expired(existing.paymeTime, now)) throw await expireTx(existing.id, now);
          return { create_time: toNum(existing.createTime), transaction: String(existing.id), state: STATE.CREATED };
        }

        const order = await loadPayableOrder(db, orderId, schoolId, settings, params.amount, now);
        if (expired(time, now)) throw ERR.cannotPerform('Tranzaksiya muddati o\'tgan', 'Срок транзакции истёк', 'Transaction expired');

        const active = await db.paymeTransaction.findFirst({ where: { orderId, state: STATE.CREATED } });
        if (active) throw ERR.cannotPerform("Bu buyurtma bo'yicha boshqa to'lov kutilmoqda", 'По этому заказу уже есть активная транзакция', 'Order already has an active transaction');

        const row = await db.paymeTransaction.create({
          data: {
            paymeId: id, orderId, schoolId,
            amount: order.amount, state: STATE.CREATED,
            paymeTime: BigInt(time), createTime: BigInt(now),
          },
        });
        return { create_time: now, transaction: String(row.id), state: STATE.CREATED };
      }, { timeout: 15_000 });
      return { result, orderId, paymeId: id };
    }

    case 'PerformTransaction': {
      const id = requireId(params);
      const out = await prisma.$transaction(async (db) => {
        const tx = await db.paymeTransaction.findUnique({ where: { paymeId: id }, include: { order: true } });
        if (!tx || tx.schoolId !== schoolId) throw ERR.notFound();
        if (tx.state === STATE.PERFORMED) {
          return { result: { transaction: String(tx.id), perform_time: toNum(tx.performTime), state: STATE.PERFORMED } };
        }
        if (tx.state < 0) throw ERR.cannotPerform('Tranzaksiya bekor qilingan', 'Транзакция отменена', 'Transaction is cancelled');
        if (expired(tx.paymeTime, now)) throw await expireTx(tx.id, now);

        // Atomar o'tish: parallel ikkita PerformTransaction dan faqat bittasi
        // 1 → 2 qila oladi; ikkinchisi 0 qator yangilaydi va mavjud natijani
        // qaytaradi. Shu yerda ikki marta kreditlash oldi olinadi.
        const r = await db.paymeTransaction.updateMany({
          where: { id: tx.id, state: STATE.CREATED },
          data: { state: STATE.PERFORMED, performTime: BigInt(now) },
        });
        if (r.count === 0) {
          const again = await db.paymeTransaction.findUnique({ where: { id: tx.id } });
          if (again?.state === STATE.PERFORMED) {
            return { result: { transaction: String(tx.id), perform_time: toNum(again.performTime), state: STATE.PERFORMED } };
          }
          throw ERR.cannotPerform();
        }

        let paymentId = null;
        if (!tx.order.test) {
          // Pul kursga biriktirilgan: groupId/courseId buyurtmadan. Yozuv
          // turi 'Peyme' — kassa uni naqd emas deb hisoblaydi.
          const payment = await db.payment.create({
            data: {
              studentId: tx.order.studentId,
              amount: tx.amount,
              type: 'Peyme',
              date: toDateStr(new Date(now)),
              description: `Payme orqali to'lov (${id})`,
              groupId: tx.order.groupId,
              courseId: tx.order.courseId,
              schoolId,
            },
          });
          await db.student.update({ where: { id: tx.order.studentId }, data: { balance: { increment: tx.amount } } });
          paymentId = payment.id;
        }
        await db.paymeOrder.update({ where: { id: tx.orderId }, data: { status: 'paid', paymentId } });
        await db.paymeTransaction.update({ where: { id: tx.id }, data: { paymentId } });
        return {
          result: { transaction: String(tx.id), perform_time: now, state: STATE.PERFORMED },
          fresh: { kind: 'performed', order: tx.order, amount: tx.amount, paymentId },
        };
      }, { timeout: 15_000 });
      return { ...out, paymeId: id, orderId: out.fresh?.order?.id };
    }

    case 'CancelTransaction': {
      const id = requireId(params);
      const reason = Number.isInteger(params?.reason) ? params.reason : null;
      const out = await prisma.$transaction(async (db) => {
        const tx = await db.paymeTransaction.findUnique({ where: { paymeId: id }, include: { order: true } });
        if (!tx || tx.schoolId !== schoolId) throw ERR.notFound();

        if (tx.state === STATE.CREATED) {
          const r = await db.paymeTransaction.updateMany({
            where: { id: tx.id, state: STATE.CREATED },
            data: { state: STATE.CANCELLED, reason, cancelTime: BigInt(now) },
          });
          if (r.count === 0) {
            const again = await db.paymeTransaction.findUnique({ where: { id: tx.id } });
            return { result: { transaction: String(tx.id), cancel_time: toNum(again.cancelTime), state: again.state } };
          }
          // Buyurtma 'new' ligicha qoladi — to'lovchi o'sha havola bilan
          // qayta urinishi mumkin (masalan kartada pul yetmagan).
          return { result: { transaction: String(tx.id), cancel_time: now, state: STATE.CANCELLED } };
        }

        if (tx.state === STATE.PERFORMED) {
          if (!settings.paymeAllowRefund) throw ERR.cannotCancel();
          const r = await db.paymeTransaction.updateMany({
            where: { id: tx.id, state: STATE.PERFORMED },
            data: { state: STATE.CANCELLED_AFTER_PERFORM, reason, cancelTime: BigInt(now) },
          });
          if (r.count === 0) {
            const again = await db.paymeTransaction.findUnique({ where: { id: tx.id } });
            return { result: { transaction: String(tx.id), cancel_time: toNum(again.cancelTime), state: again.state } };
          }
          let refundPaymentId = null;
          if (!tx.order.test) {
            // Pul to'lovchiga qaytdi: manfiy 'Qaytarish' yozuvi. Avans
            // sarflangan bo'lsa allocation.js buni alohida qarz qilib qo'yadi.
            const refund = await db.payment.create({
              data: {
                studentId: tx.order.studentId,
                amount: -tx.amount,
                type: 'Qaytarish',
                date: toDateStr(new Date(now)),
                description: `Payme to'lovi bekor qilindi (${id})`,
                groupId: tx.order.groupId,
                courseId: tx.order.courseId,
                schoolId,
              },
            });
            await db.student.update({ where: { id: tx.order.studentId }, data: { balance: { decrement: tx.amount } } });
            refundPaymentId = refund.id;
          }
          await db.paymeOrder.update({ where: { id: tx.orderId }, data: { status: 'refunded' } });
          await db.paymeTransaction.update({ where: { id: tx.id }, data: { refundPaymentId } });
          return {
            result: { transaction: String(tx.id), cancel_time: now, state: STATE.CANCELLED_AFTER_PERFORM },
            fresh: { kind: 'refunded', order: tx.order, amount: tx.amount, refundPaymentId },
          };
        }

        // Allaqachon bekor qilingan — o'sha natija.
        return { result: { transaction: String(tx.id), cancel_time: toNum(tx.cancelTime), state: tx.state } };
      }, { timeout: 15_000 });
      return { ...out, paymeId: id, orderId: out.fresh?.order?.id };
    }

    case 'CheckTransaction': {
      const id = requireId(params);
      const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId: id } });
      if (!tx || tx.schoolId !== schoolId) throw ERR.notFound();
      return { result: txResult(tx), paymeId: id, orderId: tx.orderId };
    }

    case 'GetStatement': {
      const from = requireInt(params?.from, 'from');
      const to = requireInt(params?.to, 'to');
      const rows = await prisma.paymeTransaction.findMany({
        where: { schoolId, createTime: { gte: BigInt(from), lte: BigInt(to) } },
        orderBy: { createTime: 'asc' },
        take: 5000,
      });
      return {
        result: {
          transactions: rows.map(tx => ({
            id: tx.paymeId,
            time: toNum(tx.paymeTime),
            amount: tx.amount * 100,
            account: { [ACCOUNT_FIELD]: tx.orderId },
            ...txResult(tx),
            receivers: null,
          })),
        },
      };
    }

    default:
      throw ERR.method();
  }
}

export function rpcError(id, err) {
  const e = err instanceof PaymeError ? err : ERR.cannotPerform();
  return { jsonrpc: '2.0', id: id ?? null, error: { code: e.code, message: e.rpcMessage, ...(e.data ? { data: e.data } : {}) } };
}

export function rpcResult(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

/** Jurnal yozuvi — Authorization sarlavhasi bu yerga kelmaydi. */
export async function writeLog(entry) {
  try {
    await prisma.paymeLog.create({
      data: {
        schoolId: entry.schoolId ?? null,
        method: entry.method ? String(entry.method).slice(0, 64) : null,
        paymeId: entry.paymeId ? String(entry.paymeId).slice(0, 64) : null,
        orderId: entry.orderId ? String(entry.orderId).slice(0, 32) : null,
        ip: entry.ip ? String(entry.ip).slice(0, 64) : null,
        ok: !!entry.ok,
        errorCode: entry.errorCode ?? null,
        request: entry.request ?? undefined,
        response: entry.response ?? undefined,
        durationMs: entry.durationMs ?? null,
      },
    });
  } catch (e) {
    console.error('[payme] jurnalga yozib bo\'lmadi:', e.message);
  }
}

/** So'rov tanasini jurnal uchun qisqartiradi (katta/yot maydonlar kesiladi). */
export function logSafeRequest(body) {
  if (!body || typeof body !== 'object') return { raw: typeof body };
  const params = body.params && typeof body.params === 'object' ? body.params : undefined;
  const slim = {};
  if (params) {
    for (const k of ['id', 'time', 'amount', 'account', 'reason', 'from', 'to']) {
      if (params[k] !== undefined) slim[k] = params[k];
    }
  }
  return { method: body.method, id: body.id, params: slim };
}
