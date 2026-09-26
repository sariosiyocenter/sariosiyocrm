// Davomat xabari — kurs yo'qlamasidan keyin ota-onaga (lib/davomatXabari.js).
//
// Har holat (Kelmadi, Sababli, Kechikdi, Erta ketdi, Keldi) uchun Xabarlar →
// Shablonlar dagi bitta shablon; kanal va kimga — butun markazga bitta sozlama
// (Organization.davomatXabari). Kurs sahifasidagi "Xabar yuborish" ham,
// ustozning Telegram botdagi «Saqlash»i ham shu yerdan yuboradi — ikki joyda
// ikki xil matn bo'lmasin.
//
// Yuborishning o'zi (Telegram, bo'lmasa SMS, loglar) server.js dagi
// sendToOne — server uni davomatYuboruvchiniUlash() bilan ulaydi
// (tolovXabari.js dagi kabi).

import prisma from '../lib/prisma.js';
import { fillTemplate } from '../lib/xabarMatni.js';
import { markazNomi } from '../lib/markazBrendi.js';
import { holatKaliti, sozlamaniTozala, shablonTaxmini, STANDART_SOZLAMA, KANALLAR } from '../lib/davomatXabari.js';

let yuboruvchi = null;

export function davomatYuboruvchiniUlash(fn) {
  yuboruvchi = fn;
}

async function tashkilot(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, organizationId: true, organization: { select: { davomatXabari: true } } },
  });
  if (!school) return null;
  const ids = school.organizationId
    ? (await prisma.school.findMany({ where: { organizationId: school.organizationId }, select: { id: true } })).map(s => s.id)
    : [school.id];
  return { school, ids, raw: school.organization?.davomatXabari ?? null };
}

/**
 * Amaldagi sozlama va tashkilotning shablonlari. Sozlama hali saqlanmagan
 * bo'lsa shablon nomlaridan taxmin qilinadi (saqlangan: false).
 */
export async function davomatSozlamasi(schoolId) {
  const t = await tashkilot(schoolId);
  if (!t) return null;
  const shablonlar = await prisma.messageTemplate.findMany({
    where: { schoolId: { in: t.ids } },
    select: { id: true, name: true, body: true, eskizStatus: true },
    orderBy: { id: 'asc' },
  });
  const saqlangan = t.raw !== null && t.raw !== undefined;
  const sozlama = saqlangan
    ? sozlamaniTozala(t.raw)
    : { ...STANDART_SOZLAMA, shablon: shablonTaxmini(shablonlar) };
  // O'chirilgan shablonga ishora qolmasin — bunday holatga xabar ketmaydi.
  const bor = new Set(shablonlar.map(s => s.id));
  for (const [k, id] of Object.entries(sozlama.shablon)) if (!bor.has(id)) delete sozlama.shablon[k];
  return { sozlama, saqlangan, shablonlar, organizationId: t.school.organizationId };
}

export async function davomatSozlamasiniSaqla(schoolId, raw) {
  const t = await tashkilot(schoolId);
  if (!t?.school.organizationId) return { error: "Filial tashkilotga bog'lanmagan" };
  const sozlama = sozlamaniTozala(raw);
  const ids = Object.values(sozlama.shablon);
  if (ids.length) {
    // Faqat shu tashkilotning shablonlari.
    const bor = new Set((await prisma.messageTemplate.findMany({
      where: { id: { in: ids }, schoolId: { in: t.ids } }, select: { id: true },
    })).map(s => s.id));
    for (const [k, id] of Object.entries(sozlama.shablon)) if (!bor.has(id)) delete sozlama.shablon[k];
  }
  await prisma.organization.update({ where: { id: t.school.organizationId }, data: { davomatXabari: sozlama } });
  return { sozlama };
}

/** Bugun 00:00 (O'zbekiston, UTC+5) — Date. */
export function bugunBoshi() {
  const uz = new Date(Date.now() + 5 * 3600e3);
  return new Date(Date.UTC(uz.getUTCFullYear(), uz.getUTCMonth(), uz.getUTCDate()) - 5 * 3600e3);
}

/**
 * Shu kurs va kun uchun kimga davomat xabari yetib borgan: studentId → oxirgi
 * vaqt. Kurs oynasida ular belgilanmagan holda turadi (ikkinchi marta bosilsa
 * ota-ona ikki xabar olmasin).
 */
export async function kursKuniYuborilganlar(groupId, date) {
  const kampaniyalar = await prisma.messageCampaign.findMany({
    where: {
      AND: [
        { filtersJson: { path: ['davomat', 'groupId'], equals: groupId } },
        { filtersJson: { path: ['davomat', 'date'], equals: date } },
      ],
    },
    select: { id: true },
  });
  const out = new Map();
  if (!kampaniyalar.length) return out;
  const loglar = await prisma.smsLog.findMany({
    where: { campaignId: { in: kampaniyalar.map(k => k.id) }, status: 'SENT', studentId: { not: null } },
    select: { studentId: true, sentAt: true },
    orderBy: { sentAt: 'asc' },
  });
  for (const l of loglar) out.set(l.studentId, l.sentAt);
  return out;
}

