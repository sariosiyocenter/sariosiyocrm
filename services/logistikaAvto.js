/**
 * Logistika avtomatikasi (egasi, 2026-09-27).
 *
 * Egasining oqimi: "masalan 18:00 da dars tugaydi — tizim undan oldin hamma
 * haydovchiga xabar yuborsin, kim javob bersa — o'sha keladi; o'rin qancha
 * kerakligini o'zimiz hisoblaymiz, ortiqchasiga kerak emas deymiz; haydovchi
 * yetmasa ba'zilari ikki reys qiladi".
 *
 * Har bir to'lqin (dars tugash vaqti, services/kunlikReja.js → kunlikTolqinlar)
 * uchun ikki qadam:
 *   1. Dars tugashidan `sorashOldin` daqiqa oldin — filialning mashinasi bor
 *      hamma haydovchisiga Telegram: "18:00 da kela olasizmi? [Ha] [Yo'q]".
 *   2. `rejalashOldin` daqiqa oldin — "Ha" deganlarning mashinalariga bolalar
 *      yo'l bo'yicha bo'linadi (lib/yolReja.js, 3 tagacha reys), reja har
 *      haydovchiga yuboriladi, keraksiz qolgan "Ha" chilarga "rahmat, bugun
 *      kerak emas" deyiladi. Bolaga joy yetmasa yoki "Ha" degan hech kim
 *      bo'lmasa — adminlarga Telegram.
 * Admin shu ishlarni Logistika → Reja sahifasidan istalgan payt o'zi ham
 * qiladi; admin reja tuzgan to'lqinga avtomatika tegmaydi.
 *
 * Ota-onaga "farzandingiz yo'lga chiqdi / uyiga yetdi" xabari bu yerda emas:
 * u haydovchi botda "Qabul qildim" / "Yetkazdim" bosganda ketadi va
 * Xabarlar → Avtomatik dagi Transport qoidasi bilan yoqiladi (sukut: o'chiq).
 *
 * Tekshiruv fonda (server.js: har API so'rovida, 2 daqiqada bir marta).
 * Bir necha server nusxasi bir vaqtda ishlasa ham bir ish ikki marta
 * bo'lmaydi: TransportTolqin dagi vaqt belgisi atomik "egallanadi".
 */
import prisma from '../lib/prisma.js';
import { toDateStr, toTimeStr } from '../lib/lessons.js';
import { daqiqaga, vaqtga } from '../lib/jadval.js';
import { parseLatLng } from '../lib/tartib.js';
import { yangidanTaqsimlash, reysKorsatkichi } from '../lib/rejaTahrir.js';
import { YolManbai } from '../lib/yolMasofa.js';
import { kunlikTolqinlar, haydovchilardanSorash, filialHaydovchilari } from './kunlikReja.js';
import { kunniSaqlash, markazNuqtasi } from './logistics.js';

/** Sukut: ikkalasi yoqilgan — egasi aynan shuni so'radi. */
export const AVTO_STANDART = Object.freeze({ sorash: true, sorashOldin: 60, rejalash: true, rejalashOldin: 15 });
/** So'rovdan keyin reja kamida shuncha daqiqa kutadi — haydovchilar javob berishga ulgursin. */
const JAVOB_KUTISH_DAQIQA = 10;
/** Dars tugagandan keyin ham shuncha daqiqa ichida reja tuzilishi mumkin (fon tekshiruvi kechiksa). */
const KECH_REJA_DAQIQA = 60;
/** OSRM ochiq serveri dasturni tanishi kerak (foydalanish qoidasi). */
const OSRM_SARLAVHA = { 'User-Agent': 'SariosiyoCRM/1.0 (+https://sariosiyocrm.vercel.app)' };

