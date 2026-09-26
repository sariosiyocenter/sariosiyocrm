// Qarz eslatmasi: yuborish, navbat, avtomatik jadval, ota-ona javoblari.
// Qoidalar, sozlama shakli va Telegram matni — lib/qarzXabari.js.
//
//  1. Har bir eslatma — alohida QarzXabari yozuvi: xodim "Qarzdorlar
//     ro'yxati"dan tanlab yuborgani (qolda) yoki jadval (avto). Holati,
//     kanali, yetib bordimi — ko'rinadi; jadval shu yozuvlarga qarab oyiga
//     necha marta va qachon yuborilganini biladi.
//  2. Qarz YUBORISH paytida qayta hisoblanadi: navbatda turganda to'lov
//     kiritilsa — eslatma bekor bo'ladi, eski summa ketmaydi.
//  3. Telegram (bepul): kurslar bo'yicha tafsilot, "Payme" va "✅ To'laganman"
//     tugmalari. SMS — Shablonlar dagi Eskiz tasdiqlagan matn.
//  4. Kechasi (21:30–08:00) yuborilmaydi — ertalab 08:00 da ketadi.
//  5. Ota-ona "To'laganman" desa (QarzJavob) — xodim tekshirmaguncha shu
//     o'quvchiga avtomatik eslatma ketmaydi.
//
// Eskiz va Telegram server.js da — qarzXabariniUlash() orqali ulanadi.

import prisma from '../lib/prisma.js';
import { fillTemplate, oxirgiTolov } from '../lib/xabarMatni.js';
import { markazNomi } from '../lib/markazBrendi.js';
import { allocate } from '../lib/allocation.js';
import { loadRowsByStudent, rulesForStudents } from './ledger.js';
import { loadSettings as paymeSozlamasi, isConfigured as paymeUlangan } from './payme.js';
import { eskizYuboradi, eskizRadEtdi, smsMatni, smsIsm, uzRaqam, KIMGA_NOMI } from '../lib/tolovXabari.js';
import {
  sozlamaniTozala, STANDART_SOZLAMA, shablonTaxmini, qarzTafsiloti, telegramMatni, som,
} from '../lib/qarzXabari.js';
import { qabulQiluvchilar, xatoTuri, XATO_SABABI, lokalTegmaydi, eskizHolatlariniYangila } from './tolovXabari.js';

/**
 * Server ulaydigan funksiyalar:
 *  sms(phone, text, { schoolId, studentId }) → { success, eskizId, xato, lokal }
 *  telegram(schoolId, chatId, html, { studentId, toName, tugmalar }) → { success, xato }
 *  adminlarga(schoolId, html, rasmFileId) → administratorlarga Telegram (ixtiyoriy)
 */
let tr = null;
export function qarzXabariniUlash(transport) {
  tr = transport;
}

const MUDDAT_MS = 72 * 3600e3;               // shundan eski eslatma endi yuborilmaydi
const QAYTA_MS = [2, 5, 15, 60, 180].map(m => m * 60e3);
const ENG_KOP_URINISH = QAYTA_MS.length + 1;
const QULF_MS = 2 * 60e3;
const SHABLON_KUT_MS = 10 * 60e3;
const TAKROR_BLOK_MS = 10 * 60e3;           // qo'lda: 10 daqiqada bir o'quvchiga ikkinchisi yaratilmaydi
const YAQIN_TOLOV_KUN = 3;                   // shu kunlar ichida to'lov qilganga jadval yozmaydi

// --- Vaqt (Toshkent, UTC+5) -------------------------------------------------

const TZ = 5 * 3600e3;
const uz = (d = new Date()) => new Date(d.getTime() + TZ);
export const uzSana = (d = new Date()) => uz(d).toISOString().slice(0, 10);
const uzSoat = (d = new Date()) => uz(d).toISOString().slice(11, 16);

/** Toshkent bo'yicha joriy oyning boshi (UTC vaqt nuqtasi). */
export function oyBoshi(d = new Date()) {
  const u = uz(d);
  return new Date(Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), 1) - TZ);
}

/**
 * 21:30–08:00 — ota-onaga yozilmaydi. QARZ_TINCH_VAQT=off faqat lokal
 * sinovlar uchun (kechasi ham tekshirish mumkin bo'lsin); Vercel'da e'tiborsiz.
 */
export const tinchVaqt = (d = new Date()) => {
  if (!process.env.VERCEL && process.env.QARZ_TINCH_VAQT === 'off') return false;
  const hm = uzSoat(d);
  return hm < '08:00' || hm >= '21:30';
};

/** Keyingi 08:00 (Toshkent). */
export function ertalab(d = new Date()) {
  const u = uz(d);
  let t = Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 8, 0) - TZ;
  if (t <= d.getTime()) t += 864e5;
  return new Date(t);
}

