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
// Payme ilovasi katalogi: to'lovchi o'quvchi raqamini (va ixtiyoriy kursni)
// kiritadi — buyurtmasiz, "накопительный" hisob. Bitta kassada ikkala
// maydon ham bo'ladi: havola `order_id` yuboradi, katalog `student_id`.
export const STUDENT_FIELD = 'student_id';
export const COURSE_FIELD = 'course_id';
export const TIMEOUT_MS = 43_200_000;          // 12 soat — protokol talabi
export const ORDER_TTL_MS = 7 * 24 * 3600_000; // havola shuncha amal qiladi
export const MIN_AMOUNT = 1_000;               // so'm
export const MAX_AMOUNT = 50_000_000;          // so'm — xato kiritishdan himoya
export const MODES = ['off', 'test', 'live'];
// Kassa hisob maydonlari: 'order' — order_id (buyurtma kodi, bir martalik);
// 'student' — jamg'armali hisob, student_id + course_id (Payme tavsiyasi);
// 'student_only' — faqat student_id. 2026-09-23 dan pul faqat balansga tushadi
// (kursga biriktirilmaydi), shuning uchun kurs maydoni ortiqcha: kassadan
// o'chirilsa shu sxema tanlanadi. Kelgan so'rovda course_id bo'lsa ham qabul
// qilinadi — bu faqat havola qanday yasalishini belgilaydi.
export const SCHEMES = ['order', 'student', 'student_only'];
// developer.help.paycom.uz → "Песочница": chek yuborish manzili sandbox uchun
// https://test.paycom.uz, jonli uchun https://checkout.paycom.uz.
export const CHECKOUT_HOST = { live: 'https://checkout.paycom.uz', test: 'https://test.paycom.uz' };
// Timestamp — 13 xonali musbat son (ms). Undan kattasi BIGINT ga ham sig'maydi.
const MAX_TIMESTAMP = 9_999_999_999_999;

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
  /** @param plainMessage SetFiscalData uchun: `message` lokalizatsiyasiz oddiy satr. */
  constructor(code, message, data, plainMessage = false) {
    super(typeof message === 'string' ? message : message.uz);
    this.code = code;
    this.rpcMessage = typeof message === 'string' ? { uz: message, ru: message, en: message } : message;
    this.data = data;
    this.plainMessage = plainMessage;
  }
}

const msg = (uz, ru, en) => ({ uz, ru, en });

