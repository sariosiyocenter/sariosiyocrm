import type { IshchiNatija } from './skaner';

// Skanerlangan varaqlarni Addmen "SORT CODES" bo'yicha saralash (SkanerTab).

/**
 * Addmen "SORT CODES": muammoli varaqlar sababi bo'yicha. Bizda imtihon QR dan
 * aniqlanadi, shuning uchun test ID kodlari (BLT, IVT) — QR va varaq kodi uchun.
 */
export const SARALASH: Record<string, string> = {
  UNR: "O'qilmaydigan fayl yoki juda xira rasm",
  IDX: "Burchakdagi qora kvadratlar (markerlar) topilmadi",
  SKW: 'Varaq juda qiyshiq yoki to\'liq tushmagan',
  BLT: "QR o'qilmadi — varaq kodini kiriting",
  IVT: 'Boshqa imtihonning varag\'i yoki noma\'lum varaq kodi',
  BID: "O'quvchi ID raqami bo'yalmagan",
  DID: "ID ning bir ustunida bir nechta doira bo'yalgan",
  LID: "ID chala bo'yalgan (xonalar soni kam)",
  IID: "Bunday ID li o'quvchi ro'yxatda yo'q",
  DUP: 'Bu varaq oldin ham skanerlangan (qayta yozildi)',
  MUL: "Bir savolda bir nechta doira bo'yalgan",
  THR: "Noaniq belgi (to'liq bo'yalmagan) — tekshiring",
  XAT: 'Saqlashda xato',
};

/** Varaqning Addmen saralash kodi (muammosiz — null). */
export function saralashKodi(el: { holat: string; xato?: string; oqish?: IshchiNatija['natija']; natija?: { takror?: boolean }; topilmadi?: boolean }): string | null {
  const o = el.oqish;
  const x = `${el.xato || ''} ${o?.xato || ''}`;
  if (el.holat === 'xato') {
    if (!o) return 'UNR';
    if (/xira|o'qib bo'lmadi|decode|fayl/i.test(x)) return 'UNR';
    if (/kvadrat|marker|tepasi/i.test(x)) return 'IDX';
    if (/qiyshiq|to'liq tushmagan/i.test(x)) return 'SKW';
    if (/sahifa.*yo'q/i.test(x)) return 'IVT';
    return o.ok ? 'XAT' : 'UNR';
  }
  if (el.holat === 'aniqlanmadi') {
    if (o?.qr?.turi === 'S' && el.topilmadi) return 'IVT';
    if (o?.qr?.turi === 'U' || (!o?.qr && o?.idHolat !== undefined)) {
      if (o?.idHolat === 'kop') return 'DID';
      if (o?.idHolat === 'bosh') return 'BID';
      if (o?.idHolat === 'chala') return 'LID';
      return 'IID';
    }
    return 'BLT';
  }
  if (el.holat === 'tayyor') {
    if (el.natija?.takror) return 'DUP';
    if (o?.shubhalar.some(s => /bir nechta/i.test(s.sabab))) return 'MUL';
    if (o?.shubhalar.some(s => /noaniq/i.test(s.sabab))) return 'THR';
  }
  return null;
}