/** "BOBORAJABOV QILICHBEK" → "Boborajabov Qilichbek" (Telegram'da o'qishga qulay). */
const ismKor = (name) => {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (n !== n.toUpperCase()) return n;
  return n.toLowerCase().replace(/(^|[\s-'])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Sozlama
// ---------------------------------------------------------------------------

async function tashkilot(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, organizationId: true, organization: { select: { qarzXabari: true } } },
  });
  if (!school) return null;
  const ids = school.organizationId
    ? (await prisma.school.findMany({ where: { organizationId: school.organizationId }, select: { id: true } })).map(s => s.id)
    : [school.id];
  return { school, ids, raw: school.organization?.qarzXabari ?? null };
}

/**
 * Amaldagi sozlama (butun markazga bitta). Hali saqlanmagan bo'lsa — eski
 * "Qarzdorlik eslatmasi" avto-qoidasidan (kun, soat, chegara, kimga) va
 * shablon matnidan taxmin; avtomatik jadval baribir o'chiq.
 */
export async function qarzSozlamasi(schoolId) {
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
    const [qoida, setting] = await Promise.all([
      prisma.autoMessageRule.findFirst({ where: { schoolId: { in: t.ids }, type: 'DEBT_REMINDER' }, orderBy: { id: 'asc' } }),
      prisma.setting.findUnique({ where: { schoolId }, select: { adminPhone: true } }),
    ]);
    const cfg = qoida?.config && typeof qoida.config === 'object' ? qoida.config : {};
    sozlama = sozlamaniTozala({
      ...STANDART_SOZLAMA,
      ...(qoida ? {
        kun: cfg.dayOfMonth ?? STANDART_SOZLAMA.kun,
        minQarz: cfg.minDebt ?? STANDART_SOZLAMA.minQarz,
        soat: qoida.time || STANDART_SOZLAMA.soat,
        kimga: qoida.recipientTo || STANDART_SOZLAMA.kimga,
      } : {}),
      yoqilgan: false,
      shablonId: shablonTaxmini(shablonlar),
      aloqa: setting?.adminPhone || '',
    });
  }
  if (sozlama.shablonId && !shablonlar.some(s => s.id === sozlama.shablonId)) sozlama.shablonId = null;
  return { sozlama, saqlangan, shablonlar, organizationId: t.school.organizationId, schoolIds: t.ids };
}

export async function qarzSozlamasiniSaqla(schoolId, raw) {
  const t = await tashkilot(schoolId);
  if (!t?.school.organizationId) return { error: "Filial tashkilotga bog'lanmagan" };
  const sozlama = sozlamaniTozala(raw);
  if (sozlama.shablonId) {
    const bor = await prisma.messageTemplate.findFirst({ where: { id: sozlama.shablonId, schoolId: { in: t.ids } }, select: { id: true } });
    if (!bor) return { error: 'Shablon topilmadi' };
  }
  // Jadvalning "bugun ishladi" belgisi (avtoQarzEslatma) saqlashda yo'qolmasin.
  const oxirgiAvto = t.raw && typeof t.raw === 'object' && typeof t.raw.oxirgiAvto === 'string' ? t.raw.oxirgiAvto : null;
  await prisma.organization.update({
    where: { id: t.school.organizationId },
    data: { qarzXabari: { ...sozlama, ...(oxirgiAvto ? { oxirgiAvto } : {}) } },
  });
  return { sozlama };
}

// ---------------------------------------------------------------------------
// Qarzdorlar
// ---------------------------------------------------------------------------

const OQUVCHI_SELECT = {
  id: true, name: true, status: true, balance: true, schoolId: true,
  phone: true, fatherPhone: true, motherPhone: true,
  telegramId: true, fatherTelegramId: true, motherTelegramId: true,
};

/**
 * Qarzdorlar — har biri kurslar bo'yicha qarzi (o'quvchi kartasidagi "Balans"
 * bilan bir xil hisob), oxirgi qayd etilgan to'lovi, shu oydagi eslatmalari
 * va ochiq javobi bilan.
 *   studentIds — faqat shular (yuborish paytida, holatidan qat'i nazar);
 *   aks holda filialning `statuslar` dagi, balansi manfiy o'quvchilari.
 */
export async function qarzdorlar(schoolId, { studentIds = null, statuslar = ['Faol'], hozir = new Date() } = {}) {
  const where = studentIds
    ? { id: { in: studentIds }, ...(schoolId ? { schoolId } : {}) }
    : { schoolId, status: { in: statuslar }, balance: { lt: -0.5 } };
  const students = await prisma.student.findMany({ where, select: OQUVCHI_SELECT, orderBy: { name: 'asc' } });
  if (!students.length) return [];
  const ids = students.map(s => s.id);
  const [rowsBy, qoidalar, eslatmalar, javoblar] = await Promise.all([
    loadRowsByStudent(ids),
    rulesForStudents(ids),
    prisma.qarzXabari.findMany({
      where: { studentId: { in: ids }, createdAt: { gte: oyBoshi(hozir) }, holat: { not: 'bekor' } },
      orderBy: { id: 'asc' },
      select: { id: true, studentId: true, holat: true, kanal: true, manba: true, createdAt: true, yuborilganAt: true },
    }),
    prisma.qarzJavob.findMany({
      where: { studentId: { in: ids }, holat: 'ochiq' },
      orderBy: { id: 'desc' },
      select: { id: true, studentId: true, kimdan: true, matn: true, rasm: true, createdAt: true },
    }),
  ]);
  const natijalar = new Map(ids.map(id => [id, allocate(rowsBy.get(id) || [], qoidalar.get(id))]));
  const gids = new Set();
  for (const r of natijalar.values()) for (const b of r.buckets) if (b.groupId && b.remaining > 0) gids.add(b.groupId);
  const guruhlar = gids.size ? await prisma.group.findMany({ where: { id: { in: [...gids] } }, select: { id: true, name: true } }) : [];
  const nomlar = new Map(guruhlar.map(g => [g.id, { nom: g.name }]));
  const yaqinChegara = uzSana(new Date(hozir.getTime() - YAQIN_TOLOV_KUN * 864e5));
  const out = [];
  for (const s of students) {
    const tafsil = qarzTafsiloti(natijalar.get(s.id).buckets, nomlar, s.balance);
    if (!studentIds && tafsil.jami < 1) continue;
    const ox = oxirgiTolov(rowsBy.get(s.id) || []);
    const sana = ox ? String(ox.date).slice(0, 10) : null;
    out.push({
      student: s,
      tafsil,
      oxirgiTolov: ox ? { sana, summa: Math.round(ox.amount) } : null,
      yaqindaTolagan: !!sana && sana >= yaqinChegara,
      eslatmalar: eslatmalar.filter(e => e.studentId === s.id),
      javob: javoblar.find(j => j.studentId === s.id) || null,
    });
  }
  return out;
}

