// Payme marshrutlari: Payme webhook (JSON-RPC), CRM uchun buyurtma/havola
// API si, to'lovchi uchun ochiq holat sahifasi. Pul mantiqi services/payme.js da.

import rateLimit from 'express-rate-limit';
import { Markup } from 'telegraf';
import prisma from '../lib/prisma.js';
import { authenticate, canAccessSchool, requireRole, STAFF_MANAGERS } from '../middleware/auth.js';
import { isAdmin } from '../lib/config.js';
import * as payme from '../services/payme.js';

// Havola yaratish — to'lov qabul qiladigan xodimlar. Ustoz/haydovchi emas.
const LINK_ROLES = ['ADMIN', 'MANAGER', 'RECEPTIONIST'];

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');

/** Qaytish manzili uchun saytning o'z manzili. Lokalda http, Vercelda https. */
function appOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

function shapeOrder(o, settings, returnBase) {
  const status = payme.orderStatus(o);
  return {
    id: o.id,
    studentId: o.studentId,
    groupId: o.groupId,
    courseId: o.courseId,
    amount: o.amount,
    status,
    source: o.source,
    test: o.test,
    paymentId: o.paymentId,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    url: status === 'new' && settings ? payme.orderUrl(settings, o, returnBase) : null,
    transactions: (o.transactions || []).map(t => ({
      id: t.id, paymeId: t.paymeId, state: t.state, reason: t.reason,
      createTime: Number(t.createTime), performTime: Number(t.performTime), cancelTime: Number(t.cancelTime),
    })),
  };
}

/**
 * To'lov o'tdi / qaytarildi — ota-onaga va adminlarga Telegram xabar.
 * Payme javob kutib turibdi, shuning uchun qisqa muddat (4 s) bilan chegaralangan.
 */
async function notify(fresh, schoolId) {
  try {
    await withTimeout((async () => {
      const [student, group, settings] = await Promise.all([
        prisma.student.findUnique({
          where: { id: fresh.order.studentId },
          select: { name: true, telegramId: true, fatherTelegramId: true, motherTelegramId: true },
        }),
        fresh.order.groupId
          ? prisma.group.findUnique({ where: { id: fresh.order.groupId }, select: { name: true, course: { select: { name: true } } } })
          : null,
        prisma.setting.findUnique({ where: { schoolId }, select: { orgName: true } }),
      ]);
      if (!student) return;
      const course = group ? `${group.course?.name || ''} (${group.name})` : 'Umumiy';
      const org = settings?.orgName || 'CRM';
      const parentText = fresh.kind === 'performed'
        ? `✅ To'lov qabul qilindi\n\n💰 ${fmt(fresh.amount)} so'm\n📚 ${course}\n👤 ${student.name}\n🏫 ${org}\n💳 Payme`
        : `↩️ Payme to'lovi qaytarildi\n\n💰 ${fmt(fresh.amount)} so'm\n📚 ${course}\n👤 ${student.name}\n🏫 ${org}`;
      const adminText = fresh.kind === 'performed'
        ? `💳 Payme: ${student.name} — ${fmt(fresh.amount)} so'm (${course})`
        : `↩️ Payme QAYTARISH: ${student.name} — ${fmt(fresh.amount)} so'm (${course}). Balansdan ayirildi.`;

      const { getTelegramBot, notifyAdmins } = await import('../src/bot/bot.js');
      const bot = await getTelegramBot(schoolId);
      if (bot) {
        const targets = new Set([fresh.order.chatId, student.telegramId, student.fatherTelegramId, student.motherTelegramId].filter(Boolean));
        for (const t of targets) {
          await bot.telegram.sendMessage(t, parentText).catch(e => console.error('[payme] xabar ketmadi:', e.message));
        }
      }
      await notifyAdmins(adminText, schoolId);
    })(), 4000);
  } catch (e) {
    console.error('[payme] xabar yuborishda xato:', e.message);
  }
}