/** Sozlamani tozalash: raqamlar chegarada, reja so'rovdan keyin. */
export function avtoSozlamasi(xom) {
  const x = xom && typeof xom === 'object' ? xom : {};
  const son = (v, min, max, std) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
  };
  const sorashOldin = son(x.sorashOldin, 15, 240, AVTO_STANDART.sorashOldin);
  let rejalashOldin = son(x.rejalashOldin, 0, 120, AVTO_STANDART.rejalashOldin);
  if (rejalashOldin > sorashOldin - JAVOB_KUTISH_DAQIQA) rejalashOldin = Math.max(0, sorashOldin - JAVOB_KUTISH_DAQIQA);
  return {
    sorash: x.sorash === undefined ? AVTO_STANDART.sorash : !!x.sorash,
    sorashOldin,
    rejalash: x.rejalash === undefined ? AVTO_STANDART.rejalash : !!x.rejalash,
    rejalashOldin,
  };
}

/** Filial tashkilotining avtomatika sozlamasi. */
export async function filialAvtosi(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { organization: { select: { id: true, logistikaAvto: true } } },
  });
  return { orgId: school?.organization?.id || null, sozlama: avtoSozlamasi(school?.organization?.logistikaAvto) };
}

export async function avtoniSaqlash(schoolId, xom) {
  const { orgId } = await filialAvtosi(schoolId);
  if (!orgId) return { xato: "Filial tashkilotga bog'lanmagan" };
  const sozlama = avtoSozlamasi(xom);
  await prisma.organization.update({ where: { id: orgId }, data: { logistikaAvto: sozlama } });
  return { sozlama };
}

/**
 * Hozir shu to'lqin uchun nima qilish kerak. Sof funksiya (sinovlar uchun).
 * @param {{ hozir:number, endTime:string, sozlama:object, soralganAt?:Date|string|null,
 *           rejaAt?:Date|string|null, rejaBor?:boolean, hozirMs?:number }} p
 *   hozir — bugun yarim tundan beri daqiqa (Toshkent)
 * @returns {'sorash'|'rejalash'|null}
 */
export function tolqinQadami({ hozir, endTime, sozlama, soralganAt = null, rejaAt = null, rejaBor = false, hozirMs = Date.now() }) {
  const tugash = daqiqaga(endTime);
  if (tugash === null || rejaBor) return null;
  if (sozlama.rejalash && !rejaAt && hozir >= tugash - sozlama.rejalashOldin && hozir <= tugash + KECH_REJA_DAQIQA) {
    const kutildi = !sozlama.sorash
      || (soralganAt && hozirMs - new Date(soralganAt).getTime() >= JAVOB_KUTISH_DAQIQA * 60000)
      || hozir >= tugash;
    if (kutildi) return 'rejalash';
  }
  if (sozlama.sorash && !soralganAt && hozir >= tugash - sozlama.sorashOldin && hozir < tugash) return 'sorash';
  return null;
}

/** To'lqin holati yozuvi (bo'lmasa yaratiladi). */
async function belgi(schoolId, date, endTime) {
  return prisma.transportTolqin.upsert({
    where: { schoolId_date_endTime: { schoolId, date, endTime } },
    create: { schoolId, date, endTime },
    update: {},
  });
}

/**
 * Sahifa uchun: bugungi to'lqinlar, har birining bolalari, haydovchilar
 * javoblari va avtomatika vaqtlari.
 */
export async function tolqinlarHolati({ schoolId, date }) {
  const [{ tolqinlar, jadvalsiz }, { sozlama }, belgilar, javoblar] = await Promise.all([
    kunlikTolqinlar({ schoolId, date }),
    filialAvtosi(schoolId),
    prisma.transportTolqin.findMany({ where: { schoolId, date } }),
    prisma.driverAvailability.findMany({
      where: { schoolId, date },
      select: { driverId: true, endTime: true, status: true, askedAt: true, answeredAt: true, izoh: true },
    }),
  ]);
  return {
    sozlama,
    bugun: toDateStr(),
    hozir: toTimeStr(),
    jadvalsiz,
    tolqinlar: tolqinlar.map(t => {
      const b = belgilar.find(x => x.endTime === t.endTime);
      const tugash = daqiqaga(t.endTime);
      return {
        endTime: t.endTime,
        kurslar: t.guruhlar.map(g => ({ id: g.id, name: g.name })),
        bolalar: t.oquvchilar.map(o => o.id),
        kelmaganlar: t.kelmaganlar.map(k => ({ id: k.id, sabab: k.sabab })),
        sorashVaqti: tugash === null ? null : vaqtga(tugash - sozlama.sorashOldin),
        rejaVaqti: tugash === null ? null : vaqtga(tugash - sozlama.rejalashOldin),
        soralganAt: b?.soralganAt || null,
        rejaAt: b?.rejaAt || null,
        izoh: b?.izoh || null,
        javoblar: javoblar.filter(j => j.endTime === t.endTime).map(j => ({
          driverId: j.driverId, status: j.status, askedAt: j.askedAt, answeredAt: j.answeredAt, kerakEmas: j.izoh === 'kerak_emas',
        })),
      };
    }),
  };
}