/** Ro'yxat qatori (brauzerga): kim, qancha, kurslar, oxirgi to'lov, eslatmalar, kimga yetadi. */
function royxatQatori(q, sozlama) {
  const s = q.student;
  const oxirgi = q.eslatmalar[q.eslatmalar.length - 1] || null;
  return {
    id: s.id,
    ism: s.name,
    status: s.status,
    jami: q.tafsil.jami,
    kurslar: q.tafsil.kurslar,
    eski: q.tafsil.eski,
    avans: q.tafsil.avans,
    oxirgiTolov: q.oxirgiTolov,
    yaqindaTolagan: q.yaqindaTolagan,
    eslatma: { soni: q.eslatmalar.length, oxirgi: oxirgi ? { sana: oxirgi.createdAt, holat: oxirgi.holat, kanal: oxirgi.kanal } : null },
    javob: q.javob ? { id: q.javob.id, matn: q.javob.matn, rasm: !!q.javob.rasm, sana: q.javob.createdAt } : null,
    qabul: qabulQiluvchilar(s, sozlama.kimga).map(o => ({ kimga: o.kimga, tg: !!o.tg, tel: !!o.tel })),
  };
}

/** "Qarzdorlar ro'yxati" oynasi uchun. */
export async function qarzdorlarRoyxati(schoolId, { statuslar = ['Faol'] } = {}) {
  const s = await qarzSozlamasi(schoolId);
  if (!s) return null;
  const qs = await qarzdorlar(schoolId, { statuslar });
  return { sozlama: s.sozlama, shablonlar: s.shablonlar, royxat: qs.map(q => royxatQatori(q, s.sozlama)) };
}

// ---------------------------------------------------------------------------
// Yuborish
// ---------------------------------------------------------------------------

async function paymeJonli(schoolId) {
  try {
    const s = await paymeSozlamasi(schoolId);
    return paymeUlangan(s) && s.paymeMode === 'live';
  } catch {
    return false;
  }
}

/** SMS shablonida {kurs}, {fan}, {ustoz} bo'lsa — o'quvchining kurslari. */
async function shablonKurslari(body, studentId) {
  if (!/\{(kurs|guruh|fan|ustoz)\}/i.test(String(body || ''))) return [];
  const g = await prisma.group.findMany({
    where: { students: { some: { id: studentId } } },
    select: { id: true, name: true, course: { select: { name: true } }, teacher: { select: { name: true } } },
  });
  return g.map(x => ({ id: x.id, name: x.name, courseName: x.course?.name || '', teacherName: x.teacher?.name || '' }));
}

const TG_YAKUNIY = /bloklagan|blocked|chat not found|deactivated|kicked/i;

/**
 * Bitta yozuvni yuborishga urinish; natijani yozuvga yozadi va qaytaradi.
 * opts.sozlama, opts.q (qarzdorlar() qatori), opts.markaz — navbat bir marta
 * hisoblab beradi. opts.qolda — xodim "Qayta yuborish"ni bosgan: 3 kunlik
 * cheklov yo'q.
 */