export function registerPaymeRoutes(app) {
  // Payme bir to'lov uchun 3–5 so'rov yuboradi; sandbox testi ~40 ta.
  // Kalitni qo'pol kuch bilan terishga bu yetmaydi (kalit 36 belgi).
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(200).json(payme.rpcError(req.body?.id, payme.ERR.cannotPerform("Juda ko'p so'rov", 'Слишком много запросов', 'Too many requests'))),
  });

  const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Juda ko'p so'rov" },
  });

  // -------------------------------------------------------------------------
  // Payme → biz. Har doim HTTP 200 + JSON-RPC (protokol talabi: 200 dan
  // boshqa status -32400 deb tushuniladi). Marshrut eng oxirida ro'yxatga
  // olinadi va token kamida 24 belgi — /api/payme/orders kabi CRM yo'llari
  // bilan to'qnashmaydi.
  // -------------------------------------------------------------------------
  const webhook = async (req, res) => {
    const started = Date.now();
    const body = req.body;
    const ip = payme.normalizeIp(req.ip);
    const rpcId = body && typeof body === 'object' && !Array.isArray(body) ? (body.id ?? null) : null;
    let settings = null;
    let response;
    let meta = { ok: false };

    try {
      const token = String(req.params.token || '');
      if (token.length < 16 || token.length > 128) throw payme.ERR.auth();
      settings = await prisma.setting.findFirst({ where: { paymeEndpointToken: token } });
      // Noto'g'ri token, o'chirilgan rejim, yot IP, noto'g'ri kalit — hammasi
      // bir xil javob: tashqaridan qaysi biri ekanini bilib bo'lmasin.
      if (!settings || !payme.isConfigured(settings)) throw payme.ERR.auth();
      if (settings.paymeMode === 'live' && settings.paymeIpCheck && !payme.isPaymeIp(ip)) throw payme.ERR.auth();
      if (!payme.checkBasicAuth(req.headers.authorization, payme.keyForMode(settings))) throw payme.ERR.auth();

      if (!body || typeof body !== 'object' || Array.isArray(body)) throw payme.ERR.request();
      if (typeof body.method !== 'string' || !body.method) throw payme.ERR.request('(method)');
      const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};

      const out = await payme.handleRpc({ settings, method: body.method, params });
      response = payme.rpcResult(rpcId, out.result);
      meta = { ok: true, paymeId: out.paymeId, orderId: out.orderId, fresh: out.fresh };
    } catch (err) {
      const known = err instanceof payme.PaymeError;
      // Kutilmagan xato (baza, kod) — hujjat bo'yicha -32400 "системная ошибка":
      // Payme uni vaqtinchalik deb biladi va so'rovni qayta yuboradi.
      if (!known) console.error('[payme] ichki xato:', err);
      response = payme.rpcError(rpcId, known ? err : payme.ERR.system());
      meta = { ok: false, errorCode: response.error.code };
    }

    // Avval jurnal, keyin javob: serverless muhitda javobdan keyingi ish
    // to'xtatib qo'yilishi mumkin, moliyaviy iz esa yo'qolmasligi kerak.
    await payme.writeLog({
      schoolId: settings?.schoolId ?? null,
      method: body?.method,
      paymeId: meta.paymeId || body?.params?.id,
      orderId: meta.orderId || body?.params?.account?.[payme.ACCOUNT_FIELD],
      ip,
      ok: meta.ok,
      errorCode: meta.errorCode,
      request: payme.logSafeRequest(body),
      response: response.error
        ? { error: { code: response.error.code, message: typeof response.error.message === 'string' ? response.error.message : response.error.message.uz } }
        : { result: response.result },
      durationMs: Date.now() - started,
    });
    if (meta.fresh && settings) await notify(meta.fresh, settings.schoolId);

    res.status(200).json(response);
  };

  // JSON buzuq kelsa express.json xato tashlaydi; Payme uchun bu -32700.
  app.use((err, req, res, next) => {
    if (req.path.startsWith('/api/payme/') && req.method === 'POST' && err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      return res.status(200).json(payme.rpcError(null, payme.ERR.parse()));
    }
    next(err);
  });

  // -------------------------------------------------------------------------
  // Ochiq: to'lovchi qaytib kelgan sahifa holatni so'raydi. Faqat holat va
  // summa — ism, telefon, o'quvchi ID si yo'q.
  // -------------------------------------------------------------------------
  app.get('/api/public/payme/orders/:id', publicLimiter, async (req, res, next) => {
    try {
      const id = String(req.params.id || '').toUpperCase();
      if (!payme.isOrderId(id)) return res.status(404).json({ error: 'Topilmadi' });
      const order = await prisma.paymeOrder.findUnique({
        where: { id },
        select: { id: true, amount: true, status: true, test: true, expiresAt: true, schoolId: true, updatedAt: true },
      });
      if (!order) return res.status(404).json({ error: 'Topilmadi' });
      const setting = await prisma.setting.findUnique({ where: { schoolId: order.schoolId }, select: { orgName: true } });
      res.json({
        id: order.id,
        amount: order.amount,
        status: payme.orderStatus(order),
        test: order.test,
        expiresAt: order.expiresAt,
        orgName: setting?.orgName || '',
      });
    } catch (e) { next(e); }
  });

  // -------------------------------------------------------------------------
  // CRM: buyurtma (havola) yaratish va boshqarish
  // -------------------------------------------------------------------------
  app.post('/api/payme/orders', authenticate, requireRole(...LINK_ROLES), async (req, res, next) => {
    try {
      const studentId = parseInt(req.body.studentId);
      if (!Number.isInteger(studentId)) return res.status(400).json({ error: "O'quvchi ko'rsatilmagan" });
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
      if (!student) return res.status(404).json({ error: "O'quvchi topilmadi" });
      if (!(await canAccessSchool(req.user, student.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });

      const groupId = req.body.groupId ? parseInt(req.body.groupId) : null;
      const r = await payme.createOrder({
        schoolId: student.schoolId,
        studentId: student.id,
        groupId: Number.isInteger(groupId) && groupId > 0 ? groupId : null,
        amount: Math.round(Number(req.body.amount)),
        source: 'crm',
        createdById: Number.isInteger(req.user.id) && req.user.id > 0 ? req.user.id : null,
        returnBase: appOrigin(req),
      });
      if (r.error) return res.status(400).json({ error: r.error });
      const settings = await payme.loadSettings(student.schoolId);
      res.json({ order: shapeOrder({ ...r.order, transactions: [] }, settings, appOrigin(req)), url: r.url });
    } catch (e) { next(e); }
  });

  app.get('/api/payme/orders', authenticate, requireRole(...LINK_ROLES), async (req, res, next) => {
    try {
      const studentId = parseInt(req.query.studentId);
      if (!Number.isInteger(studentId)) return res.status(400).json({ error: 'studentId required' });
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
      if (!student) return res.status(404).json({ error: "O'quvchi topilmadi" });
      if (!(await canAccessSchool(req.user, student.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
      const [orders, settings] = await Promise.all([
        prisma.paymeOrder.findMany({
          where: { studentId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { transactions: { orderBy: { id: 'desc' } } },
        }),
        payme.loadSettings(student.schoolId),
      ]);
      res.json(orders.map(o => shapeOrder(o, payme.isConfigured(settings) ? settings : null, appOrigin(req))));
    } catch (e) { next(e); }
  });

  // Havolani o'quvchi/ota-onaning Telegramiga yuborish.
  app.post('/api/payme/orders/:id/send', authenticate, requireRole(...LINK_ROLES), async (req, res, next) => {
    try {
      const id = String(req.params.id || '').toUpperCase();
      if (!payme.isOrderId(id)) return res.status(404).json({ error: 'Buyurtma topilmadi' });
      const order = await prisma.paymeOrder.findUnique({
        where: { id },
        include: { student: { select: { name: true, telegramId: true, fatherTelegramId: true, motherTelegramId: true } } },
      });
      if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
      if (!(await canAccessSchool(req.user, order.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
      if (payme.orderStatus(order) !== 'new') return res.status(400).json({ error: 'Bu havola endi amal qilmaydi' });

      const settings = await payme.loadSettings(order.schoolId);
      if (!payme.isConfigured(settings)) return res.status(400).json({ error: 'Payme sozlanmagan' });

      const targets = [
        { id: order.student.telegramId, who: order.student.name },
        { id: order.student.fatherTelegramId, who: `${order.student.name} (otasi)` },
        { id: order.student.motherTelegramId, who: `${order.student.name} (onasi)` },
      ].filter(t => t.id);
      if (!targets.length) return res.status(400).json({ error: "O'quvchi ham, ota-onasi ham botga ulanmagan" });

      const { getTelegramBot } = await import('../src/bot/bot.js');
      const bot = await getTelegramBot(order.schoolId);
      if (!bot) return res.status(400).json({ error: 'Telegram bot sozlanmagan' });

      const [group, setting] = await Promise.all([
        order.groupId ? prisma.group.findUnique({ where: { id: order.groupId }, select: { name: true, course: { select: { name: true } } } }) : null,
        prisma.setting.findUnique({ where: { schoolId: order.schoolId }, select: { orgName: true } }),
      ]);
      const url = payme.orderUrl(settings, order, appOrigin(req));
      const course = group ? `${group.course?.name || ''} (${group.name})` : 'Umumiy';
      const until = new Date(order.expiresAt).toLocaleDateString('ru-RU');
      const text = `💳 ${setting?.orgName || 'CRM'}\n\n${order.student.name} — ${course}\n💰 ${fmt(order.amount)} so'm${order.test ? '\n⚠️ TEST rejim (haqiqiy pul emas)' : ''}\n\nPayme orqali to'lash uchun tugmani bosing. Havola ${until} gacha amal qiladi.`;
      const extra = Markup.inlineKeyboard([[Markup.button.url("💳 Payme orqali to'lash", url)]]);

      const sent = [], failed = [];
      for (const t of targets) {
        try { await bot.telegram.sendMessage(t.id, text, extra); sent.push(t.who); }
        catch (e) { failed.push(t.who); console.error('[payme] havola ketmadi:', e.message); }
      }
      res.json({ sent, failed });
    } catch (e) { next(e); }
  });

  // Hali to'lanmagan havolani o'chirish (Payme uni endi qabul qilmaydi).
  app.post('/api/payme/orders/:id/cancel', authenticate, requireRole(...LINK_ROLES), async (req, res, next) => {
    try {
      const id = String(req.params.id || '').toUpperCase();
      if (!payme.isOrderId(id)) return res.status(404).json({ error: 'Buyurtma topilmadi' });
      const order = await prisma.paymeOrder.findUnique({ where: { id }, include: { transactions: { where: { state: payme.STATE.CREATED } } } });
      if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
      if (!(await canAccessSchool(req.user, order.schoolId))) return res.status(403).json({ error: 'Ruxsat yo\'q' });
      if (order.status !== 'new') return res.status(400).json({ error: 'Bu buyurtmani bekor qilib bo\'lmaydi' });
      if (order.transactions.length) return res.status(400).json({ error: "To'lov jarayoni ketyapti — hozir bekor qilib bo'lmaydi" });
      const updated = await prisma.paymeOrder.update({ where: { id }, data: { status: 'cancelled' } });
      res.json(shapeOrder({ ...updated, transactions: [] }, null, ''));
    } catch (e) { next(e); }
  });

  // -------------------------------------------------------------------------
  // Admin: tranzaksiyalar va jurnal (Sozlamalar → Payme)
  // -------------------------------------------------------------------------
  app.get('/api/payme/transactions', authenticate, requireRole(...STAFF_MANAGERS), async (req, res, next) => {
    try {
      const schoolId = parseInt(req.query.schoolId);
      if (!Number.isInteger(schoolId)) return res.status(400).json({ error: 'schoolId required' });
      const rows = await prisma.paymeTransaction.findMany({
        where: { schoolId },
        orderBy: { id: 'desc' },
        take: Math.min(parseInt(req.query.limit) || 50, 200),
        include: { order: { select: { studentId: true, amount: true, source: true, test: true, groupId: true, student: { select: { name: true } } } } },
      });
      const groupIds = [...new Set(rows.map(r => r.order.groupId).filter(Boolean))];
      const groups = groupIds.length ? await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }) : [];
      const gname = new Map(groups.map(g => [g.id, g.name]));
      res.json(rows.map(t => ({
        id: t.id, paymeId: t.paymeId, orderId: t.orderId, amount: t.amount, state: t.state, reason: t.reason,
        createTime: Number(t.createTime), performTime: Number(t.performTime), cancelTime: Number(t.cancelTime),
        paymentId: t.paymentId, refundPaymentId: t.refundPaymentId,
        fiscalUrl: t.fiscalPerform?.qr_code_url || null,
        studentId: t.order.studentId, studentName: t.order.student?.name || '', groupName: gname.get(t.order.groupId) || '',
        source: t.order.source, test: t.order.test,
      })));
    } catch (e) { next(e); }
  });

  app.get('/api/payme/logs', authenticate, async (req, res, next) => {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ error: 'Faqat administrator' });
      const schoolId = parseInt(req.query.schoolId);
      if (!Number.isInteger(schoolId)) return res.status(400).json({ error: 'schoolId required' });
      const rows = await prisma.paymeLog.findMany({
        where: { schoolId },
        orderBy: { id: 'desc' },
        take: Math.min(parseInt(req.query.limit) || 50, 200),
        select: { id: true, method: true, paymeId: true, orderId: true, ip: true, ok: true, errorCode: true, durationMs: true, createdAt: true },
      });
      res.json(rows);
    } catch (e) { next(e); }
  });

  // Webhook manzilining maxfiy qismini almashtirish. Yangi manzil Payme
  // kabinetiga ham kiritilishi kerak — eskisi darhol ishlamay qoladi.
  app.post('/api/payme/rotate-endpoint', authenticate, async (req, res, next) => {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ error: 'Faqat administrator' });
      const schoolId = parseInt(req.body.schoolId);
      if (!Number.isInteger(schoolId)) return res.status(400).json({ error: 'schoolId required' });
      const token = payme.generateEndpointToken();
      await prisma.setting.upsert({
        where: { schoolId },
        update: { paymeEndpointToken: token },
        create: { schoolId, orgName: 'QUANTUM EDU', paymeEndpointToken: token },
      });
      res.json({ paymeEndpointToken: token });
    } catch (e) { next(e); }
  });

  app.post('/api/payme/:token([A-Za-z0-9_-]{24,128})', webhookLimiter, webhook);
  // Hujjat: POST bo'lmagan so'rov — -32300. Token tekshirilmaydi, shuning
  // uchun bu javob manzil mavjudligini ham oshkor qilmaydi.
  app.all('/api/payme/:token([A-Za-z0-9_-]{24,128})', webhookLimiter, (req, res) => {
    res.status(200).json(payme.rpcError(null, payme.ERR.notPost()));
  });
}
