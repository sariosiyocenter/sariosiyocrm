/**
 * Guruh jadvalidan dars tugash vaqtini ajratish.
 *
 * `Group.schedule` erkin matn: "14:00 - 16:00", "13:30 - 16:30",
 * "Belgilanmagan - ", "Belgilanmagan". Transport rejasi aynan tugash
 * vaqtiga bog'liq — dars qachon tugasa, mashina o'shanda kerak.
 *
 * To'ldirilmagan jadval taxmin qilinmaydi: null qaytadi va chaqiruvchi
 * bunday guruhni alohida ro'yxatda ko'rsatadi, admin to'ldiradi.
 */

/** "16:30" → 990 (yarim kechadan beri daqiqa). Noto'g'ri bo'lsa null. */
export function daqiqaga(vaqt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(vaqt || '').trim());
  if (!m) return null;
  const soat = Number(m[1]);
  const daq = Number(m[2]);
  if (soat > 23 || daq > 59) return null;
  return soat * 60 + daq;
}

/** 990 → "16:30". */
export function vaqtga(daqiqa) {
  const d = Math.max(0, Math.min(23 * 60 + 59, Math.round(daqiqa)));
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
}

/**
 * Jadvaldan boshlanish va tugash vaqti.
 * @returns {{ boshi: string|null, oxiri: string|null }}
 */
export function jadvalVaqti(schedule) {
  const matn = String(schedule || '');
  // Matndagi hamma "soat:daqiqa" larni olamiz — ajratuvchi belgi har xil
  // bo'lishi mumkin ("-", "–", "dan", ...).
  const topilgan = matn.match(/\d{1,2}:\d{2}/g) || [];
  const daqiqalar = topilgan.map(daqiqaga).filter(x => x !== null);
  if (daqiqalar.length === 0) return { boshi: null, oxiri: null };
  if (daqiqalar.length === 1) return { boshi: vaqtga(daqiqalar[0]), oxiri: null };
  return { boshi: vaqtga(daqiqalar[0]), oxiri: vaqtga(daqiqalar[daqiqalar.length - 1]) };
}

/** Dars tugash vaqti; jadval to'ldirilmagan bo'lsa null. */
export function darsTugashi(schedule) {
  return jadvalVaqti(schedule).oxiri;
}

/**
 * Yaqin vaqtlarni bitta to'lqinga qo'shadi.
 *
 * 20:55 da tugaydigan guruh va 21:00 da tugaydigani uchun alohida mashina
 * chiqarish ma'nosiz — 5 daqiqa kutiladi va bitta reys bo'ladi. Sukut
 * bo'yicha 15 daqiqa oralig'idagilar birlashadi va to'lqin vaqti eng
 * kechkisi bo'yicha olinadi (hech kim kutib qolmasin).
 */
export function tolqinlarniBirlashtirish(vaqtlar, oraliqDaqiqa = 15) {
  const daq = [...new Set(vaqtlar.map(daqiqaga).filter(x => x !== null))].sort((a, b) => a - b);
  const guruhlar = [];
  for (const d of daq) {
    const oxirgi = guruhlar[guruhlar.length - 1];
    if (oxirgi && d - oxirgi[0] <= oraliqDaqiqa) oxirgi.push(d);
    else guruhlar.push([d]);
  }
  return guruhlar.map(g => ({
    vaqt: vaqtga(Math.max(...g)),
    ichidagilar: g.map(vaqtga),
  }));
}