async function yuborish(rowId, opts = {}) {
  const row = await prisma.qarzXabari.findUnique({ where: { id: rowId } });
  if (!row || ['yuborildi', 'yetkazildi', 'yetkazilmadi', 'bekor'].includes(row.holat)) return row;
  if (await lokalTegmaydi(row.schoolId)) return row;
  const saqla = (data) => prisma.qarzXabari.update({ where: { id: row.id }, data });
  const urinish = row.urinish + 1;
  const hozir = new Date();

  if (!opts.qolda && hozir.getTime() - new Date(row.createdAt).getTime() > MUDDAT_MS) {
    return saqla({ holat: 'xato', sabab: "3 kun ichida yuborib bo'lmadi — endi yuborilmaydi" });
  }
  if (tinchVaqt(hozir)) {
    return saqla({ holat: 'kutmoqda', sabab: 'Kechasi yuborilmaydi — ertalab 08:00 da ketadi', keyingiUrinish: ertalab(hozir) });
  }
  const s = opts.sozlama || await qarzSozlamasi(row.schoolId);
  if (!s) return saqla({ holat: 'bekor', sabab: 'Filial topilmadi' });
  const q = opts.q || (await qarzdorlar(row.schoolId, { studentIds: [row.studentId] }))[0];
  if (!q) return saqla({ holat: 'bekor', sabab: "O'quvchi topilmadi" });

  // Qarz hozirgi holatda: navbatda turganda to'lov kiritilgan bo'lishi mumkin.
  const { tafsil } = q;
  const suratga = { summa: tafsil.jami, tafsil: { ...tafsil, oxirgiTolov: q.oxirgiTolov } };
  if (tafsil.jami < 1) return saqla({ holat: 'bekor', sabab: 'Qarz yopilgan — eslatma kerak emas', ...suratga });
  if (row.manba === 'avto') {
    if (q.javob) return saqla({ holat: 'bekor', sabab: "Ota-ona to'laganini aytgan — xodim tekshiryapti", ...suratga });
    if (tafsil.jami < s.sozlama.minQarz) return saqla({ holat: 'bekor', sabab: `Qarz ${som(tafsil.jami)} so'm — chegaradan kam`, ...suratga });
  }

  const student = q.student;
  const { kanal, kimga, aloqa } = s.sozlama;
  const shablon = s.shablonlar.find(t => t.id === s.sozlama.shablonId) || null;
  const odamlar = qabulQiluvchilar(student, kimga);
  const tgOdamlar = kanal !== 'SMS' ? odamlar.filter(o => o.tg) : [];
  const [markaz, payme] = await Promise.all([
    opts.markaz !== undefined ? opts.markaz : markazNomi(row.schoolId),
    tgOdamlar.length ? paymeJonli(student.schoolId) : false,
  ]);
  const raqamlar = [];

  // 1. Telegram: to'liq tafsilot va tugmalar.
  let tgOk = false;
  if (tgOdamlar.length) {
    const tugmalar = [
      ...(payme ? [{ text: "💳 Payme orqali to'lash", data: `payme_k_${student.id}` }] : []),
      { text: "✅ To'laganman", data: `qj_t_${student.id}` },
    ];
    for (const o of tgOdamlar) {
      const html = telegramMatni({ ism: ismKor(student.name), kimga: o.kimga, tafsil, oxirgiTolov: q.oxirgiTolov, aloqa, markaz });
      const r = tr?.telegram
        ? await tr.telegram(row.schoolId, o.tg, html, { studentId: student.id, toName: `${student.name} (${KIMGA_NOMI[o.kimga]})`, tugmalar })
        : { success: false, xato: 'Telegram bot ulanmagan' };
      raqamlar.push({ kimga: o.kimga, kanal: 'TELEGRAM', manzil: String(o.tg), holat: r.success ? 'yuborildi' : 'xato', xato: r.success ? null : String(r.xato || '').slice(0, 200) });
      if (r.success) tgOk = true;
    }
  } else if (kanal === 'TELEGRAM') {
    return saqla({ holat: 'xato', ...suratga, sabab: `Telegram botga ulanmagan (${kimga.split(',').map(k => KIMGA_NOMI[k]).join(', ')})` });
  }

  // 2. SMS: faqat SMS kanali yoki Telegram'da hech kimga yetmagan bo'lsa.
  let matn = null;
  if (kanal === 'SMS' || (kanal === 'BOTH' && !tgOk)) {
    const tellar = odamlar.filter(o => o.tel).filter((o, i, a) => a.findIndex(x => x.tel === o.tel) === i);
    if (!tellar.length) {
      if (!tgOk) {
        const bor = odamlar.filter(o => o.telXom).map(o => `${KIMGA_NOMI[o.kimga]}: ${o.telXom}`);
        return saqla({
          holat: 'xato', raqamlar, ...suratga,
          sabab: bor.length ? `Telefon raqami noto'g'ri (${bor.join(', ')})` : `Telefon raqami yo'q (${kimga.split(',').map(k => KIMGA_NOMI[k]).join(', ')})`,
        });
      }
    } else if (!shablon) {
      if (!tgOk) return saqla({ holat: 'xato', raqamlar, ...suratga, sabab: "SMS matni tanlanmagan — Xabarlar → Avtomatik → Qarzdorlik eslatmasi" });
    } else if (eskizRadEtdi(shablon.eskizStatus)) {
      if (!tgOk) return saqla({ holat: 'xato', raqamlar, ...suratga, sabab: "Eskiz SMS matnini rad etgan — shablonni o'zgartiring (Xabarlar → Shablonlar)" });
    } else if (!eskizYuboradi(shablon.eskizStatus)) {
      // Shablon tekshiruvda: SMS navbatda turadi, tasdiqlangach o'zi ketadi.
      if (!tgOk) {
        return saqla({
          holat: 'kutmoqda', raqamlar, ...suratga,
          sabab: "Eskiz SMS matnini hali tasdiqlamagan — tasdiqlangach o'zi yuboriladi",
          keyingiUrinish: new Date(Date.now() + SHABLON_KUT_MS),
        });
      }
    } else {
      const kurslar = await shablonKurslari(shablon.body, student.id);
      const target = { ...student, name: smsIsm(student.name) || student.name, balance: -tafsil.jami, lastPaymentAmount: q.oxirgiTolov?.summa ?? 0 };
      matn = smsMatni(fillTemplate(shablon.body, target, kurslar, { orgName: markaz }));
      for (const o of tellar) {
        const r = tr?.sms ? await tr.sms(o.tel, matn, { schoolId: row.schoolId, studentId: student.id }) : { success: false, xato: 'SMS ulanmagan' };
        raqamlar.push({ kimga: o.kimga, kanal: 'SMS', manzil: o.tel, holat: r.success ? 'yuborildi' : 'xato', eskizId: r.eskizId || null, xato: r.success ? null : String(r.xato || '').slice(0, 200) });
      }
    }
  }

  const ok = raqamlar.filter(x => x.holat === 'yuborildi');
  if (ok.length) {
    return saqla({
      holat: 'yuborildi', sabab: null, matn, raqamlar, urinish, ...suratga,
      kanal: ok.some(x => x.kanal === 'SMS') ? 'SMS' : 'TELEGRAM', yuborilganAt: new Date(),
    });
  }
  // Hech biri ketmadi — sababiga qarab qayta urinish yoki to'xtatish.
  const xatolar = raqamlar.filter(x => x.holat === 'xato');
  if (xatolar.length && xatolar.every(x => x.kanal === 'TELEGRAM' && TG_YAKUNIY.test(x.xato || ''))) {
    return saqla({ holat: 'xato', raqamlar, urinish, ...suratga, sabab: "Telegram: botni bloklagan yoki hisob o'chirilgan" });
  }
  const turlar = xatolar.map(x => xatoTuri(x.xato));
  const tur = ['balans', 'tarmoq', 'sozlama', 'boshqa', 'shablon', 'lokal'].find(t => turlar.includes(t)) || 'boshqa';
  const yakuniy = tur === 'shablon' || tur === 'lokal' || urinish >= ENG_KOP_URINISH;
  const birinchi = xatolar[0]?.xato || '';
  return saqla({
    holat: yakuniy ? 'xato' : 'kutmoqda', matn, raqamlar, urinish, ...suratga,
    sabab: XATO_SABABI[tur] || `Yuborilmadi: ${birinchi.slice(0, 150)}`,
    keyingiUrinish: new Date(Date.now() + (QAYTA_MS[Math.min(urinish - 1, QAYTA_MS.length - 1)] || 60e3)),
  });
}

