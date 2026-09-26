// Klik to'lovi — administrator tasdig'i (egasi, 2026-09-24): xodim chekdagi
// sana-vaqtni kiritadi, administrator bank ilovasida pul kelganini ko'rib
// tasdiqlaydi. Tasdiqlanmaguncha Payment yozilmaydi.
//
// 2026-09-26 (egasi): "klik orqali to'lov kelganda telegramga kelmayapdi,
// telegramda bitirish kerak tasdiqlashlarni" — administratorga Telegram'da
// tugmali xabar boradi va u shu yerning o'zida tasdiqlaydi yoki rad etadi.
// "Bitta o'quvchi bitta to'lovni ikkinchi marta olib kelsa ogohlantirish
// kelsin" — takroriy chek xabarda va CRM ro'yxatida ko'rsatiladi.
//
// CRM marshrutlari (server.js) ham, bot (src/bot/klikTasdiq.js) ham shu
// fayldagi bitta funksiyalarni chaqiradi — qoida ikki joyda bir xil.
import { Markup } from 'telegraf';
import prisma from '../lib/prisma.js';
import { tolovXabari } from './tolovXabari.js';
import { kodBer } from './oquvchiKod.js';

export const KLIK_TASDIQ_TURLARI = ['Klik'];
export const TASDIQ_HOLATLARI = ['kutilmoqda', 'tasdiqlandi', 'rad etildi', "o'chirildi"];

/** Rad etishning tayyor sabablari (Telegram'da bitta bosish bilan). */
export const TAYYOR_SABABLAR = ['Pul kelmagan', 'Summa boshqa', 'Takroriy chek'];

