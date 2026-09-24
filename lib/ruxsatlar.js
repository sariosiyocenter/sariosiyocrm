// Lavozim ruxsatlari — kim qaysi bo'limni ko'radi va qaysi birini o'zgartiradi.
//
// Egasi (2026-09-24): "ruxsatlarni yaxshilash, tam nimani ko'rsa bo'ladi,
// o'zgartirsa bo'ladi, har bir modul ichidagi bo'limlari bilan. haydovchi
// faqat telegramdan kiradi". Maketdan jadval ko'rinishini tanladi.
//
// Bu fayl server va brauzer uchun umumiy: katalog, standart qiymatlar va
// saqlangan sozlamani bir xil tozalash shu yerda. Qaysi API yo'li qaysi
// bo'limga tegishli ekani — lib/ruxsatApi.js (faqat server).
//
// Daraja: 0 — yo'q (menyuda ham chiqmaydi, server ma'lumotini bermaydi),
//         1 — ko'radi, 2 — o'zgartiradi.
// Bo'lim turi: 'toliq' (0/1/2), 'korish' (0/1), 'amal' (0/2 — "Ruxsat"),
//              'admin' (sozlanmaydi, faqat ADMIN).

export const YOQ = 0;
export const KORADI = 1;
export const OZGARTIRADI = 2;

/** Jadvalda ustun bo'lib turadigan, admin sozlaydigan lavozimlar. */
export const SOZLANADIGAN_ROLLAR = ['MANAGER', 'RECEPTIONIST', 'TEACHER', 'SUPPORT_TEACHER'];

export const ROL_NOMLARI = {
  ADMIN: 'Admin',
  MANAGER: 'Menejer',
  RECEPTIONIST: 'Resepshn',
  TEACHER: "O'qituvchi",
  SUPPORT_TEACHER: "Yordamchi o'qituvchi",
  DRIVER: 'Haydovchi',
  TECH_STAFF: 'Texnik xodim',
};

/** "Faqat o'z kurslari" kaliti ma'noga ega lavozimlar (ular Teacher yozuviga bog'langan). */
export const USTOZ_ROLLARI = ['TEACHER', 'SUPPORT_TEACHER'];