/** Berilgan yozuvlarning hozirgi holati (progress uchun). */
export async function holatlarSoni(idlar) {
  if (!idlar?.length) return { holatlar: {}, qoldi: 0 };
  const [g, qoldi] = await Promise.all([
    prisma.qarzXabari.groupBy({ by: ['holat'], where: { id: { in: idlar } }, _count: true }),
    prisma.qarzXabari.count({ where: { id: { in: idlar }, holat: { in: ['kutmoqda', 'yuborilmoqda'] }, keyingiUrinish: { lte: new Date() } } }),
  ]);
  return { holatlar: Object.fromEntries(g.map(x => [x.holat, x._count])), qoldi };
}

/**
 * Navbatdagi eslatmalarni yuboradi (lazy cron, "Qarzdorlar ro'yxati"dan
 * yuborilganda — idlar bilan). Bir partiyada filial bo'yicha qarz bir marta
 * hisoblanadi, yuborish bir vaqtda `parallel` tadan.
 */
export async function qarzNavbati({ cheklov = 20, byudjetMs = 20000, idlar = null, parallel = 4 } = {}) {
  const boshi = Date.now();
  // Lokal server faqat "ZZ " sinov filiallariga tegadi (lokalTegmaydi).
  const lokal = !process.env.VERCEL && process.env.SMS_REAL !== '1';
  const sinov = lokal
    ? (await prisma.school.findMany({ where: { name: { startsWith: 'ZZ ' } }, select: { id: true } })).map(s => s.id)
    : null;
  if (lokal && !sinov.length) return { yuborildi: 0, ...(await holatlarSoni(idlar)) };
  const filial = sinov ? { schoolId: { in: sinov } } : {};
  await prisma.qarzXabari.updateMany({
    where: { ...filial, holat: { in: ['kutmoqda', 'yuborilmoqda'] }, createdAt: { lt: new Date(Date.now() - MUDDAT_MS) } },
    data: { holat: 'xato', sabab: "3 kun ichida yuborib bo'lmadi — endi yuborilmaydi" },
  });
  // Kechasi navbat kutadi (qo'lda yuborilganlar "ertalab ketadi" deb belgilanadi).
  if (tinchVaqt() && !idlar) return { yuborildi: 0 };
  const rows = await prisma.qarzXabari.findMany({
    where: { ...filial, ...(idlar ? { id: { in: idlar } } : {}), holat: { in: ['kutmoqda', 'yuborilmoqda'] }, keyingiUrinish: { lte: new Date() } },
    orderBy: { id: 'asc' }, take: cheklov,
  });
  if (!rows.length) return { yuborildi: 0, ...(await holatlarSoni(idlar)) };
  await eskizHolatlariniYangila([...new Set(rows.map(r => r.schoolId))]).catch(() => {});

  const sozlamalar = new Map();
  const markazlar = new Map();
  const qlar = new Map();
  for (const sid of new Set(rows.map(r => r.schoolId))) {
    const [s, m, qs] = await Promise.all([
      qarzSozlamasi(sid),
      markazNomi(sid),
      qarzdorlar(sid, { studentIds: rows.filter(r => r.schoolId === sid).map(r => r.studentId) }),
    ]);
    sozlamalar.set(sid, s);
    markazlar.set(sid, m);
    for (const q of qs) qlar.set(q.student.id, q);
  }

  let yuborildi = 0;
  const bittasi = async (r) => {
    if (Date.now() - boshi > byudjetMs) return;
    // Bir vaqtda ikki joydan olinmasin: holat va vaqt o'zgarmagan bo'lsagina.
    const band = await prisma.qarzXabari.updateMany({
      where: { id: r.id, holat: r.holat, keyingiUrinish: r.keyingiUrinish },
      data: { holat: 'yuborilmoqda', keyingiUrinish: new Date(Date.now() + QULF_MS) },
    });
    if (!band.count) return;
    const n = await yuborish(r.id, { sozlama: sozlamalar.get(r.schoolId), q: qlar.get(r.studentId) || null, markaz: markazlar.get(r.schoolId) })
      .catch(e => { console.error('[Qarz eslatmasi]', e.message); return null; });
    if (n?.holat === 'yuborildi') yuborildi++;
  };
  for (let i = 0; i < rows.length; i += parallel) {
    if (Date.now() - boshi > byudjetMs) break;
    await Promise.all(rows.slice(i, i + parallel).map(bittasi));
  }
  return { yuborildi, ...(await holatlarSoni(idlar)) };
}

