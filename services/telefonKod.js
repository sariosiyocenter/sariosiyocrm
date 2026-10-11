// Telefon raqamni botda SMS kod bilan almashtirish (egasi, 2026-10-08).
//
// Yangi raqamga 5 xonali kod SMS bo'lib boradi; kodni kiritgan odam o'sha
// raqam egasi ekani tasdiqlanadi va raqam bazada almashtiriladi. Kodning o'zi
// hech qayerda saqlanmaydi: bu jadvalda faqat HMAC, SMS jurnalida "*****".
// SMS pullik, shuning uchun bir Telegram hisobiga kuniga ko'pi bilan
// KUNLIK_CHEKLOV ta kod, ikki so'rov orasida ORALIQ_SONIYA, bitta raqamga
// sutkada RAQAMGA_CHEKLOV ta. Holat: kutilmoqda | tasdiqlandi | bekor | xato
// (SMS ketmadi — kunlik limitga kirmaydi, lekin oraliq va o'z chegarasi bor)
// | ogoh (kod emas — rahbarlar ogohlantirilgani belgisi, ogohlantirishKerak).
//
// SMS ni server.js yuboradi (Eskiz, shablon moderatsiyasi u yerda) — bot
// server.js ga bog'lanib qolmasligi uchun server o'zini shu yerda ro'yxatdan
// o'tkazadi (services/transportNotify.js dagi kabi).
//
// SMS matni (standart matn, Eskiz rad etganda nima qilinishi) — lib/tolovXabari.js
// ("Tasdiqlash kodi SMS i"). SMS siz yo'l ham bor: odam Telegramdagi o'z raqamini
// yuborsa (contact.user_id === from.id), raqamni Telegram o'zi tasdiqlagan
// bo'ladi — kod kerak emas (src/bot/telefon.js).
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { uzRaqam } from '../lib/tolovXabari.js';

export { KOD_SHABLONI, kodShabloniMatni } from '../lib/tolovXabari.js';

export const KOD_MUDDATI_DAQIQA = 10;
export const KUNLIK_CHEKLOV = 4;
export const ORALIQ_SONIYA = 60;
export const URINISH_CHEKLOVI = 5;
/** Bitta raqamga (kim so'rashidan qat'i nazar) sutkada ko'pi bilan shuncha kod SMS i. */
export const RAQAMGA_CHEKLOV = 3;
/** "SMS kod ishlamayapti" ogohlantirishi rahbarlarga shuncha soatda bir marta. */
export const OGOH_ORALIQ_SOAT = 24;

let kodYuboruvchi = null;
let holatBeruvchi = null;
/**
 * server.js o'zini ulaydi:
 *   yubor({ telefon, kod, schoolId }) => Promise<{ success, moderatsiya?, holat?, xato? }>
 *   holat(schoolId) => Promise<'tayyor' | 'tekshiruvda' | 'rad' | 'ulanmagan'> — kod SMS i hozir keta oladimi.
 */
export function telefonSmsUlash(yubor, holat = null) { kodYuboruvchi = yubor; holatBeruvchi = holat; }

/**
 * Kod SMS i hozir keta oladimi (lib/tolovXabari.js kodSmsHolati). Shablon yo'q yoki eski bo'lsa server
 * shu chaqiruvda uni yaratib/yangilab Eskizga yuboradi. Aniqlab bo'lmasa (yoki uzoq javob) — 'tayyor':
 * urinishning o'zi aniq sababni aytadi.
 */
export async function smsHolati(schoolId) {
  if (!kodYuboruvchi) return 'ulanmagan';
  if (!holatBeruvchi) return 'tayyor';
  let vaqt;
  const kutish = new Promise(r => { vaqt = setTimeout(() => r('tayyor'), 6000); });
  try {
    return await Promise.race([holatBeruvchi(schoolId), kutish]);
  } catch (e) {
    console.error('[Telefon kodi] holat:', e.message);
    return 'tayyor';
  } finally {
    clearTimeout(vaqt);
  }
}

