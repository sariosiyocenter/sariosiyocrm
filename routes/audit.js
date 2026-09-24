// Amallar jurnalini o'qish: kim, qachon, nimani kiritdi/o'zgartirdi/o'chirdi.
// Yozish lib/audit.js dagi middleware'da. Ko'rish faqat ADMIN'ga: jurnal —
// rahbarning xodimlar ustidan nazorat vositasi (menejer amallari ham shu yerda).

import prisma from '../lib/prisma.js';
import { authenticate, requireRole, allowedSchoolIds } from '../middleware/auth.js';
import { ENTITIES, ACTIONS } from '../lib/audit.js';

const PAGE = 50;

/** "YYYY-MM-DD" ni O'zbekiston vaqti bo'yicha kun boshi/oxiriga aylantiradi. */
function uzDay(dateStr, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return null;
  const d = new Date(`${dateStr}T${end ? '23:59:59.999' : '00:00:00'}+05:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function registerAuditRoutes(app) {
  app.get('/api/audit-logs', authenticate, async (req, res, next) => {
    try {
      const where = {};

      // Filial: tanlangani (ruxsat authenticate'da tekshirilgan) yoki 0 — barcha filiallar.
      const wanted = parseInt(req.query.schoolId);
      if (req.user.role !== 'SUPERADMIN') {
        where.schoolId = { in: wanted > 0 ? [wanted] : await allowedSchoolIds(req.user) };
      } else if (wanted > 0) {
        where.schoolId = wanted;
      }

      const from = uzDay(req.query.from, false);
      const to = uzDay(req.query.to, true);
      if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

      const userId = parseInt(req.query.userId);
      if (Number.isInteger(userId)) where.userId = userId;
      // "0" — xodimsiz yozuvlar (onlayn ariza).
      if (req.query.userId === '0') where.userId = null;
      if (req.query.entity && ENTITIES[req.query.entity]) where.entity = String(req.query.entity);
      if (req.query.action && ACTIONS[req.query.action]) where.action = String(req.query.action);

      const q = String(req.query.q || '').trim();
      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { userName: { contains: q, mode: 'insensitive' } },
        ];
      }

      // Sahifalash: oxirgi ko'rilgan yozuvdan eskisi.
      const before = parseInt(req.query.before);
      if (Number.isInteger(before)) where.id = { lt: before };

      const rows = await prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, take: PAGE + 1 });
      const items = rows.slice(0, PAGE).map(r => ({
        ...r,
        entityLabel: ENTITIES[r.entity]?.label || r.entity,
        actionLabel: ACTIONS[r.action] || r.action,
      }));
      res.json({
        items,
        nextBefore: rows.length > PAGE ? items[items.length - 1].id : null,
        entities: Object.entries(ENTITIES).map(([key, v]) => ({ key, label: v.label })),
        actions: Object.entries(ACTIONS).map(([key, label]) => ({ key, label })),
      });
    } catch (e) { next(e); }
  });
}