/**
 * Haydovchilardan so'rash (avtomatik yoki sahifadagi "Hozir so'rash").
 * `qayta` — javob bermaganlarga yana bir bor.
 */
export async function tolqinniSorash({ schoolId, date, endTime, qayta = false, avto = false }) {
  const b = await belgi(schoolId, date, endTime);
  if (avto) {
    // Bir nechta server nusxasi: faqat birinchisi so'raydi.
    const egalladi = await prisma.transportTolqin.updateMany({ where: { id: b.id, soralganAt: null }, data: { soralganAt: new Date() } });
    if (!egalladi.count) return { sorandi: 0, yuborildi: 0 };
  } else if (!b.soralganAt) {
    await prisma.transportTolqin.update({ where: { id: b.id }, data: { soralganAt: new Date() } });
  }
  const { sozlama } = await filialAvtosi(schoolId);
  const { tolqinlar } = await kunlikTolqinlar({ schoolId, date });
  const t = tolqinlar.find(x => x.endTime === endTime);
  const tugash = daqiqaga(endTime);
  return haydovchilardanSorash({
    schoolId, date, endTime, qayta,
    oquvchiSoni: t?.oquvchilar.length || 0,
    rejaVaqti: sozlama.rejalash && tugash !== null ? vaqtga(tugash - sozlama.rejalashOldin) : null,
  });
}

/** Admin haydovchi o'rniga javob belgilaydi (telefonda gaplashgan bo'lsa). */
export async function javobniBelgilash({ schoolId, date, endTime, driverId, status }) {
  if (!['HA', 'YOQ', 'KUTILMOQDA'].includes(status)) return { xato: "Javob noto'g'ri" };
  const haydovchilar = await filialHaydovchilari(schoolId);
  if (!haydovchilar.some(h => h.id === driverId)) return { xato: 'Haydovchi shu filialda topilmadi (yoki mashinasi kiritilmagan)' };
  const data = { status, answeredAt: status === 'KUTILMOQDA' ? null : new Date(), izoh: 'admin' };
  const javob = await prisma.driverAvailability.upsert({
    where: { driverId_date_endTime: { driverId, date, endTime } },
    create: { driverId, date, endTime, schoolId, ...data },
    update: data,
  });
  return { javob };
}

/**
 * "Ha" deb reja olmagan haydovchilarga: "rahmat, bugun kerak emas" (bir marta).
 * Reja saqlanganda chaqiriladi — avtomatik ham, sahifadan ham.
 */
export async function kerakEmaslargaAyt({ schoolId, date, endTime }) {
  const [rejadagi, ha] = await Promise.all([
    prisma.route.findMany({ where: { schoolId, date, tolqin: endTime }, select: { driverId: true } }),
    prisma.driverAvailability.findMany({
      where: { schoolId, date, endTime, status: 'HA' },
      select: { id: true, driverId: true, izoh: true, driver: { select: { telegramId: true } } },
    }),
  ]);
  const band = new Set(rejadagi.map(r => r.driverId));
  const kimga = ha.filter(j => !band.has(j.driverId) && j.izoh !== 'kerak_emas');
  if (!kimga.length) return 0;
  await prisma.driverAvailability.updateMany({ where: { id: { in: kimga.map(j => j.id) } }, data: { izoh: 'kerak_emas' } });
  const { getTelegramBot } = await import('../src/bot/bot.js');
  const bot = await getTelegramBot(schoolId);
  if (!bot) return 0;
  const matn = `🙏 Rahmat! Bugun <b>${endTime}</b> ga mashinalar yetarli — sizga reja yo'q.\nKeyingi safar yana so'raymiz.`;
  const ulangan = kimga.filter(j => j.driver?.telegramId);
  for (let i = 0; i < ulangan.length; i += 5) {
    await Promise.allSettled(ulangan.slice(i, i + 5).map(j => bot.telegram.sendMessage(j.driver.telegramId, matn, { parse_mode: 'HTML' })));
  }
  return ulangan.length;
}