/** Toshkent vaqti "YYYY-MM-DDTHH:mm" ko'rinishida (chekdagi vaqt). */
export function chekVaqtiniTozala(v) {
  const s = String(v || '').trim().replace(' ', 'T').slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const [soat, daq] = [Number(s.slice(11, 13)), Number(s.slice(14, 16))];
  return soat <= 23 && daq <= 59 && !Number.isNaN(Date.parse(s.slice(0, 10))) ? s : null;
}
export const chekVaqtiMatni = (s) => s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}` : '';

const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\s/g, ' ');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const daqiqa = (s) => Date.parse(`${s}:00Z`) / 60000;

/** Shu filial va tashkilotdagi boshqa filiallar. */
async function tashkilotFiliallari(schoolId) {
  const own = Number(schoolId);
  const s = await prisma.school.findUnique({ where: { id: own }, select: { organizationId: true } });
  if (!s?.organizationId) return [own];
  const rows = await prisma.school.findMany({ where: { organizationId: s.organizationId }, select: { id: true } });
  return [own, ...rows.map(r => r.id).filter(id => id !== own)];
}

// ---------------------------------------------------------------------------
// Takroriy chek
// ---------------------------------------------------------------------------

/**
 * Shu chek avval ham kiritilganmi. Qaytaradi: [{ tur, id, studentId,
 * studentName, amount, paidAt, status, createdByName, reviewedByName, reason }]
 *  - 'aynan'  — shu o'quvchi, chekdagi vaqt aynan bir xil;
 *  - 'yaqin'  — shu o'quvchi, shu summa, vaqt 5 daqiqagacha farq qiladi
 *               (vaqtni bir-ikki daqiqaga adashib yozgan bo'lishi mumkin);
 *  - 'boshqa' — BOSHQA o'quvchiga aynan shu vaqt va summa bilan (bitta chek
 *               ikki bolaga ko'rsatilgan).
 * To'lovi o'chirilgan chek hisobga olinmaydi — uni qayta kiritish joiz.
 * Administrator o'zi kiritgan Klik ham shu jadvalda turadi (tasdiqlangan).
 */
export async function takroriyCheklar({ id = null, schoolId, studentId, paidAt, amount }) {
  if (!paidAt || !studentId) return [];
  const filiallar = await tashkilotFiliallari(schoolId);
  const summa = Number(amount) || 0;
  const rows = await prisma.tolovTasdiq.findMany({
    where: {
      paidAt: { startsWith: paidAt.slice(0, 10) },
      status: { not: "o'chirildi" },
      schoolId: { in: filiallar },
      ...(id ? { id: { not: id } } : {}),
      OR: [{ studentId: Number(studentId) }, ...(summa > 0 ? [{ amount: summa }] : [])],
    },
    orderBy: { id: 'asc' },
    take: 30,
  });
  const t = daqiqa(paidAt);
  const topildi = [];
  for (const r of rows) {
    let tur = null;
    if (r.studentId === Number(studentId)) {
      if (r.paidAt === paidAt) tur = 'aynan';
      else if (summa > 0 && r.amount === summa && Math.abs(daqiqa(r.paidAt) - t) <= 5) tur = 'yaqin';
    } else if (r.paidAt === paidAt && summa > 0 && r.amount === summa) {
      tur = 'boshqa';
    }
    if (tur) topildi.push({ tur, r });
  }
  if (!topildi.length) return [];
  const ismlar = new Map((await prisma.student.findMany({
    where: { id: { in: [...new Set(topildi.map(x => x.r.studentId))] } },
    select: { id: true, name: true },
  })).map(s => [s.id, s.name]));
  return topildi.map(({ tur, r }) => ({
    tur, id: r.id, studentId: r.studentId, studentName: ismlar.get(r.studentId) || null,
    amount: r.amount, paidAt: r.paidAt, status: r.status, createdAt: r.createdAt,
    createdByName: r.createdByName, reviewedByName: r.reviewedByName, reason: r.reason,
  }));
}

const HOLAT_MATNI = { kutilmoqda: 'tasdiq kutmoqda', tasdiqlandi: 'tasdiqlangan', 'rad etildi': 'rad etilgan' };

/** Takror haqida qisqa qatorlar (Telegram va CRM uchun bir xil matn). */
export function takrorQatorlari(takrorlar) {
  return (takrorlar || []).map(x => {
    const holat = HOLAT_MATNI[x.status] || x.status;
    const kim = x.status === 'kutilmoqda' ? (x.createdByName ? `kiritdi ${x.createdByName}` : '') : (x.reviewedByName || '');
    const qoshimcha = [holat, kim, x.status === 'rad etildi' && x.reason ? `sabab: ${x.reason}` : ''].filter(Boolean).join(', ');
    if (x.tur === 'boshqa') return `Shu chek (${chekVaqtiMatni(x.paidAt)}, ${som(x.amount)} so'm) boshqa o'quvchiga ham kiritilgan: ${x.studentName || '—'} — ${qoshimcha}`;
    if (x.tur === 'yaqin') return `Shu o'quvchiga deyarli shu vaqtda (${chekVaqtiMatni(x.paidAt)}) shu summa ${som(x.amount)} so'm allaqachon kiritilgan — ${qoshimcha}`;
    return `Bu chek (${chekVaqtiMatni(x.paidAt)}) shu o'quvchiga avval ham kiritilgan: ${som(x.amount)} so'm — ${qoshimcha}`;
  });
}

// ---------------------------------------------------------------------------
// Tasdiqlash / rad etish
// ---------------------------------------------------------------------------

/**
 * Administrator tasdig'i. `row` — hali "kutilmoqda" bo'lgan qator (chaqiruvchi
 * ruxsatni tekshirgan). Ikki joydan (CRM va Telegram) bir vaqtda bosilsa ham
 * bitta to'lov: holat faqat "kutilmoqda" dan o'zgaradi.
 * @returns {{ ok: true, payment, xabar } | { status, error }}
 */
export async function tasdiqniBajar(row, reviewer) {
  const student = await prisma.student.findUnique({ where: { id: row.studentId }, select: { id: true, name: true } });
  if (!student) return { status: 404, error: "O'quvchi o'chirilgan — to'lovni rad eting" };

  const payment = await prisma.$transaction(async (tx) => {
    const band = await tx.tolovTasdiq.updateMany({
      where: { id: row.id, status: 'kutilmoqda' },
      data: { status: 'tasdiqlandi', reviewedById: reviewer.id > 0 ? reviewer.id : null, reviewedByName: reviewer.name || null, reviewedAt: new Date() },
    });
    if (band.count === 0) return null;
    const p = await tx.payment.create({
      data: {
        studentId: row.studentId, amount: row.amount, type: row.type,
        date: row.paidAt.slice(0, 10),
        description: [`Chek: ${chekVaqtiMatni(row.paidAt)}`, row.createdByName ? `kiritdi ${row.createdByName}` : '', row.note || ''].filter(Boolean).join(' · ').slice(0, 500),
        groupId: null, courseId: null, schoolId: row.schoolId,
      },
    });
    await tx.student.update({ where: { id: row.studentId }, data: { balance: { increment: row.amount } } });
    await tx.tolovTasdiq.update({ where: { id: row.id }, data: { paymentId: p.id } });
    return p;
  });
  if (!payment) return { status: 409, error: "Bu to'lov allaqachon ko'rib chiqilgan" };

  const xabar = await tolovXabari(payment);
  await qarorniTarqat({ ...row, status: 'tasdiqlandi', reviewedByName: reviewer.name, reviewedAt: new Date() }, student.name, reviewer);
  return { ok: true, payment, xabar, studentName: student.name };
}

/** Rad etish — sabab majburiy. */
export async function radniBajar(row, reason, reviewer) {
  const sabab = String(reason || '').trim().slice(0, 300);
  if (!sabab) return { status: 400, error: 'Rad etish sababini yozing' };
  const band = await prisma.tolovTasdiq.updateMany({
    where: { id: row.id, status: 'kutilmoqda' },
    data: { status: 'rad etildi', reason: sabab, reviewedById: reviewer.id > 0 ? reviewer.id : null, reviewedByName: reviewer.name || null, reviewedAt: new Date() },
  });
  if (band.count === 0) return { status: 409, error: "Bu to'lov allaqachon ko'rib chiqilgan" };
  const student = await prisma.student.findUnique({ where: { id: row.studentId }, select: { name: true } });
  await qarorniTarqat({ ...row, status: 'rad etildi', reason: sabab, reviewedByName: reviewer.name, reviewedAt: new Date() }, student?.name, reviewer);
  return { ok: true, reason: sabab };
}

/** Telegram orqali qilingan qaror amallar jurnaliga ham yoziladi (CRM dagisi middleware orqali). */
export async function jurnalgaYoz(row, reviewer, amal, sabab = '') {
  try {
    const student = await prisma.student.findUnique({ where: { id: row.studentId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        schoolId: row.schoolId,
        userId: reviewer.id > 0 ? reviewer.id : null,
        userName: reviewer.name || null,
        userRole: reviewer.role || null,
        action: 'action',
        entity: 'tolovTasdiq',
        entityId: row.id,
        title: student?.name || null,
        summary: (amal === 'tasdiqlandi'
          ? `${row.type} to'lovi tasdiqlandi (Telegram) · ${som(row.amount)} so'm · balansga tushdi`
          : `${row.type} to'lovi rad etildi (Telegram) · ${som(row.amount)} so'm · ${sabab}`).slice(0, 500),
        link: `/students/${row.studentId}`,
        method: 'TELEGRAM',
        path: `/telegram/tolov-tasdiq/${row.id}/${amal === 'tasdiqlandi' ? 'tasdiqlash' : 'rad'}`,
      },
    });
  } catch (e) { console.error('[Klik tasdiq] jurnal:', e.message); }
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

/**
 * Tasdiqlay oladigan administratorlarning Telegram chatlari: tashkilotdagi
 * har bir ADMIN (u barcha filiallarni boshqaradi), ikkala raqami bilan.
 * Ilgari xabar faqat shu filialning admin/menejeriga borardi — Langar
 * filialidan kiritilgan Klik hech kimga yetmasdi.
 */
export async function adminChatlari(schoolId) {
  const filiallar = await tashkilotFiliallari(schoolId);
  const adminlar = await prisma.user.findMany({
    where: {
      role: 'ADMIN', status: { not: 'Arxiv' },
      OR: [{ schoolId: { in: filiallar } }, { branches: { some: { id: { in: filiallar } } } }],
    },
    select: { telegramId: true, telegramId2: true },
  });
  return [...new Set(adminlar.flatMap(a => [a.telegramId, a.telegramId2]).filter(Boolean).map(String))];
}

/** Shu Telegram hisobi shu qatorni tasdiqlay oladigan administratormi. */
export async function tasdiqlovchimi(user, row) {
  if (!user || user.role !== 'ADMIN' || user.status === 'Arxiv') return false;
  const filiallar = await tashkilotFiliallari(row.schoolId);
  return filiallar.includes(user.schoolId);
}

async function xabarMatni(row, { studentName, holatQatori = '' } = {}) {
  const [student, school, takrorlar, kod] = await Promise.all([
    studentName ? null : prisma.student.findUnique({ where: { id: row.studentId }, select: { name: true } }),
    prisma.school.findUnique({ where: { id: row.schoolId }, select: { name: true } }),
    row.status === 'kutilmoqda' ? takroriyCheklar(row) : [],
    kodBer(row.studentId).catch(() => null),
  ]);
  const filiallar = await tashkilotFiliallari(row.schoolId);
  const qatorlar = [
    row.status === 'kutilmoqda' ? `🧾 <b>${esc(row.type)} to'lovi — tasdiqlang</b>` : `🧾 <b>${esc(row.type)} to'lovi</b>`,
    `👤 ${esc(studentName || student?.name || "O'quvchi")}${kod ? ` (ID ${kod})` : ''}`,
    `💰 <b>${som(row.amount)} so'm</b>`,
    `🕒 Chekdagi vaqt: <b>${chekVaqtiMatni(row.paidAt)}</b>`,
    filiallar.length > 1 && school?.name ? `🏫 ${esc(school.name)}` : '',
    `✍️ Kiritdi: ${esc(row.createdByName || '—')}`,
    row.note ? `📝 ${esc(row.note)}` : '',
  ].filter(Boolean);
  if (takrorlar.length) {
    qatorlar.push('', '⚠️ <b>DIQQAT — TAKROR CHEK</b>', ...takrorQatorlari(takrorlar).map(q => `• ${esc(q)}`));
  }
  if (holatQatori) qatorlar.push('', holatQatori);
  else if (row.status === 'kutilmoqda') qatorlar.push('', "Bank ilovasida pul kelganini ko'rib tasdiqlang.");
  let matn = qatorlar.join('\n');
  // Rasm izohi 1024 belgigacha.
  if (matn.length > 1000) matn = matn.slice(0, 990) + '…';
  return matn;
}