/**
 * Rahbarlarni "SMS kod ishlamayapti" deb ogohlantirish vaqti keldimi. Keldi bo'lsa — belgilab qo'yadi:
 * har urinishda emas, filialga OGOH_ORALIQ_SOAT soatda bir marta (serverda holat yo'q — belgi jadvalda,
 * "ogoh" yozuvi; uning tgChat i raqam emas, shuning uchun kod limitlariga aralashmaydi).
 */
export async function ogohlantirishKerak(schoolId, hozir = new Date()) {
  const tgChat = `ogoh:${schoolId || 0}`;
  const chegara = new Date(hozir.getTime() - OGOH_ORALIQ_SOAT * 3600 * 1000);
  if (await prisma.telefonKod.count({ where: { tgChat, holat: 'ogoh', createdAt: { gte: chegara } } })) return false;
  await prisma.telefonKod.create({ data: { tgChat, telefon: '', kodHash: '', holat: 'ogoh', expiresAt: hozir } });
  return true;
}

const sir = () => String(process.env.JWT_SECRET || 'telefon-kod');
const hash = (tgChat, telefon, kod) =>
  crypto.createHmac('sha256', sir()).update(`${tgChat}:${telefon}:${kod}`).digest('hex');

/** "+998 90 123-45-67" → "+998901234567" (bazada shu ko'rinishda); noto'g'ri bo'lsa null. */
export function bazaRaqami(v) {
  const r = uzRaqam(v);
  return r ? `+${r}` : null;
}

/**
 * Kod yaratadi va SMS yuboradi.
 * @returns {Promise<{ id: number } | { xato: string, raqamXato?: boolean, moderatsiya?: boolean, holat?: string }>}
 *          raqamXato — raqam noto'g'ri yozilgan (qayta so'rash kerak);
 *          moderatsiya — SMS matni Eskizda tasdiqlanmagan, holat: 'tekshiruvda' | 'rad' | 'ulanmagan'
 */
export async function kodYubor({ tgChat, telefon, schoolId, hozir = new Date() }) {
  const raqam = uzRaqam(telefon);
  if (!raqam) return { raqamXato: true, xato: "Raqam noto'g'ri. 9 ta raqam bilan yozing, masalan: 90 123 45 67" };
  if (!kodYuboruvchi) return { xato: "SMS xizmati ulanmagan. Raqamni markaz ma'muri orqali o'zgartiring." };

  const kunOldin = new Date(hozir.getTime() - 24 * 3600 * 1000);
  const [oxirgilar, shuRaqamga] = await Promise.all([
    prisma.telefonKod.findMany({
      where: { tgChat: String(tgChat), createdAt: { gte: kunOldin } },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true, holat: true },
    }),
    // Bitta raqamga turli hisoblardan ham ko'p SMS ketmasin (begona odamni bezovta qilish).
    prisma.telefonKod.count({ where: { telefon: raqam, holat: { not: 'xato' }, createdAt: { gte: kunOldin } } }),
  ]);
  const kopSoraldi = "Bugun juda ko'p kod so'raldi. Ertaga urinib ko'ring yoki markaz ma'muriga murojaat qiling.";
  // Ketmagan urinishlar ("xato") kunlik limitni yemaydi, lekin ular ham cheksiz emas.
  if (oxirgilar.filter(r => r.holat !== 'xato').length >= KUNLIK_CHEKLOV) return { xato: kopSoraldi };
  if (oxirgilar.filter(r => r.holat === 'xato').length >= KUNLIK_CHEKLOV * 2) return { xato: kopSoraldi };
  if (shuRaqamga >= RAQAMGA_CHEKLOV) return { xato: kopSoraldi };
  if (oxirgilar[0] && hozir - oxirgilar[0].createdAt < ORALIQ_SONIYA * 1000) {
    return { xato: `Kod hozirgina so'raldi. ${ORALIQ_SONIYA} soniyadan keyin qayta urinib ko'ring.` };
  }

  const kod = String(crypto.randomInt(10000, 100000));
  const natija = await kodYuboruvchi({ telefon: raqam, kod, schoolId }).catch(e => ({ success: false, xato: e.message }));
  if (!natija?.success) {
    await prisma.telefonKod.create({ data: { tgChat: String(tgChat), telefon: raqam, kodHash: '', holat: 'xato', expiresAt: hozir } });
    // moderatsiya — SMS matni Eskizda tasdiqlanmagan (tekshiruvda yoki rad etilgan): bot nima qilish mumkinligini aytadi.
    return natija?.moderatsiya
      ? { moderatsiya: true, holat: natija.holat || 'tekshiruvda', xato: "Hozircha SMS orqali kod yuborib bo'lmaydi: SMS matni aloqa operatori tasdig'idan o'tmagan." }
      : { xato: "SMS yuborib bo'lmadi. Birozdan keyin qayta urinib ko'ring yoki markaz ma'muriga murojaat qiling." };
  }

  // Eski kutilayotgan kodlar endi yaramaydi.
  await prisma.telefonKod.updateMany({ where: { tgChat: String(tgChat), holat: 'kutilmoqda' }, data: { holat: 'bekor' } });
  const row = await prisma.telefonKod.create({
    data: {
      tgChat: String(tgChat), telefon: raqam, kodHash: hash(tgChat, raqam, kod),
      expiresAt: new Date(hozir.getTime() + KOD_MUDDATI_DAQIQA * 60 * 1000),
    },
  });
  return { id: row.id };
}

