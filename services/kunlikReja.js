/**
 * Kunlik transport rejasi.
 *
 * Marshrut endi statik emas. Har kuni quyidagilardan hisoblanadi:
 *   1. Bugun qaysi guruhlarda dars bor va qachon tugaydi (`Group.schedule`).
 *   2. O'sha guruhlarda transportga yozilgan o'quvchilar
 *      (`Student.needsTransport`), bugun "Kelmapdi" deb belgilanganlar
 *      hisobga olinmaydi.
 *   3. Dars tugashidan ~2 soat oldin so'ralgan va "HA" degan haydovchilar.
 *
 * Yaqin tugash vaqtlari bitta to'lqinga birlashadi: 20:55 va 21:00 uchun
 * alohida mashina chiqarish ma'nosiz.
 */
import prisma from '../lib/prisma.js';
import { isLessonDay, toDateStr, toTimeStr } from '../lib/lessons.js';
import { darsTugashi, daqiqaga, vaqtga, tolqinlarniBirlashtirish } from '../lib/jadval.js';
import { reyalarniTuzish } from '../lib/rejalash.js';
import { markazNuqtasi } from './logistics.js';

/** Haydovchidan necha daqiqa oldin so'raladi. */
export const SORASH_OLDIN_DAQIQA = 120;

/**
 * Bugungi to'lqinlar: qaysi vaqtda nechta bola uyga ketishi kerak.
 *
 * @returns {Promise<{tolqinlar: object[], jadvalsiz: object[]}>}
 *   tolqinlar — { endTime, guruhlar, oquvchilar, kelmaganlar }
 *   jadvalsiz — tugash vaqti to'ldirilmagan guruhlar (admin to'ldirishi kerak)
 */
export async function kunlikTolqinlar({ schoolId, date = toDateStr() }) {
  const guruhlar = await prisma.group.findMany({
    where: { schoolId },
    select: {
      id: true, name: true, days: true, schedule: true,
      students: {
        where: { needsTransport: true, status: { in: ['Faol', 'Sinov'] } },
        select: { id: true, name: true, location: true, address: true, phone: true, photo: true },
      },
    },
  });

  // Bugun darsi bor guruhlar.
  const bugungi = guruhlar.filter(g => isLessonDay(g.days, date));
  const jadvalsiz = [];
  const vaqtBoyicha = new Map();

  for (const g of bugungi) {
    const oxiri = darsTugashi(g.schedule);
    if (!oxiri) {
      // Transportga yozilgan o'quvchisi bo'lsagina muhim.
      if (g.students.length) jadvalsiz.push({ id: g.id, name: g.name, oquvchi: g.students.length });
      continue;
    }
    if (!vaqtBoyicha.has(oxiri)) vaqtBoyicha.set(oxiri, []);
    vaqtBoyicha.get(oxiri).push(g);
  }

  // Bugun "Kelmapdi" deb belgilanganlar reja tashqarisida.
  const kelmaganYozuv = await prisma.attendance.findMany({
    where: { schoolId, date, status: 'Kelmapdi' },
    select: { studentId: true },
  });
  const kelmagan = new Set(kelmaganYozuv.map(x => x.studentId));

  const birlashgan = tolqinlarniBirlashtirish([...vaqtBoyicha.keys()]);
  const tolqinlar = birlashgan.map(t => {
    const guruhRoyxat = t.ichidagilar.flatMap(v => vaqtBoyicha.get(v) || []);
    // Bir o'quvchi ikki guruhda bo'lishi mumkin — bir marta olinadi.
    const koringan = new Map();
    const chiqmaganlar = [];
    for (const g of guruhRoyxat) {
      for (const st of g.students) {
        if (kelmagan.has(st.id)) {
          if (!chiqmaganlar.some(x => x.id === st.id)) chiqmaganlar.push({ id: st.id, name: st.name });
          continue;
        }
        if (!koringan.has(st.id)) koringan.set(st.id, st);
      }
    }
    return {
      endTime: t.vaqt,
      guruhlar: guruhRoyxat.map(g => ({ id: g.id, name: g.name, tugashi: darsTugashi(g.schedule) })),
      oquvchilar: [...koringan.values()],
      kelmaganlar: chiqmaganlar,
    };
  }).sort((a, b) => a.endTime.localeCompare(b.endTime));

  return { tolqinlar, jadvalsiz };
}

