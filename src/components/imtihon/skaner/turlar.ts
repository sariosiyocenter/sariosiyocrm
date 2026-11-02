import type { IshchiNatija } from '../../../lib/omr/skaner';

// Skaner navbatining elementi (SkanerTab, varaq ko'rigi, jurnal).

export type Holat = 'kutmoqda' | 'oqilmoqda' | 'saqlanmoqda' | 'tayyor' | 'aniqlanmadi' | 'xato';

/** Kimga yozish: varaq kodi yoki o'quvchi; `takror: 'almashtir'` — oldingi varaqning o'rniga. */
export interface Yuborish { sheetCode?: string; studentId?: number; session?: number; takror?: 'almashtir' }

export interface Element {
  id: number;
  nom: string;
  holat: Holat;
  /** Navbatga tushgan vaqt (ms) — jurnal uchun. */
  vaqt: number;
  oqish?: IshchiNatija['natija'];
  rasm?: string | null;
  xato?: string;
  natija?: { id?: number; name: string; score: number; shubhalar: number; sheetCode?: string; takror?: boolean };
  /** Server 404 qaytargan (varaq kodi yoki o'quvchi topilmadi). */
  topilmadi?: boolean;
  /** Server 409: shu o'rinning shu sahifasi oldin boshqa javoblar bilan o'qilgan (Addmen duplicate ID). */
  takrorId?: { name: string; oldingiRasm: string | null; farq: number; jami: number; kimga: Yuborish };
}

/**
 * O'qish rejimi (Addmen Read Sheet): avto — hammasi o'qiladi, muammolilar navbatda qoladi;
 * ogoh — muammoli varaqda to'xtab, operatorga ko'rsatadi; tasdiq — har varaqni operator tasdiqlaydi.
 */
export type OqishRejimi = 'avto' | 'ogoh' | 'tasdiq';
