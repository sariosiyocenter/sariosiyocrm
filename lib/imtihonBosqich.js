// Imtihonlar modulining bosqichlari va "men qayerdaman" yo'l ko'rsatkichi (egasi, 2026-10-13):
// foydalanuvchi faqat keyingi tabga o'tmasligi, balki har bosqichda nima uchun ekanini, shu
// imtihon bo'yicha bajarildimi va bo'lmasa nega yopiqligini (avval nima qilish kerak) ko'rishi
// kerak. Bu yerda bazaga murojaat yo'q: kirish — GET exams/:id javobi (lockedAt, publishedAt,
// holat). Ekran: src/components/imtihon/BosqichYolboshchi.tsx. Tab tartibi — ExamsList.tsx bilan bir xil.

/** Bosqichlar (tab tartibida): nomi va nima uchun kerakligi. */
export const BOSQICHLAR = [
  { id: 'savollar', nom: 'Savollar banki', maqsad: "Savollar bir marta yig'iladi va hamma imtihon uchun umumiy. Imtihonga ular «Andoza» orqali tushadi: andoza yarating, bankdan savol qo'shing, «Savol qog'ozi» ni bosing." },
  { id: 'imtihonlar', nom: 'Imtihon', maqsad: "Imtihonning nomi, sanasi, savollari va sozlamasi. «Qulflash» dan keyin savollar o'zgarmaydi va variantlar tayyor bo'ladi." },
  { id: 'orin', nom: "O'rinlashtirish", maqsad: "Qaysi o'quvchi qaysi xonada, qaysi o'rinda va qaysi variantda o'tirishi: yonma-yon o'tirganlarga har xil variant tushadi." },
  { id: 'chop', nom: 'Chop etish', maqsad: "Kitobchalar, javoblar kaliti va har o'quvchining shaxsiy javob varag'i (ismi, o'rni va QR kodi bilan) qog'ozga chiqariladi." },
  { id: 'skaner', nom: 'Skaner', maqsad: "To'ldirilgan varaqlar skanerlanadi: QR dan o'quvchi, doirachalardan javoblar o'qiladi. Shubhali belgilarni ustoz tekshiradi." },
  { id: 'natija', nom: 'Natijalar', maqsad: "Ballar, reyting va savol tahlili. E'lon qilingach natija ota-onaga yuboriladi, o'quvchi xatolarini ko'radi." },
];

/** Bosqichning tab tartibidagi o'rni (0 dan); noma'lum — -1. */
export const bosqichIndeksi = (id) => BOSQICHLAR.findIndex(b => b.id === id);

const BOSH = { holat: 'bosh' };

/**
 * Tanlangan imtihon bo'yicha shu bosqichning holati: {holat, matn, avval?}.
 * holat: 'tayyor' (bajarilgan) · 'jarayon' (ochiq, ish bor) · 'bloklangan' (avval `avval`
 * bosqichni bajarish kerak) · 'bosh' (imtihonga bog'liq emas yoki imtihon tanlanmagan).
 * @param {string} id
 * @param {any} e
 * @returns {{ holat: 'tayyor' | 'jarayon' | 'bloklangan' | 'bosh', matn: string, avval?: string }}
 */
export function bosqichHolati(id, e) {
  if (id === 'savollar') return { ...BOSH, matn: "Bank imtihonga bog'liq emas: savol qo'shing, yechim yozing, filtrlang. Imtihon tuzish uchun savollarni «Andoza» ga yig'ing." };
  if (!BOSQICHLAR.some(b => b.id === id)) return { ...BOSH, matn: '' };
  if (!e) return { ...BOSH, matn: id === 'imtihonlar' ? "Imtihonni tanlang yoki yangisini yarating." : "Avval imtihonni tanlang — bu bosqich shu imtihon bilan ishlaydi." };

  const h = e.holat || {};
  const orinlar = Number(h.orinlar) || 0;
  const natijalar = Number(h.natijalar) || 0;
  const skanerlanmagan = Number(h.skanerlanmagan) || 0;
  const shubhali = Number(h.shubhali) || 0;
  const qulflangan = !!e.lockedAt;
  const yopiq = (avval, matn) => ({ holat: 'bloklangan', avval, matn });

  if (id === 'imtihonlar') {
    return qulflangan
      ? { holat: 'tayyor', matn: "Qulflangan: savollar o'zgarmaydi, variantlar tayyor." }
      : { holat: 'jarayon', matn: "Hali qulflanmagan. Savollar va sozlamani tekshirib «Qulflash» ni bosing — shundan keyin keyingi bosqichlar ochiladi." };
  }
  if (!qulflangan && id !== 'natija') return yopiq('imtihonlar', "Avval imtihonni qulflang: shundan keyin variantlar tayyor bo'ladi.");

  if (id === 'orin') {
    return orinlar > 0
      ? { holat: 'tayyor', matn: `${orinlar} ta o'rin berilgan.` }
      : { holat: 'jarayon', matn: "Hali hech kim o'rinlashtirilmagan: kurslar va xonalarni tanlang." };
  }
  if (id === 'chop') {
    if (!orinlar) return yopiq('orin', "Varaqlar o'quvchining ismi va o'rni bilan chiqadi — avval o'rinlashtiring.");
    return { holat: 'jarayon', matn: "Kitobchalar va javob varaqlarini chiqaring — imtihon kuni o'quvchilarga tarqatiladi." };
  }
  if (id === 'skaner') {
    if (!orinlar && !natijalar) return yopiq('orin', "Skaner o'quvchini varaqdagi QR koddan topadi — avval o'rinlashtirib, varaqlarni chop eting.");
    if (shubhali > 0) return { holat: 'jarayon', matn: `${shubhali} ta shubhali belgi tekshirilishi kerak («Tekshirish» bo'limi).` };
    if (natijalar > 0 && skanerlanmagan === 0) return { holat: 'tayyor', matn: `${natijalar} ta varaq skanerlangan, shubhali belgi yo'q.` };
    return { holat: 'jarayon', matn: natijalar > 0 ? `${natijalar} ta varaq skanerlangan, ${skanerlanmagan} tasi qoldi.` : "Hali varaq skanerlanmagan: PDF yoki rasm yuklang." };
  }
  // natija
  if (e.publishedAt) return { holat: 'tayyor', matn: "E'lon qilingan: natija ota-onaga yuborilgan, o'quvchilar ko'ra oladi." };
  if (natijalar > 0) return { holat: 'jarayon', matn: `${natijalar} ta natija bor, hali e'lon qilinmagan: shubhali belgilarni tekshirib e'lon qiling.` };
  return yopiq('skaner', "Hali natija yo'q — avval varaqlarni skanerlang.");
}