/** Bugun davomat xabari ketgan o'quvchilar (istalgan kursdan) — avtomatik qoidalar takrorlamasin. */
export async function bugunDavomatXabariOlganlar(studentIds) {
  if (!studentIds.length) return new Set();
  const rows = await prisma.smsLog.findMany({
    where: { type: 'ATTENDANCE', status: 'SENT', studentId: { in: studentIds }, sentAt: { gte: bugunBoshi() } },
    select: { studentId: true },
  });
  return new Set(rows.map(r => r.studentId));
}

/**
 * Kurs yo'qlamasi bo'yicha xabar yuborish.
 * @param {object} p
 * @param {number} p.groupId
 * @param {string} p.date          YYYY-MM-DD
 * @param {number[]} [p.studentIds] faqat shular (berilmasa — hamma belgilangan)
 * @param {string} [p.kanal]       BOTH | SMS | TELEGRAM (berilmasa — sozlamadagi)
 */
export async function davomatXabariniYuborish({ groupId, date, studentIds, kanal }) {
  if (!yuboruvchi) throw new Error('Xabar yuboruvchi ulanmagan');
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, schoolId: true, course: { select: { name: true } }, teacher: { select: { name: true } } },
  });
  if (!group) return { error: 'Kurs topilmadi' };

  const { sozlama, shablonlar } = await davomatSozlamasi(group.schoolId);
  const kanalTanlov = KANALLAR.includes(kanal) ? kanal : sozlama.kanal;

  let yozuvlar = await prisma.attendance.findMany({
    where: { groupId, date },
    include: { student: true },
    orderBy: { id: 'asc' },
  });
  if (Array.isArray(studentIds)) {
    const kerak = new Set(studentIds.map(Number));
    yozuvlar = yozuvlar.filter(r => kerak.has(r.studentId));
  }
  // Bitta o'quvchiga bir kunda ikki yozuv bo'lib qolgan bo'lsa — oxirgisi.
  const oquvchiBoyicha = new Map();
  for (const r of yozuvlar) if (r.student) oquvchiBoyicha.set(r.studentId, r);

  const school = await prisma.school.findUnique({ where: { id: group.schoolId } });
  // {markaz} — filial emas, markaz nomi (lib/markazBrendi.js).
  if (school) school.orgName = await markazNomi(group.schoolId);
  // {kurs}, {fan}, {ustoz} — aynan shu dars kursi, o'quvchining hamma kurslari emas.
  const kurs = [{ id: group.id, name: group.name, courseName: group.course?.name || '', teacherName: group.teacher?.name || '' }];
  const shablonXaritasi = new Map(shablonlar.map(s => [s.id, s]));

  const natija = { jami: oquvchiBoyicha.size, yuborildi: 0, xato: 0, shablonsiz: 0, aloqasiz: 0, xatolar: [] };
  const vazifalar = [];
  for (const r of oquvchiBoyicha.values()) {
    const k = holatKaliti(r.status);
    const t = k ? shablonXaritasi.get(sozlama.shablon[k]) : null;
    if (!t) { natija.shablonsiz++; continue; }
    vazifalar.push({ student: r.student, message: fillTemplate(t.body, r.student, kurs, school) });
  }
  if (!vazifalar.length) return natija;

  // Tarix bo'limida bitta yozuv bo'lib ko'rinadi; filtersJson esa "shu kurs,
  // shu kun" uchun kimga ketganini topishga kerak.
  const kampaniya = await prisma.messageCampaign.create({
    data: {
      message: `Davomat xabari — ${group.name}, ${date}`,
      channel: kanalTanlov,
      recipientTo: sozlama.kimga,
      filtersJson: { davomat: { groupId: group.id, date } },
      totalCount: vazifalar.length,
      schoolId: group.schoolId,
    },
  });

  // Vercel javobdan keyin ishni to'xtatadi — hammasi javobdan oldin, 10 tadan.
  for (let i = 0; i < vazifalar.length; i += 10) {
    await Promise.all(vazifalar.slice(i, i + 10).map(async v => {
      let r;
      try {
        r = await yuboruvchi({
          student: v.student, message: v.message, channel: kanalTanlov, recipientTo: sozlama.kimga,
          type: 'ATTENDANCE', schoolId: group.schoolId, campaignId: kampaniya.id,
        });
      } catch (e) {
        r = { attempted: true, success: false, xato: e.message };
      }
      if (!r.attempted) {
        natija.aloqasiz++;
        natija.xatolar.push({
          studentId: v.student.id, ism: v.student.name,
          sabab: kanalTanlov === 'TELEGRAM' ? 'Telegramga ulanmagan' : "Telefon raqami ham, Telegram ham yo'q",
        });
      } else if (r.success) {
        natija.yuborildi++;
      } else {
        natija.xato++;
        natija.xatolar.push({ studentId: v.student.id, ism: v.student.name, sabab: r.xato || 'yuborilmadi' });
      }
    }));
  }

  await prisma.messageCampaign.update({
    where: { id: kampaniya.id },
    data: { sentCount: natija.yuborildi, failedCount: natija.xato + natija.aloqasiz },
  }).catch(() => {});
  return natija;
}