/**
 * Xodim "Qarzdorlar ro'yxati"dan tanlaganlarga eslatma yozuvlari. 10 daqiqa
 * ichida shu o'quvchiga yaratilgan eslatma bo'lsa — ikkinchisi yaratilmaydi
 * (ikki marta bosilsa ham). Yuborish — qarzNavbati({ idlar }).
 */
export async function qoldaYubor(schoolId, studentIds, user) {
  if (await lokalTegmaydi(schoolId)) return { status: 409, error: XATO_SABABI.lokal };
  const ids = [...new Set((studentIds || []).map(Number).filter(Number.isInteger))].slice(0, 3000);
  if (!ids.length) return { status: 400, error: "O'quvchi tanlanmagan" };
  const students = await prisma.student.findMany({ where: { id: { in: ids }, schoolId }, select: { id: true } });
  const yaqin = await prisma.qarzXabari.findMany({
    where: { studentId: { in: ids }, createdAt: { gte: new Date(Date.now() - TAKROR_BLOK_MS) }, holat: { not: 'bekor' } },
    select: { studentId: true },
  });
  const blok = new Set(yaqin.map(r => r.studentId));
  const yangi = students.filter(s => !blok.has(s.id));
  const rows = yangi.length
    ? await prisma.qarzXabari.createManyAndReturn({
        data: yangi.map(s => ({
          schoolId, studentId: s.id, manba: 'qolda', holat: 'kutmoqda',
          yuboruvchiId: user?.id ?? null, yuboruvchi: user?.name ?? null,
        })),
        select: { id: true },
      })
    : [];
  return { idlar: rows.map(r => r.id), yaratildi: rows.length, takror: blok.size };
}

/** Qo'lda qayta yuborish (ro'yxatdagi tugma). */
export async function qarzXabariniQaytaYubor(rowId) {
  const row = await prisma.qarzXabari.findUnique({ where: { id: rowId } });
  if (!row) return { status: 404, error: 'Topilmadi' };
  if (['yuborildi', 'yetkazildi'].includes(row.holat)) return { status: 409, error: 'Bu eslatma allaqachon yuborilgan' };
  if (row.holat === 'bekor') return { status: 409, error: `Bekor qilingan: ${row.sabab || ''}` };
  if (await lokalTegmaydi(row.schoolId)) return { status: 409, error: XATO_SABABI.lokal };
  await prisma.qarzXabari.update({
    where: { id: row.id },
    // Qo'lda bosilganda urinishlar hisobi yangidan boshlanadi.
    data: { holat: 'yuborilmoqda', urinish: 0, keyingiUrinish: new Date(Date.now() + QULF_MS) },
  });
  await eskizHolatlariniYangila([row.schoolId], { majburiy: true }).catch(() => {});
  return { row: await yuborish(row.id, { qolda: true }) };
}

// ---------------------------------------------------------------------------
// Avtomatik jadval
// ---------------------------------------------------------------------------

/** Jadval bo'yicha shu o'quvchiga bugun eslatma kerakmi. */
export function nomzodmi(q, s, hozir = new Date()) {
  if (q.student.status !== 'Faol') return false;
  if (q.tafsil.jami < Math.max(1, s.minQarz)) return false;
  if (q.javob) return false;               // ota-ona "to'laganman" degan — xodim tekshiryapti
  if (q.yaqindaTolagan) return false;      // oxirgi 3 kunda to'lov qilgan
  const oz = q.eslatmalar;                 // shu oy (qo'lda yuborilganlar ham)
  if (oz.length >= s.maks) return false;
  const oxirgi = oz[oz.length - 1];
  if (oxirgi) {
    if (s.takror === 0) return false;
    // Yarim kun bardosh: kechagi 19:05 dagi eslatmadan keyin bugun 19:00 da ham.
    if (hozir.getTime() - new Date(oxirgi.createdAt).getTime() < s.takror * 864e5 - 12 * 3600e3) return false;
  }
  return true;
}

/**
 * Avtomatik jadval: oyning `kun`-sanasidan boshlab `soat` dan keyin — shartga
 * mos qarzdorlarga eslatma yozuvlari yaratiladi (yuborish — qarzNavbati).
 * Bir markazda kuniga bir marta: Organization.qarzXabari.oxirgiAvto
 * belgisini atomar almashtirgan jarayongina ishlaydi.
 */
export async function avtoQarzEslatma({ hozir = new Date() } = {}) {
  if (tinchVaqt(hozir)) return [];
  const lokal = !process.env.VERCEL && process.env.SMS_REAL !== '1';
  const bugun = uzSana(hozir);
  const soat = uzSoat(hozir);
  const kun = Number(bugun.slice(8, 10));
  const orgs = await prisma.organization.findMany({ select: { id: true, qarzXabari: true, schools: { select: { id: true, name: true } } } });
  const natija = [];
  for (const org of orgs) {
    const raw = org.qarzXabari;
    if (!raw || typeof raw !== 'object') continue;
    const s = sozlamaniTozala(raw);
    if (!s.yoqilgan || kun < s.kun || soat < s.soat) continue;
    // Lokal server haqiqiy markazning jadvaliga tegmaydi (belgini ham qo'ymaydi).
    if (lokal && !(org.schools.length && org.schools.every(x => x.name.startsWith('ZZ ')))) continue;
    if (raw.oxirgiAvto === bugun) continue;
    const olindi = await prisma.$executeRaw`
      UPDATE "Organization" SET "qarzXabari" = jsonb_set("qarzXabari", '{oxirgiAvto}', to_jsonb(${bugun}::text))
      WHERE id = ${org.id} AND COALESCE("qarzXabari"->>'oxirgiAvto', '') <> ${bugun}`;
    if (!olindi) continue;
    for (const sch of org.schools) {
      const qs = await qarzdorlar(sch.id, { hozir });
      const tanlangan = qs.filter(q => nomzodmi(q, s, hozir));
      if (tanlangan.length) {
        await prisma.qarzXabari.createMany({
          data: tanlangan.map(q => ({ schoolId: sch.id, studentId: q.student.id, manba: 'avto', holat: 'kutmoqda' })),
        });
      }
      natija.push({ organizationId: org.id, schoolId: sch.id, qarzdor: qs.length, yaratildi: tanlangan.length });
    }
  }
  return natija;
}