/** Tasdiq kutayotgan xabarning tugmalari. */
export const kutishTugmalari = (id) => Markup.inlineKeyboard([
  [Markup.button.callback('✅ Tasdiqlash', `tt_ok_${id}`), Markup.button.callback('❌ Rad etish', `tt_rad_${id}`)],
]);

/** "Tasdiqlash" bosilgach — ikkinchi bosish (tasodifan bosilmasin). */
export const tasdiqSorovTugmalari = (id) => Markup.inlineKeyboard([
  [Markup.button.callback("✔️ Ha, pul keldi — tasdiqlash", `tt_ha_${id}`)],
  [Markup.button.callback('↩️ Orqaga', `tt_orq_${id}`)],
]);

/** "Rad etish" bosilgach — sabab. */
export const sababTugmalari = (id) => Markup.inlineKeyboard([
  ...TAYYOR_SABABLAR.map((s, i) => [Markup.button.callback(s, `tt_s_${id}_${i}`)]),
  [Markup.button.callback('✏️ Boshqa sabab yozish', `tt_sb_${id}`)],
  [Markup.button.callback('↩️ Orqaga', `tt_orq_${id}`)],
]);

const botOl = async (schoolId) => {
  const { getTelegramBot } = await import('../src/bot/bot.js');
  return getTelegramBot(schoolId);
};

