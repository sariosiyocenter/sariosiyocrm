import { yechimOzTasdiqlansinmi, yechimTekshirishKerakmi } from '../../../../lib/yechimVideo.js';
import type { DarsHolati, DarsTaklifi } from '../dars/darsTurlari';
import type { Question } from '../../../types';

// Yechim + video yechimni bitta amalda yaratish (egasi, 2026-10-15): ikkala oyna (YechimOynasi va
// DarsOynasi) shu yerdagi bosqichlarni ishlatadi — mantiq bir joyda. So'rovlar ketma-ket va har biri
// serverda o'z vaqtiga sig'adi: yechim/ai → yechim (PUT) → dars/ai → dars (PUT) → dars/ovoz.
// Yangi saqlangan yechim bazada turadi, shuning uchun video yechim aynan undan tuziladi va «eskirgan» bo'lmaydi.

export type Bosqich = 'yechim' | 'video' | 'ovoz';
export type Soro = <T = any>(method: string, yol: string, body?: any) => Promise<T>;
export type YechimHolati = NonNullable<Question['solutionStatus']>;

/** POST questions/:id/yechim/ai javobi (bazaga yozilmagan taklif). */
export interface AiYechim {
  yechim: string; aiJavobi: string;
  /** AI javobi bankdagi javob bilan mosmi; null — solishtirib bo'lmadi (yozma savol, erkin matnli javob). */
  mos: boolean | null;
  kalit: string; izoh: string; rasmKerak: boolean;
  rasm: { jami: number; berildi: number };
}
/** Yechim saqlandi yoki holati o'zgardi — ro'yxatdagi belgi shu bilan yangilanadi. */
export interface YechimNatijasi { yechimBor: boolean; solutionStatus: YechimHolati }

/** PUT questions/:id/yechim javobi. */
interface YechimJavobi { solution: string | null; solutionStatus: YechimHolati; yechimBor: boolean }

export type YechimYozildi =
  /** AI yozdi va saqlandi (tasdiqlangan yoki qoralama). */
  | { saqlandi: true; ai: AiYechim; javob: YechimJavobi }
  /** AI yozdi, lekin ustoz ko'rishi kerak (javob mos emas / rasm ko'rinmadi) — saqlanmadi. */
  | { saqlandi: false; ai: AiYechim };

/**
 * Yechimni AI ga yozdirib saqlaydi — ustoz ko'zisiz faqat ishonchli bo'lsa (AI javobi bankdagi
 * javobga mos yoki solishtirib bo'lmaydigan savol); aks holda saqlamaydi va taklifni qaytaradi.
 * Oyna yopilgan bo'lsa (`tirik()` yolg'on) — null.
 */
export async function yechimniYozVaSaqla(soro: Soro, id: number, o: { korsatma: string; tirik: () => boolean }): Promise<YechimYozildi | null> {
  const ai = await soro<AiYechim>('POST', `questions/${id}/yechim/ai`, { korsatma: o.korsatma });
  if (!o.tirik()) return null;
  if (yechimTekshirishKerakmi(ai)) return { saqlandi: false, ai };
  const javob = await soro<YechimJavobi>('PUT', `questions/${id}/yechim`, {
    solution: ai.yechim, solutionStatus: yechimOzTasdiqlansinmi(ai) ? 'tasdiqlangan' : 'qoralama', korsatma: o.korsatma || undefined,
  });
  return { saqlandi: true, ai, javob };
}

export interface VideoNatijasi {
  holat: DarsHolati;
  /** AI ning shu safar yaratgan video yechimiga ogohlantirishlari (harf, formula belgisi…). */
  ogohlar: string[];
  /** Video yechim saqlandi, lekin ovoz yozilmadi — sababi; null — ovoz yozildi (yoki so'ralmadi). */
  ovozXato: string | null;
}

/** 504 — server javob berishga ulgurmadi: xabar serverdan kelmaydi. */
export const xatoSababi = (e: any, qaytaUrinish = 'qayta urinib ko\'ring') => (e?.status === 504 ? `server javob berishga ulgurmadi — ${qaytaUrinish}` : e?.message || 'Xatolik');

/**
 * Saqlangan yechimdan video yechim yaratadi: ssenariy va chizma → saqlash (qoralama) → ovoz.
 * Ovoz yozilmasa ham video yechim saqlangan qoladi (`ovozXato`). Oyna yopilgan bo'lsa — null.
 */
export async function videoYarat(soro: Soro, id: number, o: {
  korsatma: string; ovozYoz: boolean; onBosqich: (b: Bosqich) => void; tirik: () => boolean;
}): Promise<VideoNatijasi | null> {
  o.onBosqich('video');
  const taklif = await soro<DarsTaklifi>('POST', `questions/${id}/dars/ai`, { korsatma: o.korsatma });
  if (!o.tirik()) return null;
  let holat = await soro<DarsHolati>('PUT', `questions/${id}/dars`, { qadamlar: taklif.qadamlar, korsatma: o.korsatma || undefined });
  if (!o.tirik()) return null;
  let ovozXato: string | null = null;
  if (o.ovozYoz) {
    o.onBosqich('ovoz');
    try {
      holat = await soro<DarsHolati>('POST', `questions/${id}/dars/ovoz`);
    } catch (e: any) {
      ovozXato = xatoSababi(e, "«Ovoz yozdirish» ni qayta bosing");
    }
  }
  return { holat, ogohlar: taklif.ogohlar, ovozXato };
}