// ---------------------------------------------------------------------------
// Ota-ona javobi ("✅ To'laganman")
// ---------------------------------------------------------------------------

const KIMDAN = { parent_father: 'FATHER', parent_mother: 'MOTHER', student: 'STUDENT' };
export const kimdanTuri = (botTuri) => KIMDAN[botTuri] || null;

/**
 * Bot orqali kelgan javob. Bir ota-onaning 30 daqiqa ichidagi ketma-ket
 * xabarlari (izoh, keyin chek rasmi) bitta javobga qo'shiladi.
 */
export async function javobYarat({ studentId, kimdan = null, tgChat = null, matn = null, rasm = null }) {
  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, name: true, schoolId: true, balance: true } });
  if (!st) return null;
  const yangiMatn = matn ? String(matn).trim().slice(0, 1000) : null;
  const ochiq = tgChat
    ? await prisma.qarzJavob.findFirst({
        where: { studentId, tgChat: String(tgChat), holat: 'ochiq', createdAt: { gte: new Date(Date.now() - 30 * 60e3) } },
        orderBy: { id: 'desc' },
      })
    : null;
  const row = ochiq
    ? await prisma.qarzJavob.update({
        where: { id: ochiq.id },
        data: {
          matn: [ochiq.matn, yangiMatn].filter(Boolean).join('\n').slice(0, 2000) || null,
          ...(rasm ? { rasm } : {}),
        },
      })
    : await prisma.qarzJavob.create({
        data: {
          schoolId: st.schoolId, studentId, kimdan, tgChat: tgChat ? String(tgChat) : null,
          matn: yangiMatn, rasm, qarz: Math.max(0, Math.round(-(Number(st.balance) || 0))),
        },
      });
  // Navbatdagi avtomatik eslatmalar kerak emas — xodim tekshiradi.
  await prisma.qarzXabari.updateMany({
    where: { studentId, manba: 'avto', holat: 'kutmoqda' },
    data: { holat: 'bekor', sabab: "Ota-ona to'laganini aytdi — xodim tekshiryapti" },
  });
  if (tr?.adminlarga) {
    const html = [
      `🧾 <b>Ota-ona «to'laganman» dedi</b>`,
      `👤 ${esc(ismKor(st.name))}${kimdan ? ` (${KIMGA_NOMI[kimdan] || ''})` : ''}`,
      `💰 CRM dagi qarz: <b>${som(Math.max(0, -(Number(st.balance) || 0)))} so'm</b>`,
      yangiMatn ? `📝 ${esc(yangiMatn)}` : (rasm ? '📎 Chek rasmi' : ''),
      '',
      "Tekshirib, CRM da yoping: Xabarlar → Avtomatik → Qarzdorlik eslatmasi.",
    ].filter(x => x !== null && x !== undefined).join('\n');
    await Promise.race([
      tr.adminlarga(st.schoolId, html, rasm).catch(e => console.error('[Qarz javobi → admin]', e.message)),
      new Promise(r => setTimeout(r, 6000)),
    ]);
  }
  return row;
}

/** Ochiq javoblar va oxirgi yopilganlar (kartada). */
export async function javoblarRoyxati(schoolIds, { cheklov = 10 } = {}) {
  const [ochiq, yopilgan] = await Promise.all([
    prisma.qarzJavob.findMany({ where: { schoolId: { in: schoolIds }, holat: 'ochiq' }, orderBy: { id: 'desc' }, take: 200 }),
    prisma.qarzJavob.findMany({ where: { schoolId: { in: schoolIds }, holat: 'hal' }, orderBy: { halAt: 'desc' }, take: cheklov }),
  ]);
  const rows = [...ochiq, ...yopilgan];
  const students = rows.length
    ? await prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, name: true, balance: true } })
    : [];
  const st = new Map(students.map(s => [s.id, s]));
  return rows.map(r => ({
    id: r.id, studentId: r.studentId, ism: st.get(r.studentId)?.name || "o'chirilgan o'quvchi",
    hozirgiQarz: Math.max(0, Math.round(-(Number(st.get(r.studentId)?.balance) || 0))),
    kimdan: r.kimdan, matn: r.matn, rasm: !!r.rasm, qarz: r.qarz, holat: r.holat, natija: r.natija, izoh: r.izoh,
    halQildi: r.halQildi, createdAt: r.createdAt, halAt: r.halAt,
  }));
}

/**
 * Xodim javobni yopadi: "kiritildi" (to'lov topildi va kiritildi) yoki
 * "togri" (to'lov topilmadi, qarz to'g'ri). Natija ota-onaga Telegram'da.
 */