export const ERR = {
  notPost: () => new PaymeError(-32300, msg('Faqat POST', 'Метод запроса не POST', 'Request method must be POST')),
  parse: () => new PaymeError(-32700, msg('JSON o\'qib bo\'lmadi', 'Ошибка разбора JSON', 'Parse error')),
  request: (what = '') => new PaymeError(-32600, msg(`So'rov noto'g'ri ${what}`.trim(), `Неверный запрос ${what}`.trim(), `Invalid request ${what}`.trim())),
  // Hujjat: "-32601 ... имя запрашиваемого метода содержится в поле data".
  method: (name = '') => new PaymeError(-32601, msg('Metod topilmadi', 'Метод не найден', 'Method not found'), String(name).slice(0, 64)),
  auth: () => new PaymeError(-32504, msg('Ruxsat yo\'q', 'Недостаточно привилегий', 'Insufficient privileges')),
  // Baza, fayl tizimi, kutilmagan holat — "системная ошибка". Payme buni
  // vaqtinchalik deb biladi va so'rovni qayta yuboradi.
  system: () => new PaymeError(-32400, msg('Tizim xatosi', 'Системная ошибка', 'System error')),
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
  studentNotFound: (field = STUDENT_FIELD) => new PaymeError(-31055, msg("O'quvchi topilmadi — raqamni tekshiring", 'Ученик не найден — проверьте номер', 'Student not found — check the number'), field),
  courseNotFound: (field = COURSE_FIELD) => new PaymeError(-31056, msg("Bu o'quvchi bunday kursda o'qimaydi", 'Ученик не учится на этом курсе', 'Student is not enrolled in this course'), field),
  // Buyurtmada boshqa faol tranzaksiya bor. Sandbox ("CreateTransaction с новой
  // транзакцией, состояние счёта «В ожидании оплаты»") -31050..-31099 kutadi —
  // hujjat matnidagi -31008 emas; Payme'ning PHP shablonida ham -31050.
  orderBusy: () => new PaymeError(-31057, msg("Bu buyurtma bo'yicha to'lov jarayonda — biroz kutib qayta urinib ko'ring", 'По этому заказу уже идёт оплата — повторите позже', 'Payment for this order is already in progress'), ACCOUNT_FIELD),
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
export function checkoutUrl({ merchantId, mode, orderId, account, amount, returnUrl }) {
  const host = CHECKOUT_HOST[mode === 'test' ? 'test' : 'live'];
  const acc = account || { [ACCOUNT_FIELD]: orderId };
  const parts = [`m=${merchantId}`, ...Object.entries(acc).map(([k, v]) => `ac.${k}=${v}`), `a=${amount * 100}`, 'l=uz'];
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
 * `Authorization: Basic base64("login:KEY")`. Hujjat: login Payme texnik
 * mutaxassisidan olinadi (odatda "Paycom"), parol — kassaning 36 belgili
 * kaliti. Sir — kalit; login solishtirilmaydi, aks holda Payme boshqa login
 * bersa hamma so'rov rad etilardi. Kalitda ':' bo'lishi mumkin — birinchi
 * ':' dan bo'linadi.
 */
export function checkBasicAuth(header, expectedKey) {
  if (!expectedKey || typeof header !== 'string') return false;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/.exec(header);
  if (!m) return false;
  let decoded;
  try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  return safeEqual(decoded.slice(i + 1), expectedKey);
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

  // 2026-09-23 dan pul faqat balansga tushadi: to'lovchi kurs tanlamaydi.
  // Kassada hali course_id maydoni bor ('student' sxemasi) — havola to'g'ri
  // bo'lishi uchun o'quvchining birinchi kursi jimgina qo'yiladi. Pulga ta'siri
  // yo'q: Payment baribir kurssiz yoziladi (PerformTransaction).
  let group = null;
  if (groupId) {
    group = student.groups.find(g => g.id === Number(groupId));
    if (!group) return { error: "Kurs o'quvchiniki emas" };
  } else if (settings.paymeScheme === 'student') {
    group = [...student.groups].sort((a, b) => a.id - b.id)[0] || null;
  }
  if (settings.paymeScheme === 'student' && !group) {
    return { error: "Payme uchun kurs kerak — o'quvchi hech bir kursda emas" };
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
  // 'student' sxemasida kassa order_id ni bilmaydi: havola o'quvchi va kurs
  // raqamini yuboradi, tranzaksiya kelganda buyurtmaga server o'zi bog'laydi.
  // 'student_only' — kassada kurs maydoni yo'q, faqat o'quvchi raqami ketadi.
  const account = settings.paymeScheme === 'student_only'
    ? { [STUDENT_FIELD]: order.studentId }
    : settings.paymeScheme === 'student' && order.groupId
      ? { [STUDENT_FIELD]: order.studentId, [COURSE_FIELD]: order.groupId }
      : { [ACCOUNT_FIELD]: order.id };
  return checkoutUrl({
    merchantId: settings.paymeMerchantId,
    mode: settings.paymeMode,
    account,
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
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v > MAX_TIMESTAMP) throw ERR.request(`(${name})`);
  return v;
}

function requireOrderId(params) {
  const raw = params?.account?.[ACCOUNT_FIELD];
  const id = typeof raw === 'string' ? raw.trim().toUpperCase() : (typeof raw === 'number' ? String(raw) : '');
  if (!isOrderId(id)) throw ERR.orderNotFound();
  return id;
}

const hasField = (params, f) => !!params?.account && params.account[f] !== undefined && params.account[f] !== null && params.account[f] !== '';

/** "ABDUHAYEVA SHAHNOZA ERKIN QIZI" → "ABDUHAYEVA S." — tasdiqlash uchun yetarli, ortiqcha oshkor emas. */
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

/**
 * CRM'dagi kurs nomi (bazada Group): "Matematika 2-Guruh". Nomida fan yo'q
 * bo'lsa fan bilan: "Turk tili (DEMO Kechki guruh)". `group.course.name` kerak.
 */
export function kursLabel(group) {
  if (!group) return '';
  const fan = group.course?.name || '';
  if (!fan || group.name.toLowerCase().includes(fan.toLowerCase())) return group.name;
  return `${fan} (${group.name})`;
}

/** CheckPerformTransaction `additional`: kim uchun va qaysi kurs uchun. */
async function payerInfo(acc) {
  // Faqat o'quvchi: pul balansga tushadi, kurs ko'rsatilmaydi (2026-09-23).
  const student = acc.student ? acc.student : await prisma.student.findUnique({ where: { id: acc.studentId }, select: { name: true } });
  return { oquvchi: shortName(student?.name) };
}

/**
 * O'quvchi kodi: "299" (o'quvchi raqami) yoki "299-7" (o'quvchi va kurs raqami;
 * kurs — CRM'dagi kurs, bazada Group.id). Ajratuvchi: "-", "/" yoki bo'sh joy.
 * Kod bo'lmasa null. Buyurtma kodi (16 belgi) bunga hech qachon mos kelmaydi.
 */
export function parseStudentCode(raw) {
  const m = /^(\d{1,9})(?:\s*[-\/\s]\s*(\d{1,9}))?$/.exec(String(raw ?? '').trim());
  if (!m) return null;
  return { studentId: Number(m[1]), kursId: m[2] ? Number(m[2]) : null };
}

/**
 * Payme ilovasida to'lov: to'lovchi o'quvchi raqamini (va ixtiyoriy kurs
 * raqamini) o'zi yozadi, summani ham o'zi kiritadi (накопительный hisob).
 * `field` / `courseField` — qiymat qaysi maydondan kelgani: xato `data` si
 * hujjat bo'yicha aynan shu maydon nomi bo'lishi kerak.
 * Kurs berilsa o'quvchi aynan shu kursda o'qishi shart; berilmasa va bitta
 * kursda o'qisa — o'sha kurs; bir nechta bo'lsa — "umumiy" to'lov
 * (groupId/courseId null, hamyon qoidasi).
 */
async function loadCatalogAccount(db, { field, courseField, studentId, kursId }, schoolId, settings, amountTiyin) {
  if (!Number.isInteger(studentId) || studentId <= 0) throw ERR.studentNotFound(field);
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId, NOT: { status: 'Ochirilgan' } },
    select: { id: true, name: true, groups: { select: { id: true, courseId: true } } },
  });
  if (!student) throw ERR.studentNotFound(field);

  requireInt(amountTiyin, 'amount');
  if (amountTiyin % 100 !== 0) throw ERR.amount();
  const amount = amountTiyin / 100;
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) throw ERR.amount();

  let group = null;
  if (kursId !== null) {
    group = student.groups.find(g => g.id === kursId) || null;
    if (!group) throw ERR.courseNotFound(courseField);
  } else if (student.groups.length === 1) {
    group = student.groups[0];
  }
  return {
    kind: 'catalog', student, amount,
    studentId: student.id, groupId: group?.id ?? null, courseId: group?.courseId ?? null,
    test: settings.paymeMode === 'test',
  };
}