// d: standart daraja [Menejer, Resepshn, O'qituvchi, Yordamchi o'qituvchi].
// Standartlar ruxsat tizimidan oldingi holatga yaqin: menejer hozirgidek
// deyarli hamma narsani qiladi, o'qituvchi esa endi pul va o'chirishni ko'rmaydi.
export const MODULLAR = [
  { id: 'bosh', nom: 'Bosh sahifa', yol: '/', bolimlar: [
    { id: 'bosh.korsatkich', nom: "Ko'rsatkichlar va bugungi darslar", izoh: "O'quvchilar soni, bugungi darslar, xonalar jadvali", tur: 'korish', d: [1, 1, 1, 1] },
    { id: 'bosh.pul', nom: "Pul ko'rsatkichlari", izoh: "Tushum, umumiy qarzdorlik, so'nggi to'lovlar, pulli hisobotlar", tur: 'korish', d: [1, 0, 0, 0] },
    { id: 'bosh.hisobot', nom: 'Hisobotlar', izoh: "Lidlar, o'quvchilar, ketganlar, bitiruvchilar", tur: 'korish', d: [1, 1, 0, 0] },
  ]},
  { id: 'lidlar', nom: 'Lidlar', yol: '/leads', bolimlar: [
    { id: 'lidlar.royxat', nom: 'Lidlar', izoh: "Lid qo'shish, bosqichini o'zgartirish", tur: 'toliq', d: [2, 2, 0, 0] },
    { id: 'lidlar.ochirish', nom: "Lidni o'chirish", izoh: '', tur: 'amal', d: [2, 0, 0, 0] },
  ]},
  { id: 'kurslar', nom: 'Kurslar', yol: '/courses', bolimlar: [
    { id: 'kurslar.malumot', nom: "Kurslar va ularning ma'lumoti", izoh: 'Kurs ochish, ustoz, dars kunlari va vaqti, xona', tur: 'toliq', d: [2, 1, 1, 1] },
    { id: 'kurslar.narx', nom: 'Narx va ustoz ulushi', izoh: "Ko'radi: ustoz ulushini ko'radi. O'zgartiradi: kurs narxi va ulushni o'zgartiradi", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'kurslar.tarkib', nom: "Kursga o'quvchi qo'shish va chiqarish", izoh: '', tur: 'amal', d: [2, 2, 0, 0] },
    { id: 'kurslar.davomat', nom: "Yo'qlama va dars mavzusi", izoh: 'Keldi / Kelmadi, Face ID, ota-onaga Telegram xabari', tur: 'toliq', d: [2, 1, 2, 2] },
    { id: 'kurslar.ochirish', nom: "Kursni o'chirish", izoh: '', tur: 'amal', d: [2, 0, 0, 0] },
  ]},
  { id: 'oquvchilar', nom: "O'quvchilar", yol: '/students', bolimlar: [
    { id: 'oquvchilar.royxat', nom: "Ro'yxat va profil", izoh: "Qo'shish, tahrirlash, rasm, izoh, Excel import, ariza havolasi", tur: 'toliq', d: [2, 2, 1, 1] },
    { id: 'oquvchilar.balans', nom: "Balans va to'lovlar tarixi", izoh: "Qarzdorlik, Balans tabi, qaysi sanagacha to'lagani", tur: 'korish', d: [1, 1, 0, 0] },
    { id: 'oquvchilar.tolov', nom: "To'lov qabul qilish", izoh: 'Naqd, karta, Payme havolasi, chek', tur: 'amal', d: [2, 2, 0, 0] },
    { id: 'oquvchilar.tolovTuzatish', nom: "To'lovni tuzatish", izoh: 'Kiritilgandan keyin 10 daqiqa ichida. Admin har doim tuzata oladi', tur: 'amal', d: [2, 2, 0, 0] },
    { id: 'oquvchilar.kursHisobi', nom: 'Kurs hisobi', izoh: 'Kursdagi boshlanish sanasi, birinchi oy summasi, balans taqsimoti', tur: 'amal', d: [2, 2, 0, 0] },
    { id: 'oquvchilar.narx', nom: 'Alohida narx va chegirma', izoh: "O'quvchiga kurs narxidan boshqa narx qo'yish", tur: 'amal', d: [2, 0, 0, 0] },
    { id: 'oquvchilar.kochirish', nom: "Boshqa kursga ko'chirish", izoh: '', tur: 'amal', d: [2, 0, 0, 0] },
    { id: 'oquvchilar.ballar', nom: 'Ballar', izoh: "Dars bahosi, ball qo'shish", tur: 'toliq', d: [2, 1, 2, 2] },
    { id: 'oquvchilar.ochirish', nom: "O'quvchini o'chirish", izoh: "Tarixi bor o'quvchi o'chmaydi, arxivga olinadi", tur: 'amal', d: [2, 0, 0, 0] },
  ]},
  { id: 'kunlik', nom: 'Kunlik', yol: '/daily', bolimlar: [
    { id: 'kunlik.korish', nom: "Kunlik ro'yxat va chop etish", izoh: "QARZ ustuni faqat balansni ko'radiganlarga chiqadi", tur: 'korish', d: [1, 1, 1, 1] },
  ]},
  { id: 'dastur', nom: "O'quv reja", yol: '/syllabus', bolimlar: [
    { id: 'dastur.royxat', nom: 'Dasturlar va mavzular', izoh: "Dastur tuzish, mavzu qo'shish, tartibini o'zgartirish", tur: 'toliq', d: [2, 1, 2, 1] },
    { id: 'dastur.ochirish', nom: "Dastur yoki mavzuni o'chirish", izoh: '', tur: 'amal', d: [2, 0, 0, 0] },
  ]},
  { id: 'moliya', nom: 'Moliya', yol: '/finance', bolimlar: [
    { id: 'moliya.hisobot', nom: 'Hisobotlar', izoh: 'Oylik tushum, kurslar kesimida', tur: 'korish', d: [1, 0, 0, 0] },
    { id: 'moliya.oylik', nom: 'Oylik nazorat', izoh: "Kim to'lamagan; qarzdorlarga xabar yuborish", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'moliya.tolovlar', nom: "To'lovlar ro'yxati", izoh: "Barcha to'lovlar, filtr, eksport", tur: 'korish', d: [1, 0, 0, 0] },
    { id: 'moliya.xarajat', nom: 'Xarajatlar', izoh: "Xarajat qo'shish va o'chirish", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'moliya.kassa', nom: 'Kassa', izoh: 'Inkassatsiya, kunni yopish', tur: 'toliq', d: [2, 0, 0, 0] },
  ]},
  { id: 'logistika', nom: 'Logistika', yol: '/logistics', bolimlar: [
    { id: 'logistika.reja', nom: 'Kunlik reja', izoh: 'Haydovchilarga taqsimlash, yuborish, Qabul qildim / Yetkazdim', tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'logistika.tarix', nom: "Tarix va yo'l haqi", izoh: 'Kim kimni tashigani, haydovchi topgan summa', tur: 'korish', d: [1, 0, 0, 0] },
  ]},
  { id: 'imtihonlar', nom: 'Imtihonlar', yol: '/exams', bolimlar: [
    { id: 'imtihonlar.imtihon', nom: 'Imtihonlar', izoh: "Tuzish, qatnashchilar, variantlar, o'rinlar, chop etish", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'imtihonlar.savollar', nom: 'Savollar banki', izoh: "Savol va matn qo'shish, Excel import", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'imtihonlar.natija', nom: 'Skaner, tekshirish va natijalar', izoh: "Varaqlarni skanerlash, shubhali javoblarni tasdiqlash, tahlil", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'imtihonlar.kalit', nom: 'Kalitlar', izoh: "Ko'radi: variantlarning to'g'ri javoblari. O'zgartiradi: kalitni tuzatish, savolni bekor qilish", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'imtihonlar.elon', nom: "Natijani e'lon qilish", izoh: "Reyting va ota-onalarga natija xabari (SMS pullik)", tur: 'amal', d: [2, 0, 0, 0] },
    { id: 'imtihonlar.ochirish', nom: "Imtihon, savol yoki natijani o'chirish", izoh: '', tur: 'amal', d: [2, 0, 0, 0] },
  ]},
  { id: 'xabarlar', nom: 'Xabarlar', yol: '/messaging', bolimlar: [
    { id: 'xabarlar.yuborish', nom: 'SMS va Telegram yuborish', izoh: "Ommaviy xabar, o'quvchiga SMS, davomat SMS'i. SMS pullik", tur: 'amal', d: [2, 0, 0, 0] },
    { id: 'xabarlar.shablon', nom: 'Shablonlar', izoh: '', tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'xabarlar.avto', nom: 'Avtomatik qoidalar', izoh: "Qarz eslatmasi, tug'ilgan kun va boshqalar", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'xabarlar.tarix', nom: 'Tarix', izoh: "O'zgartiradi: xato ketganlarni qayta yuborish", tur: 'toliq', d: [2, 0, 0, 0] },
  ]},
  { id: 'xodimlar', nom: 'Xodimlar', yol: '/hr', bolimlar: [
    { id: 'xodimlar.royxat', nom: "Ro'yxat va profil", izoh: "Xodim qo'shish va tahrirlash. Admin va menejerni faqat admin qo'shadi", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'xodimlar.maosh', nom: 'Maosh va KPI', izoh: "Oylik, bonus, jarima, maosh to'lash", tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'xodimlar.davomat', nom: 'Xodimlar davomati', izoh: 'Ish grafigi, keldi / kelmadi', tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'xodimlar.ochirish', nom: "Xodimni arxivlash yoki o'chirish", izoh: '', tur: 'amal', d: [0, 0, 0, 0] },
  ]},
  { id: 'jurnal', nom: 'Jurnal', yol: '/journal', bolimlar: [
    { id: 'jurnal.korish', nom: 'Amallar jurnali', izoh: "Kim qachon nimani qo'shdi, o'zgartirdi, o'chirdi", tur: 'korish', d: [0, 0, 0, 0] },
  ]},
  { id: 'sozlamalar', nom: 'Sozlamalar', yol: '/settings', bolimlar: [
    { id: 'sozlamalar.profil', nom: 'Markaz profili', izoh: 'Nomi, logotip, manzil, telefon, ish vaqti', tur: 'toliq', d: [1, 0, 0, 0] },
    { id: 'sozlamalar.xonalar', nom: "Xonalar va yo'nalishlar", izoh: '', tur: 'toliq', d: [2, 0, 0, 0] },
    { id: 'sozlamalar.integratsiya', nom: 'Integratsiyalar', izoh: 'Telegram bot, SMS (Eskiz), Instagram', tur: 'toliq', d: [0, 0, 0, 0] },
    { id: 'sozlamalar.avto', nom: 'Avtomatlashtirish', izoh: "Hisob kuni, ko'p kursli to'lov, transport xabarlari", tur: 'toliq', d: [1, 0, 0, 0] },
    { id: 'sozlamalar.filiallar', nom: 'Filiallar', izoh: '', tur: 'admin' },
    { id: 'sozlamalar.payme', nom: 'Payme', izoh: '', tur: 'admin' },
    { id: 'sozlamalar.ruxsatlar', nom: 'Ruxsatlar', izoh: '', tur: 'admin' },
  ]},
];