export async function javobniYop(id, { natija, izoh, user }) {
  if (!['kiritildi', 'togri'].includes(natija)) return { status: 400, error: "Natija noto'g'ri" };
  const row = await prisma.qarzJavob.findUnique({ where: { id } });
  if (!row) return { status: 404, error: 'Javob topilmadi' };
  if (row.holat !== 'ochiq') return { status: 409, error: `Bu javob allaqachon yopilgan${row.halQildi ? ` — ${row.halQildi}` : ''}` };
  const izohT = String(izoh || '').trim().slice(0, 500) || null;
  const yangi = await prisma.qarzJavob.update({
    where: { id },
    data: { holat: 'hal', natija, izoh: izohT, halQildi: user?.name || null, halQildiId: user?.id ?? null, halAt: new Date() },
  });
  let xabar = null;
  if (row.tgChat && tr?.telegram) {
    const [st, s] = await Promise.all([
      prisma.student.findUnique({ where: { id: row.studentId }, select: { name: true, balance: true } }),
      qarzSozlamasi(row.schoolId),
    ]);
    const qarz = Math.max(0, Math.round(-(Number(st?.balance) || 0)));
    const ism = esc(ismKor(st?.name || ''));
    const matn = natija === 'kiritildi'
      ? [
          `✅ <b>${ism}</b>: to'lovingiz tekshirildi va hisobga kiritildi. Rahmat!`,
          qarz > 0 ? `Hozirgi qarz: ${som(qarz)} so'm.` : "Hozir qarz yo'q.",
          izohT ? `📝 ${esc(izohT)}` : '',
        ]
      : [
          `ℹ️ <b>${ism}</b>: tekshirdik — bu to'lov bizning hisobimizda topilmadi.`,
          qarz > 0 ? `Hozirgi qarz: ${som(qarz)} so'm.` : '',
          izohT ? `📝 ${esc(izohT)}` : '',
          s?.sozlama.aloqa ? `Savollar bo'lsa: ${esc(s.sozlama.aloqa)}` : '',
        ];
    const r = await tr.telegram(row.schoolId, row.tgChat, matn.filter(Boolean).join('\n'), { studentId: row.studentId, toName: st?.name || null });
    xabar = r.success ? 'yuborildi' : (r.xato || 'ketmadi');
  }
  return { row: yangi, xabar };
}

/** Javobdagi chek rasmi (Telegram file_id) — server uni botdan olib beradi. */
export async function javobRasmi(id) {
  const row = await prisma.qarzJavob.findUnique({ where: { id }, select: { id: true, schoolId: true, rasm: true } });
  return row?.rasm ? row : null;
}

// ---------------------------------------------------------------------------
// Ro'yxat, statistika, sinov
// ---------------------------------------------------------------------------

export async function qarzXabarlariRoyxati(schoolIds, { cheklov = 30 } = {}) {
  const rows = await prisma.qarzXabari.findMany({ where: { schoolId: { in: schoolIds } }, orderBy: { id: 'desc' }, take: cheklov });
  const students = rows.length
    ? await prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, name: true } })
    : [];
  const ism = new Map(students.map(s => [s.id, s.name]));
  const g = await prisma.qarzXabari.groupBy({ by: ['holat'], where: { schoolId: { in: schoolIds }, createdAt: { gte: oyBoshi() } }, _count: true });
  return {
    statistika: Object.fromEntries(g.map(x => [x.holat, x._count])),
    royxat: rows.map(r => ({
      id: r.id, studentId: r.studentId, ism: ism.get(r.studentId) || "o'chirilgan o'quvchi",
      manba: r.manba, holat: r.holat, sabab: r.sabab, kanal: r.kanal, summa: r.summa,
      raqamlar: Array.isArray(r.raqamlar) ? r.raqamlar : [],
      yuboruvchi: r.yuboruvchi, createdAt: r.createdAt, yuborilganAt: r.yuborilganAt, yetkazilganAt: r.yetkazilganAt,
    })),
  };
}

/** Namuna o'quvchi — kartadagi ko'rinish va sinov SMS i uchun. */
export const NAMUNA = {
  ism: 'Alimov Jasur',
  tafsil: {
    jami: 800000,
    kurslar: [
      { groupId: 1, nom: 'Matematika-4', qarz: 500000, oylar: ['2026-09'] },
      { groupId: 2, nom: 'Fizika-1', qarz: 300000, oylar: ['2026-09'] },
    ],
    eski: 0,
    avans: 0,
  },
  oxirgiTolov: { sana: '2026-08-05', summa: 800000 },
};

/** Sinov SMS: tanlangan matn namuna ism va summa bilan ko'rsatilgan raqamga. */
export async function qarzSinovXabari(schoolId, telefon) {
  const tel = uzRaqam(telefon);
  if (!tel) return { status: 400, error: "Telefon raqami noto'g'ri" };
  const s = await qarzSozlamasi(schoolId);
  const shablon = s?.shablonlar.find(t => t.id === s.sozlama.shablonId);
  if (!shablon) return { status: 400, error: 'SMS matni (shablon) tanlanmagan' };
  if (!eskizYuboradi(shablon.eskizStatus)) return { status: 400, error: 'Eskiz bu matnni hali tasdiqlamagan — SMS yetib bormaydi' };
  const orgName = await markazNomi(schoolId);
  const matn = smsMatni(fillTemplate(shablon.body, { name: NAMUNA.ism, balance: -NAMUNA.tafsil.jami, lastPaymentAmount: NAMUNA.oxirgiTolov.summa }, [], { orgName }));
  const r = tr?.sms ? await tr.sms(tel, matn, { schoolId, studentId: null }) : { success: false, xato: 'SMS ulanmagan' };
  return r.success ? { ok: true, matn } : { status: 502, error: `SMS ketmadi: ${XATO_SABABI[xatoTuri(r.xato)] || r.xato}` };
}