/** Shu to'lqin uchun haydovchilarning javoblari. */
export async function haydovchiJavoblari({ schoolId, date, endTime }) {
  return prisma.driverAvailability.findMany({
    where: { schoolId, date, endTime },
    include: {
      driver: {
        select: {
          id: true, name: true, phone: true, telegramId: true,
          driverTransport: { select: { id: true, name: true, capacity: true, status: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
}

/**
 * Haydovchilardan so'raydi: bugun shu to'lqinda qatnasha oladimi.
 *
 * Bir marta so'ralgan haydovchiga ikkinchi marta yozilmaydi. Telegramga
 * ulanmagan haydovchi ham yozuvga tushadi — admin ro'yxatda ko'radi va
 * qo'ng'iroq qiladi.
 */
export async function haydovchilardanSorash({ schoolId, date, endTime, oquvchiSoni = 0 }) {
  const haydovchilar = await prisma.user.findMany({
    where: { schoolId, role: 'DRIVER', status: { not: 'Arxiv' } },
    select: {
      id: true, name: true, telegramId: true,
      driverTransport: { select: { name: true, capacity: true, status: true } },
    },
  });

  const bor = await prisma.driverAvailability.findMany({
    where: { schoolId, date, endTime },
    select: { driverId: true },
  });
  const soralgan = new Set(bor.map(x => x.driverId));

  const yangilar = haydovchilar.filter(h => !soralgan.has(h.id));
  if (yangilar.length === 0) return { sorandi: 0, yuborildi: 0 };

  await prisma.driverAvailability.createMany({
    data: yangilar.map(h => ({ driverId: h.id, date, endTime, schoolId, status: 'KUTILMOQDA' })),
    skipDuplicates: true,
  });

  // Telegramga xabar — botga ulanganlariga.
  let yuborildi = 0;
  const ulangan = yangilar.filter(h => h.telegramId);
  if (ulangan.length) {
    try {
      const { getTelegramBot } = await import('../src/bot/bot.js');
      const bot = await getTelegramBot(schoolId);
      if (bot) {
        const { Markup } = await import('telegraf');
        for (const h of ulangan) {
          const sigim = h.driverTransport?.capacity;
          let matn = `🚌 <b>Bugun ${endTime} da</b> dars tugaydi\n`;
          matn += `👥 ${oquvchiSoni} ta o'quvchini uyiga yetkazish kerak\n`;
          if (h.driverTransport) matn += `🚍 Sizning mashinangiz: ${h.driverTransport.name}${sigim ? ` (${sigim} o'rin)` : ''}\n`;
          matn += `\nQatnasha olasizmi?`;
          try {
            await bot.telegram.sendMessage(h.telegramId, matn, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([[
                Markup.button.callback('✅ Ha, qatnashaman', `hd_ha_${date}_${endTime}`),
                Markup.button.callback('❌ Yo\'q', `hd_yoq_${date}_${endTime}`),
              ]]),
            });
            yuborildi++;
          } catch (_) { /* ulanish uzilgan bo'lsa admin ro'yxatda ko'radi */ }
        }
      }
    } catch (err) {
      console.error('[Haydovchidan so\'rash]', err.message);
    }
  }
  return { sorandi: yangilar.length, yuborildi };
}

/** Haydovchining javobini yozadi. */
export async function javobniYozish({ driverId, date, endTime, status, schoolId }) {
  const bor = await prisma.driverAvailability.findFirst({ where: { driverId, date, endTime } });
  if (!bor) {
    return prisma.driverAvailability.create({
      data: { driverId, date, endTime, schoolId, status, answeredAt: new Date() },
    });
  }
  return prisma.driverAvailability.update({
    where: { id: bor.id },
    data: { status, answeredAt: new Date() },
  });
}

/**
 * Kunlik reja: shu to'lqindagi o'quvchilarni tasdiqlagan haydovchilar
 * mashinalariga taqsimlaydi.
 *
 * `apply: false` — faqat hisob. `apply: true` — shu kunning marshrutlari
 * yoziladi (`Route.date` shu sana bilan), eskilari yangilanadi.
 */
export async function kunlikRejaniTuzish({ schoolId, date = toDateStr(), endTime, rejim = 'tez', apply = false }) {
  const { tolqinlar } = await kunlikTolqinlar({ schoolId, date });
  const tolqin = tolqinlar.find(t => t.endTime === endTime);
  if (!tolqin) return { xato: `${endTime} uchun bugun dars topilmadi` };

  const javoblar = await haydovchiJavoblari({ schoolId, date, endTime });
  const tasdiqlagan = javoblar.filter(j => j.status === 'HA' && j.driver?.driverTransport
    && j.driver.driverTransport.status === 'Faol');

  const mashinalar = tasdiqlagan.map(j => ({
    id: j.driver.driverTransport.id,
    name: j.driver.driverTransport.name,
    capacity: j.driver.driverTransport.capacity,
    driverId: j.driver.id,
    driverName: j.driver.name,
  }));

  const markaz = await markazNuqtasi(schoolId);
  const natija = reyalarniTuzish({
    markaz,
    oquvchilar: tolqin.oquvchilar,
    mashinalar,
    direction: 'QAYTISH',
    startTime: endTime,
    rejim,
  });

  const ism = new Map(tolqin.oquvchilar.map(o => [o.id, o.name]));
  const rejalar = natija.rejalar.map(r => {
    const m = mashinalar.find(x => x.id === r.transportId);
    return {
      ...r,
      driverId: m?.driverId || null,
      driverName: m?.driverName || null,
      nomi: `${r.transportName} — ${endTime}${r.navbat > 1 ? ` (${r.navbat}-reys)` : ''}`,
      oquvchilar: r.studentIds.map(id => ({ id, name: ism.get(id) })),
      // Oxirgi bola uyda taxminan qachon bo'ladi (yarim tundan o'tishi mumkin).
      tugashi: vaqtga(((daqiqaga(r.startTime) || 0) + r.daqiqa) % 1440),
      // To'lqin boshlanishidan necha daqiqa o'tgani — taqqoslash uchun,
      // chunki soat "00:20" satr sifatida "23:40" dan kichik ko'rinadi.
      tugashOfset: (((daqiqaga(r.startTime) || 0) - (daqiqaga(endTime) || 0) + 1440) % 1440) + r.daqiqa,
    };
  });

  const javob = {
    endTime,
    date,
    jami: {
      oquvchi: tolqin.oquvchilar.length,
      kelmagan: tolqin.kelmaganlar.length,
      guruh: tolqin.guruhlar.length,
      haydovchiSoralgan: javoblar.length,
      haydovchiTasdiqlagan: tasdiqlagan.length,
      javobKutilmoqda: javoblar.filter(j => j.status === 'KUTILMOQDA').length,
      orin: mashinalar.reduce((s, m) => s + (m.capacity || 0), 0),
      km: natija.rejalar.reduce((s, r) => s + r.km, 0),
      // Eng muhim raqam: oxirgi bola uyda soat nechada bo'ladi.
      oxirgiBola: rejalar.length
        ? rejalar.reduce((a, b) => (b.tugashOfset > a.tugashOfset ? b : a)).tugashi
        : null,
      oxirgiBolaDaqiqa: rejalar.length ? Math.max(...rejalar.map(r => r.tugashOfset)) : 0,
    },
    rejalar,
    sigmaganlar: natija.sigmaganlar.map(id => ({ id, name: ism.get(id) })),
    nuqtasiz: natija.nuqtasiz.map(id => ({ id, name: ism.get(id) })),
    kelmaganlar: tolqin.kelmaganlar,
    javoblar: javoblar.map(j => ({
      driverId: j.driver.id, name: j.driver.name, status: j.status,
      telegram: !!j.driver.telegramId,
      mashina: j.driver.driverTransport?.name || null,
      sigim: j.driver.driverTransport?.capacity || null,
    })),
    qollandi: false,
  };
  if (!apply) return javob;

  // --- marshrutlarni yozamiz ---
  const mavjud = await prisma.route.findMany({
    where: { schoolId, date, autoPlanned: true, startTime: endTime },
    select: { id: true, transportId: true, navbat: true },
  });
  const ishlatilgan = new Set();

  for (const r of rejalar) {
    const bor = mavjud.find(m => m.transportId === r.transportId && m.navbat === r.navbat);
    const data = {
      name: r.nomi, startTime: r.startTime, days: 'HAR_KUNI', direction: 'QAYTISH',
      transportId: r.transportId, driverId: r.driverId,
      autoPlanned: true, autoOrder: true, navbat: r.navbat, date, schoolId,
    };
    const route = bor
      ? await prisma.route.update({ where: { id: bor.id }, data })
      : await prisma.route.create({ data });
    ishlatilgan.add(route.id);

    await prisma.routeStop.deleteMany({ where: { routeId: route.id, studentId: { notIn: r.studentIds } } });
    for (let i = 0; i < r.studentIds.length; i++) {
      await prisma.routeStop.upsert({
        where: { routeId_studentId: { routeId: route.id, studentId: r.studentIds[i] } },
        create: { routeId: route.id, studentId: r.studentIds[i], tartib: i },
        update: { tartib: i },
      });
    }
    r.routeId = route.id;
  }

  // Rejadan tushib qolganlari bo'shatiladi (reys tarixi saqlanadi).
  for (const m of mavjud.filter(x => !ishlatilgan.has(x.id))) {
    await prisma.routeStop.deleteMany({ where: { routeId: m.id } });
  }
  javob.qollandi = true;
  return javob;
}

/**
 * Avtomatik jarayon (cron): yaqinlashib kelayotgan to'lqinlar uchun
 * haydovchilardan so'raydi.
 *
 * Bir necha marta chaqirilsa ham xavfsiz: allaqachon so'ralganiga qayta
 * yozilmaydi.
 */
export async function avtoJarayon({ schoolId = null } = {}) {
  const natijalar = [];
  const filiallar = schoolId
    ? [{ id: schoolId }]
    : await prisma.school.findMany({ select: { id: true } });

  for (const f of filiallar) {
    const date = toDateStr();
    const hozir = daqiqaga(toTimeStr());
    const { tolqinlar } = await kunlikTolqinlar({ schoolId: f.id, date });

    for (const t of tolqinlar) {
      if (t.oquvchilar.length === 0) continue;
      const tugash = daqiqaga(t.endTime);
      const qolgan = tugash - hozir;
      // Faqat oldindagi va 2 soatdan yaqin to'lqinlar.
      if (qolgan < 0 || qolgan > SORASH_OLDIN_DAQIQA) continue;

      const r = await haydovchilardanSorash({
        schoolId: f.id, date, endTime: t.endTime, oquvchiSoni: t.oquvchilar.length,
      });
      if (r.sorandi) {
        natijalar.push({ schoolId: f.id, endTime: t.endTime, ...r, oquvchi: t.oquvchilar.length });
      }
    }
  }
  return natijalar;
}
