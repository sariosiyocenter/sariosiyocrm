/**
 * Transport xabarlari: o'quvchi olinganda yoki uyiga yetkazilganda ota-onaga
 * darhol xabar.
 *
 * Bu hodisaga bog'liq xabar — kunlik jadval bo'yicha ishlaydigan
 * `AutoMessageRule` mexanizmiga to'g'ri kelmaydi. Shuning uchun yozuv
 * yozilgan ondayoq shu yerdan yuboriladi: haydovchi botdan bossa ham, admin
 * sahifadan bossa ham bir xil.
 *
 * SMS yuborish server.js dagi Eskiz funksiyasida. Uni bu yerga ko'chirish
 * xabarlar modulini qo'zg'atardi, shuning uchun server ishga tushganda
 * `smsYuboruvchiniUlash` orqali o'zini ro'yxatdan o'tkazadi. Bot ham,
 * endpoint ham bir jarayonda ishlaydi, ya'ni ikkalasi uchun ham ishlaydi.
 */
import prisma from '../lib/prisma.js';
import { toTimeStr } from '../lib/lessons.js';

/** server.js ulaydi: (phone, message, type, studentId, schoolId) => Promise */
let smsYuboruvchi = null;

export function smsYuboruvchiniUlash(fn) {
  smsYuboruvchi = fn;
}

// Vaqt O'zbekiston bo'yicha: server UTC da ishlaydi, aks holda ota-onaga
// 5 soat kam ko'rsatilardi.
const soat = toTimeStr;

/**
 * Xabar matni. Qisqa: SMS ga ham to'g'ri kelsin, ota-ona bir qarashda tushunsin.
 */
export function xabarMatni({ status, studentName, transportName, driverName, vaqt }) {
  const qism = [transportName, driverName].filter(Boolean).join(', ');
  const qavs = qism ? ` (${qism})` : '';
  if (status === 'Olib ketildi') {
    return `🚌 ${studentName} ${vaqt} da olib ketildi${qavs}`;
  }
  if (status === 'Uyiga yetkazildi') {
    return `🏠 ${studentName} ${vaqt} da uyiga yetkazildi${qavs}`;
  }
  if (status === 'Kelmadi') {
    return `❗️ ${studentName} bugun ${vaqt} da mashinaga chiqmadi`;
  }
  return `${studentName}: ${status}`;
}

/**
 * Xabarni ota-ona (va o'quvchi) Telegramiga yuboradi.
 *
 * Telegram boti bot.js da; u o'z navbatida shu faylni chaqiruvchi bilan bir
 * modulda bo'lgani uchun import dinamik — statik halqa hosil bo'lmasin.
 */
async function telegramgaYuborish({ student, matn, schoolId }) {
  const tidlar = [
    { id: student.fatherTelegramId, nom: `${student.name} (Otasi)` },
    { id: student.motherTelegramId, nom: `${student.name} (Onasi)` },
    { id: student.telegramId, nom: student.name },
  ].filter(x => x.id);

  if (tidlar.length === 0) return { yuborildi: 0 };

  const { getTelegramBot } = await import('../src/bot/bot.js');
  const bot = await getTelegramBot(schoolId);
  if (!bot) return { yuborildi: 0 };

  let yuborildi = 0;
  for (const t of tidlar) {
    try {
      await bot.telegram.sendMessage(t.id, matn);
      yuborildi++;
      await prisma.smsLog.create({
        data: {
          toPhone: String(t.id), toName: t.nom, message: matn, status: 'SENT',
          type: 'TRANSPORT', studentId: student.id, channel: 'TELEGRAM', schoolId,
        },
      }).catch(() => {});
    } catch (err) {
      await prisma.smsLog.create({
        data: {
          toPhone: String(t.id), toName: t.nom, message: matn, status: 'FAILED',
          type: 'TRANSPORT', studentId: student.id, channel: 'TELEGRAM',
          errorMsg: String(err.message || err).slice(0, 300), schoolId,
        },
      }).catch(() => {});
    }
  }
  return { yuborildi };
}

/** Ota-onaning raqamlariga SMS. */
async function smsgaYuborish({ student, matn, schoolId }) {
  if (!smsYuboruvchi) return { yuborildi: 0 };
  const raqamlar = [student.fatherPhone, student.motherPhone].filter(Boolean);
  if (raqamlar.length === 0 && student.phone) raqamlar.push(student.phone);

  let yuborildi = 0;
  for (const raqam of raqamlar) {
    try {
      const r = await smsYuboruvchi(raqam, matn, 'TRANSPORT', student.id, schoolId);
      if (r?.success) yuborildi++;
    } catch (_) { /* sendSms o'zi jurnalga yozadi */ }
  }
  return { yuborildi };
}

/**
 * Holat o'zgarganda ota-onani xabardor qiladi.
 *
 * Xato bo'lsa ham chaqiruvchini to'xtatmaydi: haydovchining tugmasi
 * xabar yuborilmagani uchun ishlamay qolmasligi kerak.
 */
export async function yetkazishXabari({ student, status, route, schoolId, vaqt = null }) {
  try {
    const settings = await prisma.setting.findUnique({
      where: { schoolId },
      select: { transportNotify: true, transportChannel: true },
    });
    if (!settings?.transportNotify) return { skipped: 'ochiq emas' };

    const kanal = settings.transportChannel || 'TELEGRAM';
    const matn = xabarMatni({
      status,
      studentName: student.name,
      transportName: route?.transport?.name || null,
      driverName: route?.driver?.name || null,
      vaqt: vaqt || soat(),
    });

    let jami = 0;
    if (kanal === 'TELEGRAM' || kanal === 'BOTH') {
      const r = await telegramgaYuborish({ student, matn, schoolId });
      jami += r.yuborildi;
    }
    // BOTH da SMS faqat Telegram ishlamasa: xabar ikki marta bormasin va
    // bekorga pul ketmasin.
    if (kanal === 'SMS' || (kanal === 'BOTH' && jami === 0)) {
      const r = await smsgaYuborish({ student, matn, schoolId });
      jami += r.yuborildi;
    }
    return { yuborildi: jami, matn };
  } catch (err) {
    console.error('[Transport xabari]', err.message);
    return { error: err.message };
  }
}