/**
 * Kodni tekshiradi. To'g'ri bo'lsa yozuv "tasdiqlandi" bo'ladi.
 * @returns {Promise<{ telefon: string } | { xato: string, tugadi?: boolean }>}
 *          telefon — "+998XXXXXXXXX"; tugadi — yangi kod so'rash kerak.
 */
export async function kodTekshir({ id, tgChat, kod, hozir = new Date() }) {
  const row = await prisma.telefonKod.findUnique({ where: { id: Number(id) } });
  if (!row || row.tgChat !== String(tgChat) || row.holat !== 'kutilmoqda') {
    return { tugadi: true, xato: "Bu kod endi yaroqsiz. Profil → «Raqamni o'zgartirish» orqali yangi kod so'rang." };
  }
  if (row.expiresAt < hozir) {
    await prisma.telefonKod.update({ where: { id: row.id }, data: { holat: 'bekor' } });
    return { tugadi: true, xato: "Kodning muddati tugadi. Profil → «Raqamni o'zgartirish» orqali yangi kod so'rang." };
  }
  const kiritilgan = String(kod || '').replace(/\D/g, '');
  const togri = kiritilgan.length === 5 &&
    crypto.timingSafeEqual(Buffer.from(hash(row.tgChat, row.telefon, kiritilgan)), Buffer.from(row.kodHash));
  if (!togri) {
    // Sanagich bazaning o'zida oshiriladi — parallel urinishlar bir-birini bosib ketmaydi.
    const { urinish } = await prisma.telefonKod.update({ where: { id: row.id }, data: { urinish: { increment: 1 } }, select: { urinish: true } });
    const tugadi = urinish >= URINISH_CHEKLOVI;
    if (tugadi) await prisma.telefonKod.updateMany({ where: { id: row.id, holat: 'kutilmoqda' }, data: { holat: 'bekor' } });
    return tugadi
      ? { tugadi: true, xato: "Kod bir necha marta noto'g'ri kiritildi. Yangi kod so'rang." }
      : { xato: `Kod noto'g'ri. Yana ${URINISH_CHEKLOVI - urinish} ta urinish qoldi.` };
  }
  // Kod bir marta ishlaydi: ikki parallel so'rovdan faqat bittasi "tasdiqlandi" qiladi.
  const ishlatildi = await prisma.telefonKod.updateMany({ where: { id: row.id, holat: 'kutilmoqda' }, data: { holat: 'tasdiqlandi' } });
  if (ishlatildi.count !== 1) return { tugadi: true, xato: "Bu kod endi yaroqsiz. Profil → «Raqamni o'zgartirish» orqali yangi kod so'rang." };
  return { telefon: `+${row.telefon}` };
}