const BOLIMLAR = new Map();
for (const m of MODULLAR) for (const b of m.bolimlar) BOLIMLAR.set(b.id, { ...b, modul: m });

/** Bo'lim ta'rifi (nomi, turi, moduli) yoki undefined. */
export function bolim(id) {
  return BOLIMLAR.get(id);
}

/** "Moliya → Xarajatlar" — xato xabarlari va jadval uchun. */
export function bolimNomi(id) {
  const b = BOLIMLAR.get(id);
  return b ? `${b.modul.nom} → ${b.nom}` : id;
}

/** Bo'lim turi ruxsat bergan darajaga keltiradi. */
function chegarala(tur, daraja) {
  const d = Number(daraja);
  if (!Number.isFinite(d) || d <= 0) return YOQ;
  if (tur === 'korish') return KORADI;
  if (tur === 'amal') return d >= OZGARTIRADI ? OZGARTIRADI : YOQ;
  return d >= OZGARTIRADI ? OZGARTIRADI : KORADI;
}

/** Hech narsa saqlanmagan tashkilot uchun boshlang'ich sozlama. */
export function standartSozlama() {
  const rollar = {};
  SOZLANADIGAN_ROLLAR.forEach((rol, i) => {
    rollar[rol] = {};
    for (const [id, b] of BOLIMLAR) if (b.tur !== 'admin') rollar[rol][id] = b.d[i];
  });
  return { rollar, faqatOzKurslari: { TEACHER: true, SUPPORT_TEACHER: true } };
}