/** Adminlarga oddiy matn (notifyAdmins HTML emas). */
async function adminlargaAyt(schoolId, matn) {
  try {
    const { notifyAdmins } = await import('../src/bot/bot.js');
    await notifyAdmins(matn, schoolId);
  } catch (e) {
    console.error('[Logistika avto] adminlarga', e.message);
  }
}

/**
 * To'lqin rejasini serverda tuzib, haydovchilarga yuboradi (avtomatik).
 * "Ha" deganlar mashinalariga yo'l bo'yicha; yo'l ma'lumoti (OSRM) olinmasa
 * to'g'ri chiziq bo'yicha. Admin allaqachon reja tuzgan bo'lsa tegilmaydi.
 */
export async function tolqinniRejalash({ schoolId, date, endTime }) {
  const b = await belgi(schoolId, date, endTime);
  const egalladi = await prisma.transportTolqin.updateMany({ where: { id: b.id, rejaAt: null }, data: { rejaAt: new Date() } });
  if (!egalladi.count) return { otkazildi: 'band' };
  const bosh = async (izoh, qaytaUrinish = false) => {
    await prisma.transportTolqin.update({ where: { id: b.id }, data: { izoh, ...(qaytaUrinish ? { rejaAt: null } : {}) } });
  };

  if (await prisma.route.count({ where: { schoolId, date, tolqin: endTime } })) {
    await bosh('reja_bor');
    return { otkazildi: 'reja_bor' };
  }

  const haydovchilar = await filialHaydovchilari(schoolId);
  const javoblar = await prisma.driverAvailability.findMany({
    where: { date, endTime, driverId: { in: haydovchilar.map(h => h.id) } },
    select: { driverId: true, status: true },
  });
  const haSet = new Set(javoblar.filter(j => j.status === 'HA').map(j => j.driverId));
  const ha = haydovchilar.filter(h => haSet.has(h.id));
  if (!ha.length) {
    // Keyinroq kimdir "Ha" desa — yana urinamiz; adminga faqat bir marta.
    if (b.izoh !== 'ha_yoq') {
      await adminlargaAyt(schoolId, `🚌 ${endTime}: hech bir haydovchi «Ha» demadi — reja tuzilmadi.\nLogistika → Reja: haydovchilar javobini belgilab, rejani tuzing.`);
    }
    await bosh('ha_yoq', true);
    return { xato: "«Ha» degan haydovchi yo'q" };
  }

  const { tolqinlar } = await kunlikTolqinlar({ schoolId, date });
  const t = tolqinlar.find(x => x.endTime === endTime);
  if (!t?.oquvchilar.length) {
    await bosh('bola_yoq');
    return { xato: "Bu to'lqinda bola yo'q" };
  }

  const markaz = await markazNuqtasi(schoolId);
  const joy = new Map(t.oquvchilar.map(o => [o.id, o.location]));
  const joyOl = (id) => joy.get(id) || null;
  const manba = new YolManbai({ sarlavhalar: OSRM_SARLAVHA });
  const yol = await manba.tayyorla([markaz, ...t.oquvchilar.map(o => parseLatLng(o.location)).filter(Boolean)]);
  const olchagich = manba.olchagich();

  const r = yangidanTaqsimlash({
    markaz, cars: [], rejasiz: t.oquvchilar.map(o => o.id), joyOl, olchagich,
    haydovchilar: ha.map(h => ({ id: h.id, capacity: h.driverTransport.capacity })),
  });
  const cars = r.cars.filter(c => c.studentIds.length).map(c => ({
    routeId: null, driverId: c.driverId,
    studentIds: reysKorsatkichi(c.studentIds, joyOl, markaz, olchagich).tartib,
  }));
  const saqlandi = await kunniSaqlash({ schoolId, date, cars, tartibli: true, tolqin: endTime });
  if (saqlandi.xato) {
    await bosh(saqlandi.xato, true);
    return { xato: saqlandi.xato };
  }

  const { rejaniHaydovchigaYuborish } = await import('../src/bot/bot.js');
  const yangilar = saqlandi.natijalar.filter(n => n.tur === 'yangi');
  for (let i = 0; i < yangilar.length; i += 5) {
    await Promise.allSettled(yangilar.slice(i, i + 5).map(n =>
      rejaniHaydovchigaYuborish({ schoolId, routeId: n.routeId, sarlavha: `🆕 <b>Yangi reja · ${endTime}</b>` })));
  }
  const bushatildi = await kerakEmaslargaAyt({ schoolId, date, endTime });
  if (r.sigmagan.length) {
    await adminlargaAyt(schoolId, `🚌 ${endTime}: reja haydovchilarga yuborildi, lekin ${r.sigmagan.length} ta bolaga joy yetmadi.\nLogistika → Reja: haydovchi qo'shing yoki bolalarni qo'lda joylang.`);
  }
  await bosh(yol.ok ? null : 'taxminiy');
  return { reyslar: cars.length, bola: cars.reduce((s, c) => s + c.studentIds.length, 0), sigmagan: r.sigmagan.length, kerakEmas: bushatildi };
}