/**
 * Yangi Klik to'lovini administratorlarga yuboradi (chek rasmi bo'lsa rasm
 * bilan). Yuborilgan xabarlar qatorga yoziladi — qaror chiqqach tugmalar
 * hammasidan olib tashlanadi.
 * @returns {{ yuborildi: number, sabab?: string }}
 */
export async function adminlargaYubor(row) {
  try {
    const bot = await botOl(row.schoolId);
    if (!bot) return { yuborildi: 0, sabab: 'Telegram bot sozlanmagan' };
    const chatlar = await adminChatlari(row.schoolId);
    if (!chatlar.length) return { yuborildi: 0, sabab: 'Administrator Telegram botga ulanmagan' };
    const matn = await xabarMatni(row);
    const tugma = kutishTugmalari(row.id);
    const rasm = typeof row.receipt === 'string' && /^https?:\/\//.test(row.receipt) ? row.receipt : null;
    const yuborilgan = [];
    for (const chat of chatlar) {
      try {
        const m = rasm
          ? await bot.telegram.sendPhoto(chat, rasm, { caption: matn, parse_mode: 'HTML', ...tugma })
          : await bot.telegram.sendMessage(chat, matn, { parse_mode: 'HTML', ...tugma });
        yuborilgan.push({ chat, msg: m.message_id, rasm: !!rasm });
      } catch (e) {
        // Rasm yuklanmasa ham xabarning o'zi borsin.
        if (rasm) {
          try {
            const m = await bot.telegram.sendMessage(chat, matn, { parse_mode: 'HTML', ...tugma });
            yuborilgan.push({ chat, msg: m.message_id, rasm: false });
            continue;
          } catch { /* pastda */ }
        }
        console.error(`[Klik tasdiq] ${chat} ga yuborilmadi:`, e.message);
      }
    }
    if (yuborilgan.length) {
      await prisma.tolovTasdiq.update({ where: { id: row.id }, data: { tgXabarlar: yuborilgan } });
    }
    return { yuborildi: yuborilgan.length, ...(yuborilgan.length ? {} : { sabab: 'Telegram xabarni qabul qilmadi' }) };
  } catch (e) {
    console.error('[Klik tasdiq] adminlarga:', e.message);
    return { yuborildi: 0, sabab: e.message };
  }
}

