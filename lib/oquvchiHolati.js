// O'quvchi holatlari: qaysilari kursda o'qiydi.
//
// Egasi (2026-09-29): "passiv qilingan o'quvchi kurs ro'yxatida qolib
// ketayapdi". Faol va Sinov — darsga keladi, kursda turadi. Qolganlari
// (Passiv, Muzlatilgan, Arxiv, Bitiruvchi, Sertifikatli) darsga kelmaydi:
// shu holatga o'tganda o'quvchi barcha kurslaridan chiqariladi (pulga
// tegilmaydi — qarzi joyida qoladi). Server va mijoz shu ro'yxatni ishlatadi.

export const OQIYDIGAN_HOLATLAR = ['Faol', 'Sinov'];

/** Shu holatdagi o'quvchi kursda turadimi. */
export function kursdaOqiydi(status) {
  return OQIYDIGAN_HOLATLAR.includes(status || 'Faol');
}