let oxirgiTekshiruv = 0;

/**
 * Fon tekshiruvi: bugungi to'lqinlarning qaysi biri so'rash yoki
 * rejalash vaqtiga kelganini ko'radi va bajaradi. Bir server nusxasida
 * 2 daqiqada bir martadan tez ishlamaydi (`majburiy` — sinov/cron).
 */
export async function logistikaAvtoJarayon({ majburiy = false } = {}) {
  const hozirMs = Date.now();
  if (!majburiy && hozirMs - oxirgiTekshiruv < 2 * 60 * 1000) return [];
  oxirgiTekshiruv = hozirMs;

  const date = toDateStr();
  const hozir = daqiqaga(toTimeStr());
  const filiallar = await prisma.school.findMany({ select: { id: true, organization: { select: { logistikaAvto: true } } } });
  const natijalar = [];
  for (const f of filiallar) {
    const sozlama = avtoSozlamasi(f.organization?.logistikaAvto);
    if (!sozlama.sorash && !sozlama.rejalash) continue;
    const [{ tolqinlar }, belgilar, rejali] = await Promise.all([
      kunlikTolqinlar({ schoolId: f.id, date }),
      prisma.transportTolqin.findMany({ where: { schoolId: f.id, date } }),
      prisma.route.findMany({ where: { schoolId: f.id, date, tolqin: { not: null } }, select: { tolqin: true }, distinct: ['tolqin'] }),
    ]);
    const rejaBor = new Set(rejali.map(r => r.tolqin));
    for (const t of tolqinlar) {
      if (!t.oquvchilar.length) continue;
      const b = belgilar.find(x => x.endTime === t.endTime);
      const qadam = tolqinQadami({
        hozir, endTime: t.endTime, sozlama, hozirMs,
        soralganAt: b?.soralganAt, rejaAt: b?.rejaAt, rejaBor: rejaBor.has(t.endTime),
      });
      if (!qadam) continue;
      try {
        const natija = qadam === 'sorash'
          ? await tolqinniSorash({ schoolId: f.id, date, endTime: t.endTime, avto: true })
          : await tolqinniRejalash({ schoolId: f.id, date, endTime: t.endTime });
        natijalar.push({ schoolId: f.id, endTime: t.endTime, qadam, ...natija });
      } catch (e) {
        console.error('[Logistika avto]', f.id, t.endTime, qadam, e.message);
      }
    }
  }
  if (natijalar.length) console.log('[Logistika avto]', JSON.stringify(natijalar));
  return natijalar;
}
