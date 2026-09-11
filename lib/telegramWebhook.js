// Telegram webhook'ining haqiqiyligi.
//
// Telegram `setWebhook`da berilgan `secret_token`ni har bir update bilan
// `X-Telegram-Bot-Api-Secret-Token` sarlavhasida qaytaradi. Ilgari bu
// tekshirilmasdi: istalgan kishi /api/telegram-webhook/1 ga soxta update
// yuborib, admin/ustoz/haydovchi nomidan bot amallarini bajara olardi.
//
// Sir har bir filial uchun alohida (`Setting.telegramWebhookSecret`), sukut
// bo'yicha bot uchun — `TELEGRAM_WEBHOOK_SECRET` muhit o'zgaruvchisi.

import crypto from 'crypto';
import prisma from './prisma.js';

/** Telegram ruxsat bergan belgilar: A-Z a-z 0-9 _ - (1–256). base64url aynan shu. */
export function generateWebhookSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();

/** Sarlavha kutilgan sir bilan doimiy vaqtda solishtiriladi. */
export function webhookSecretOk(req, expected) {
  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (!expected || typeof header !== 'string' || !header) return false;
  return crypto.timingSafeEqual(digest(header), digest(expected));
}

/**
 * Filial botining webhook'ini sir bilan (qayta) ro'yxatdan o'tkazadi va sirni
 * saqlaydi. `url` berilmasa Telegram'da hozir turgan manzil olinadi — manzil
 * o'zgarmaydi, faqat sir qo'shiladi. So'rovdagi Host sarlavhasi hech qachon
 * ishlatilmaydi: soxta so'rov botni begona serverga burib yubora olmasin.
 *
 * @returns {{ ok: boolean, url?: string, reason?: string }}
 */
export async function registerSchoolWebhook({ schoolId, token, url }) {
  if (!token || !token.includes(':')) return { ok: false, reason: 'token yo\'q' };
  const { Telegraf } = await import('telegraf');
  const tg = new Telegraf(token.trim()).telegram;

  let target = url;
  if (!target) {
    const info = await tg.getWebhookInfo();
    target = info?.url || '';
  }
  if (!/^https:\/\//.test(target)) return { ok: false, reason: 'webhook manzili yo\'q' };

  const secret = generateWebhookSecret();
  // Avval saqlaymiz: sir bazada, keyin Telegram'da. Aksincha bo'lsa Telegram
  // sir bilan yuborib, biz hali bilmay turgan oraliq paydo bo'lardi.
  await prisma.setting.update({ where: { schoolId: Number(schoolId) }, data: { telegramWebhookSecret: secret } });
  try {
    await tg.setWebhook(target, { secret_token: secret });
  } catch (err) {
    // Telegram qabul qilmadi — sirni qaytarib olamiz, aks holda hamma update
    // 403 bo'lib, o'zini-o'zi tuzatish ham ishlamay qolardi.
    await prisma.setting.update({ where: { schoolId: Number(schoolId) }, data: { telegramWebhookSecret: null } }).catch(() => {});
    return { ok: false, reason: err.message };
  }
  return { ok: true, url: target };
}

// Bir vaqtda kelgan bir nechta update bitta filial uchun bir nechta ro'yxat
// jarayonini boshlamasin.
const inFlight = new Set();

/**
 * Siri yo'q filialdan update kelsa: uni rad etib (Telegram qayta yuboradi),
 * mavjud webhook manzilini sir bilan qayta ro'yxatdan o'tkazamiz. Keyingi
 * urinish sarlavha bilan keladi va o'tadi.
 */
export async function selfHealWebhook(schoolId, token) {
  const key = String(schoolId);
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    // Faqat hali siri yo'q filial — parallel so'rovlar bir marta kirsin.
    // 'pending' ham olinadi: oldingi urinish yarim yo'lda uzilgan bo'lishi mumkin
    // (serverless konteyner to'xtatilgan), aks holda filial abadiy 403 da qolardi.
    const claimed = await prisma.setting.updateMany({
      where: { schoolId: Number(schoolId), OR: [{ telegramWebhookSecret: null }, { telegramWebhookSecret: 'pending' }] },
      data: { telegramWebhookSecret: 'pending' },
    });
    if (claimed.count !== 1) return;
    const r = await registerSchoolWebhook({ schoolId, token });
    if (!r.ok) {
      await prisma.setting.updateMany({ where: { schoolId: Number(schoolId), telegramWebhookSecret: 'pending' }, data: { telegramWebhookSecret: null } });
      console.warn(`[telegram] ${schoolId}-filial webhook'iga sir qo'yilmadi: ${r.reason}`);
    } else {
      console.log(`[telegram] ${schoolId}-filial webhook'i sir bilan yangilandi: ${r.url}`);
    }
  } catch (err) {
    console.error('[telegram] self-heal xatosi:', err.message);
  } finally {
    inFlight.delete(key);
  }
}