/** Bitta Telegram xabarining matni va tugmalarini almashtiradi. */
export async function xabarniYangila(bot, x, matn, tugma) {
  const extra = { parse_mode: 'HTML', ...(tugma || { reply_markup: { inline_keyboard: [] } }) };
  try {
    if (x.rasm) await bot.telegram.editMessageCaption(x.chat, x.msg, undefined, matn, extra);
    else await bot.telegram.editMessageText(x.chat, x.msg, undefined, matn, extra);
  } catch (e) {
    if (!/message is not modified/i.test(e.message)) console.error('[Klik tasdiq] xabarni yangilab bo\'lmadi:', e.message);
  }
}

/**
 * Qaror chiqqach: administratorlarning xabarlaridan tugmalar olib tashlanadi
 * va natija yoziladi; to'lovni kiritgan xodimga (botga ulangan bo'lsa) javob.
 */
async function qarorniTarqat(row, studentName, reviewer) {
  try {
    const bot = await botOl(row.schoolId);
    if (!bot) return;
    const vaqt = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(11, 16);
    const holatQatori = row.status === 'tasdiqlandi'
      ? `✅ <b>Tasdiqlandi</b> — ${esc(reviewer.name || '')}, ${vaqt}. Pul balansga tushdi.`
      : `❌ <b>Rad etildi</b> — ${esc(reviewer.name || '')}, ${vaqt}\nSabab: ${esc(row.reason || '')}`;
    const fresh = await prisma.tolovTasdiq.findUnique({ where: { id: row.id }, select: { tgXabarlar: true } });
    const xabarlar = Array.isArray(fresh?.tgXabarlar) ? fresh.tgXabarlar : [];
    if (xabarlar.length) {
      const matn = await xabarMatni(row, { studentName, holatQatori });
      await Promise.all(xabarlar.map(x => xabarniYangila(bot, x, matn, null)));
    }

    // Kiritgan xodimga natija (u o'zi tasdiqlagan bo'lmasa).
    if (row.createdById && row.createdById !== reviewer.id) {
      const xodim = await prisma.user.findUnique({ where: { id: row.createdById }, select: { telegramId: true, telegramId2: true } });
      const matn = row.status === 'tasdiqlandi'
        ? `✅ ${row.type} to'lovi tasdiqlandi: ${studentName || ''}, ${som(row.amount)} so'm (chek ${chekVaqtiMatni(row.paidAt)}). Pul balansga tushdi.`
        : `❌ ${row.type} to'lovi rad etildi: ${studentName || ''}, ${som(row.amount)} so'm (chek ${chekVaqtiMatni(row.paidAt)}).\nSabab: ${row.reason || ''}`;
      for (const chat of [xodim?.telegramId, xodim?.telegramId2].filter(Boolean)) {
        await bot.telegram.sendMessage(chat, matn).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[Klik tasdiq] qarorni tarqatish:', e.message);
  }
}