/**
 * Hisobni aniqlash. Payme kassasida bitta majburiy maydon — `order_id`
 * (Payme maydonni ixtiyoriy qila olmaydi), unga ikki xil qiymat keladi:
 *   - havola/QR: 16 belgili buyurtma kodi (summa va kurs buyurtmada);
 *   - Payme ilovasi: ota-ona yozgan o'quvchi kodi "299" yoki "299-7".
 * Format bilan aniq ajraladi. Kassada alohida `student_id`/`course_id`
 * maydonlari sozlansa, ular ham qabul qilinadi.
 */
async function resolveAccount(db, params, schoolId, settings, amountTiyin, now) {
  if (hasField(params, ACCOUNT_FIELD)) {
    const code = parseStudentCode(params.account[ACCOUNT_FIELD]);
    if (code) {
      const acc = await loadCatalogAccount(db, { field: ACCOUNT_FIELD, courseField: ACCOUNT_FIELD, ...code }, schoolId, settings, amountTiyin);
      acc.account = { [ACCOUNT_FIELD]: code.kursId !== null ? `${code.studentId}-${code.kursId}` : String(code.studentId) };
      return acc;
    }
    const orderId = requireOrderId(params);
    const order = await loadPayableOrder(db, orderId, schoolId, settings, amountTiyin, now);
    return {
      kind: 'order', order, amount: order.amount, account: { [ACCOUNT_FIELD]: orderId },
      studentId: order.studentId, groupId: order.groupId, courseId: order.courseId, test: order.test,
    };
  }
  if (hasField(params, STUDENT_FIELD)) {
    const rawId = String(params.account[STUDENT_FIELD]).trim();
    const studentId = /^\d{1,9}$/.test(rawId) ? Number(rawId) : NaN;
    let kursId = null;
    if (hasField(params, COURSE_FIELD)) {
      const rawC = String(params.account[COURSE_FIELD]).trim();
      if (!/^\d{1,9}$/.test(rawC)) throw ERR.courseNotFound(COURSE_FIELD);
      kursId = Number(rawC);
    }
    const acc = await loadCatalogAccount(db, { field: STUDENT_FIELD, courseField: COURSE_FIELD, studentId, kursId }, schoolId, settings, amountTiyin);
    acc.account = { [STUDENT_FIELD]: String(acc.studentId) };
    if (kursId !== null) acc.account[COURSE_FIELD] = String(kursId);
    // Botdan yoki CRM'dan yaratilgan havola ('student' sxemasi): shu o'quvchi,
    // kurs va summa bo'yicha ochiq buyurtma bo'lsa, tranzaksiya unga bog'lanadi —
    // /pay sahifasi va so'ragan chatga xabar avvalgidek ishlaydi.
    if (acc.groupId) {
      const match = await db.paymeOrder.findFirst({
        where: { schoolId, studentId: acc.studentId, groupId: acc.groupId, amount: acc.amount, status: 'new', test: acc.test, expiresAt: { gt: new Date(now) } },
        orderBy: { createdAt: 'asc' },
      });
      if (match) acc.order = match;
    }
    return acc;
  }
  throw ERR.orderNotFound();
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

/**
 * Fiskal chek qatori. Hujjat bo'yicha `code` (IKPU), `package_code` va
 * `vat_percent` majburiy — ikkala kod ham kiritilgan bo'lsagina yuboriladi,
 * yarim to'ldirilgan `detail` Payme tomonida chekni buzadi.
 */
async function receiptDetail(settings, { courseId, amount }) {
  if (!settings.paymeMxik || !settings.paymePackageCode) return undefined;
  const course = courseId ? await prisma.course.findUnique({ where: { id: courseId }, select: { name: true } }) : null;
  return {
    receipt_type: 0,
    items: [{
      title: course ? `${course.name} — o'quv xizmati` : "O'quv xizmati",
      price: amount * 100,
      count: 1,
      code: settings.paymeMxik,
      package_code: settings.paymePackageCode,
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
      const acc = await resolveAccount(prisma, params, schoolId, settings, params?.amount, now);
      const detail = await receiptDetail(settings, acc);
      // To'lovchi kim uchun va qaysi kurs uchun to'layotganini ko'rsin. Faqat
      // qisqa ism va kurs nomi — qarz, guruh, ustoz emas (katalogda ID ketma-ket
      // raqam, terib chiqish oson). Payme `additional` ni sahifada ko'rsatishi
      // uchun buni ularning texnik mutaxassisiga aytish kerak (hujjat talabi).
      const result = { allow: true, additional: await payerInfo(acc) };
      if (detail) result.detail = detail;
      return { result, orderId: acc.order?.id, studentId: acc.studentId };
    }

    case 'CreateTransaction': {
      const id = requireId(params);
      const time = requireInt(params.time, 'time');
      // Qulf kaliti: buyurtma bo'lsa buyurtma (bitta faol tranzaksiya), aks
      // holda Payme tranzaksiya ID si (takroriy so'rovlar navbatga turadi).
      const lockKey = hasField(params, ACCOUNT_FIELD) && !parseStudentCode(params.account[ACCOUNT_FIELD]) ? requireOrderId(params) : id;

      const result = await prisma.$transaction(async (db) => {
        // Parallel so'rovlar navbatga turadi. Qulf tranzaksiya bilan ochiladi.
        // $executeRaw: funksiya `void` qaytaradi, $queryRaw uni o'qiy olmaydi.
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const existing = await db.paymeTransaction.findUnique({ where: { paymeId: id } });
        if (existing) {
          if (existing.schoolId !== schoolId) throw ERR.notFound();
          if (existing.state !== STATE.CREATED) throw ERR.cannotPerform('Tranzaksiya faol emas', 'Транзакция не активна', 'Transaction is not active');
          if (expired(existing.paymeTime, now)) throw await expireTx(existing.id, now);
          return { create_time: toNum(existing.createTime), transaction: String(existing.id), state: STATE.CREATED };
        }

        const acc = await resolveAccount(db, params, schoolId, settings, params.amount, now);
        if (expired(time, now)) throw ERR.cannotPerform('Tranzaksiya muddati o\'tgan', 'Срок транзакции истёк', 'Transaction expired');

        if (acc.kind === 'order') {
          // Bir buyurtma — bir vaqtda bitta faol tranzaksiya. Katalogda cheklov
          // yo'q: накопительный hisobga pul istalgancha marta tushadi.
          const active = await db.paymeTransaction.findFirst({ where: { orderId: acc.order.id, state: STATE.CREATED } });
          if (active) throw ERR.orderBusy();
        }

        const row = await db.paymeTransaction.create({
          data: {
            paymeId: id, orderId: acc.order?.id ?? null, schoolId,
            studentId: acc.studentId, groupId: acc.groupId, courseId: acc.courseId,
            test: acc.test, account: acc.account,
            amount: acc.amount, state: STATE.CREATED,
            paymeTime: BigInt(time), createTime: BigInt(now),
          },
        });
        return { create_time: now, transaction: String(row.id), state: STATE.CREATED, _orderId: acc.order?.id, _studentId: acc.studentId };
      }, { timeout: 15_000 });
      const { _orderId, _studentId, ...rpc } = result;
      return { result: rpc, orderId: _orderId, studentId: _studentId, paymeId: id };
    }

    case 'PerformTransaction': {
      const id = requireId(params);
      const out = await prisma.$transaction(async (db) => {
        const tx = await db.paymeTransaction.findUnique({ where: { paymeId: id }, include: { order: { select: { chatId: true, source: true } } } });
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
        if (!tx.test && tx.studentId) {
          // Pul kursga biriktirilgan: groupId/courseId tranzaksiyada (buyurtmadan
          // yoki katalogdagi tanlovdan). courseId null — "umumiy" to'lov, hamyon.
          // Yozuv turi 'Peyme' — kassa uni naqd emas deb hisoblaydi.
          const payment = await db.payment.create({
            data: {
              studentId: tx.studentId,
              amount: tx.amount,
              type: 'Peyme',
              date: toDateStr(new Date(now)),
              description: tx.orderId ? `Payme orqali to'lov (${id})` : `Payme ilovasi orqali to'lov (${id})`,
              // Pul faqat balansga (egasi, 2026-09-23) — kurslarga balansdan
              // o'quvchining taqsimot qoidasi bo'yicha yechiladi.
              groupId: null,
              courseId: null,
              schoolId,
            },
          });
          await db.student.update({ where: { id: tx.studentId }, data: { balance: { increment: tx.amount } } });
          paymentId = payment.id;
        }
        // updateMany + status 'new': jamg'armali hisobda bitta buyurtmaga ikki
        // tranzaksiya bog'lanib qolsa, birinchi to'lov yozuvi ustidan yozilmaydi.
        if (tx.orderId) await db.paymeOrder.updateMany({ where: { id: tx.orderId, status: 'new' }, data: { status: 'paid', paymentId } });
        await db.paymeTransaction.update({ where: { id: tx.id }, data: { paymentId } });
        return {
          result: { transaction: String(tx.id), perform_time: now, state: STATE.PERFORMED },
          fresh: { kind: 'performed', tx, amount: tx.amount, paymentId },
        };
      }, { timeout: 15_000 });
      return { ...out, paymeId: id, orderId: out.fresh?.tx?.orderId, studentId: out.fresh?.tx?.studentId };
    }

    case 'CancelTransaction': {
      const id = requireId(params);
      const reason = Number.isInteger(params?.reason) ? params.reason : null;
      const out = await prisma.$transaction(async (db) => {
        const tx = await db.paymeTransaction.findUnique({ where: { paymeId: id }, include: { order: { select: { chatId: true, source: true } } } });
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
          // Sandbox'ning 2-ssenariysi o'tgan tranzaksiyani bekor qilishni
          // kutadi — test buyurtmasida sozlama e'tiborga olinmaydi (pul yo'q).
          if (!settings.paymeAllowRefund && !tx.test) throw ERR.cannotCancel();
          const r = await db.paymeTransaction.updateMany({
            where: { id: tx.id, state: STATE.PERFORMED },
            data: { state: STATE.CANCELLED_AFTER_PERFORM, reason, cancelTime: BigInt(now) },
          });
          if (r.count === 0) {
            const again = await db.paymeTransaction.findUnique({ where: { id: tx.id } });
            return { result: { transaction: String(tx.id), cancel_time: toNum(again.cancelTime), state: again.state } };
          }
          let refundPaymentId = null;
          if (!tx.test && tx.studentId) {
            // Pul to'lovchiga qaytdi: manfiy 'Qaytarish' yozuvi. Avans
            // sarflangan bo'lsa allocation.js buni alohida qarz qilib qo'yadi.
            const refund = await db.payment.create({
              data: {
                studentId: tx.studentId,
                amount: -tx.amount,
                type: 'Qaytarish',
                date: toDateStr(new Date(now)),
                description: `Payme to'lovi bekor qilindi (${id})`,
                groupId: null,
                courseId: null,
                schoolId,
              },
            });
            await db.student.update({ where: { id: tx.studentId }, data: { balance: { decrement: tx.amount } } });
            refundPaymentId = refund.id;
          }
          if (tx.orderId) await db.paymeOrder.update({ where: { id: tx.orderId }, data: { status: 'refunded' } });
          await db.paymeTransaction.update({ where: { id: tx.id }, data: { refundPaymentId } });
          return {
            result: { transaction: String(tx.id), cancel_time: now, state: STATE.CANCELLED_AFTER_PERFORM },
            fresh: { kind: 'refunded', tx, amount: tx.amount, refundPaymentId },
          };
        }

        // Allaqachon bekor qilingan — o'sha natija.
        return { result: { transaction: String(tx.id), cancel_time: toNum(tx.cancelTime), state: tx.state } };
      }, { timeout: 15_000 });
      return { ...out, paymeId: id, orderId: out.fresh?.tx?.orderId, studentId: out.fresh?.tx?.studentId };
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
      // Hujjat: qidiruv Payme'dagi yaratilish vaqti (`time`) bo'yicha,
      // from <= time <= to, o'sish tartibida. Yaratilmay qolgan (xato bilan
      // tugagan) tranzaksiyalar bazada yo'q, demak ro'yxatga tushmaydi.
      const rows = await prisma.paymeTransaction.findMany({
        where: { schoolId, paymeTime: { gte: BigInt(from), lte: BigInt(to) } },
        orderBy: [{ paymeTime: 'asc' }, { id: 'asc' }],
        take: 5000,
      });
      return {
        result: {
          transactions: rows.map(tx => ({
            id: tx.paymeId,
            time: toNum(tx.paymeTime),
            amount: tx.amount * 100,
            account: tx.account || { [ACCOUNT_FIELD]: tx.orderId },
            ...txResult(tx),
            receivers: null,
          })),
        },
      };
    }

    case 'SetFiscalData': {
      // Ixtiyoriy metod: chek fiskallashtirilgach Payme uni yuboradi (PERFORM
      // yoki CANCEL). Bu metodning xato formati boshqacha — `message` oddiy satr.
      const id = requireId(params);
      const type = params?.type;
      const data = params?.fiscal_data;
      if ((type !== 'PERFORM' && type !== 'CANCEL') || !data || typeof data !== 'object' || Array.isArray(data)) {
        throw new PaymeError(-32602, "Noto'g'ri parametrlar (type yoki fiscal_data)", undefined, true);
      }
      const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId: id } });
      if (!tx || tx.schoolId !== schoolId) throw new PaymeError(-32001, 'Chek topilmadi', undefined, true);
      const fiscal = {};
      for (const k of ['receipt_id', 'status_code', 'message', 'terminal_id', 'fiscal_sign', 'qr_code_url', 'date']) {
        if (data[k] !== undefined) fiscal[k] = typeof data[k] === 'string' ? data[k].slice(0, 500) : data[k];
      }
      // Oplata va bekor cheklari GNK tomonida alohida — alohida saqlanadi.
      await prisma.paymeTransaction.update({
        where: { id: tx.id },
        data: type === 'PERFORM' ? { fiscalPerform: fiscal } : { fiscalCancel: fiscal },
      });
      return { result: { success: true }, paymeId: id, orderId: tx.orderId };
    }

    default:
      throw ERR.method(method);
  }
}

export function rpcError(id, err) {
  const e = err instanceof PaymeError ? err : ERR.system();
  const message = e.plainMessage ? e.rpcMessage.uz : e.rpcMessage;
  return { jsonrpc: '2.0', id: id ?? null, error: { code: e.code, message, ...(e.data ? { data: e.data } : {}) } };
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
    for (const k of ['id', 'time', 'amount', 'reason', 'from', 'to', 'type']) {
      if (params[k] !== undefined) slim[k] = typeof params[k] === 'string' ? params[k].slice(0, 64) : params[k];
    }
    // account faqat bizning maydonlarimiz bilan — yot/katta obyekt jurnalga tushmasin.
    if (params.account && typeof params.account === 'object') {
      slim.account = {};
      for (const f of [ACCOUNT_FIELD, STUDENT_FIELD, COURSE_FIELD]) {
        if (params.account[f] !== undefined) slim.account[f] = String(params.account[f] ?? '').slice(0, 32);
      }
    }
  }
  return { method: typeof body.method === 'string' ? body.method.slice(0, 64) : body.method, id: body.id, params: slim };
}