/**
 * Saqlangan (yoki brauzerdan kelgan) sozlamani to'liq va to'g'ri shaklga
 * keltiradi: noma'lum kalitlar tashlanadi, yetishmagani standartdan olinadi,
 * daraja bo'lim turiga moslanadi. Katalogga keyinroq qo'shilgan bo'lim ham
 * shu yo'l bilan standart qiymatini oladi.
 */
export function sozlamaniTozala(kirish) {
  const standart = standartSozlama();
  const natija = { rollar: {}, faqatOzKurslari: {} };
  for (const rol of SOZLANADIGAN_ROLLAR) {
    const manba = kirish?.rollar?.[rol] || {};
    natija.rollar[rol] = {};
    for (const [id, b] of BOLIMLAR) {
      if (b.tur === 'admin') continue;
      const qiymat = Object.prototype.hasOwnProperty.call(manba, id) ? manba[id] : standart.rollar[rol][id];
      natija.rollar[rol][id] = chegarala(b.tur, qiymat);
    }
  }
  for (const rol of USTOZ_ROLLARI) {
    const q = kirish?.faqatOzKurslari?.[rol];
    natija.faqatOzKurslari[rol] = typeof q === 'boolean' ? q : standart.faqatOzKurslari[rol];
  }
  return natija;
}

/** Hamma narsaga ega lavozim (ADMIN va platforma egasi). */
export function toliqRuxsatli(rol) {
  return rol === 'ADMIN' || rol === 'SUPERADMIN';
}

/**
 * Bitta xodimning amaldagi ruxsati: { daraja: {bo'lim: 0|1|2}, faqatOz, toliq }.
 * ADMIN — hammasi; sozlanmaydigan lavozim (SELLER va h.k.) — hech narsa.
 */
export function rolRuxsati(sozlama, rol) {
  const daraja = {};
  if (toliqRuxsatli(rol)) {
    for (const [id] of BOLIMLAR) daraja[id] = OZGARTIRADI;
    return { daraja, faqatOz: false, toliq: true };
  }
  const toza = sozlamaniTozala(sozlama);
  const rolniki = toza.rollar[rol];
  for (const [id, b] of BOLIMLAR) daraja[id] = rolniki && b.tur !== 'admin' ? rolniki[id] : YOQ;
  return { daraja, faqatOz: !!toza.faqatOzKurslari[rol], toliq: false };
}

/** Shu bo'limda darajasi `kerak`dan past emasmi. */
export function yetadimi(ruxsat, id, kerak = KORADI) {
  if (!ruxsat) return false;
  if (ruxsat.toliq) return true;
  return (ruxsat.daraja?.[id] ?? YOQ) >= kerak;
}

/**
 * Modul menyuda chiqadimi: ichidagi biror bo'limni ko'rsa — ha.
 * Sozlamalar doim chiqadi: har bir xodim o'z parolini o'sha yerda almashtiradi.
 */
export function modulKorinadimi(ruxsat, modulId) {
  if (modulId === 'sozlamalar') return true;
  const m = MODULLAR.find(x => x.id === modulId);
  if (!m) return false;
  return m.bolimlar.some(b => b.tur !== 'admin' && yetadimi(ruxsat, b.id, KORADI));
}
