import { Payment } from '../types';

/**
 * Kassa tushumi — haqiqatan pul kirgan to'lovlar.
 *
 * Ikki xil "musbat bo'lmagan" yozuv bor:
 *  - manfiy `Oylik` yozuvlari — oylik hisob (services/billing.js), pul chiqimi emas,
 *    balansdan yechish;
 *  - `Chegirma` — o'quvchi dars qoldirgani uchun qayta hisob. Balansni oshiradi,
 *    lekin kassaga pul kirmaydi, shuning uchun tushum hisobiga qo'shilmaydi.
 *
 * Ilgari hamma joyda shunchaki `amount > 0` tekshirilardi va chegirma "tushum"
 * bo'lib hisobotlarga tushib ketardi.
 */
export function isCashIncome(p: Pick<Payment, 'amount' | 'type'>): boolean {
    return p.amount > 0 && p.type !== 'Chegirma';
}

/** Chegirma (qayta hisob) yozuvimi. */
export function isDiscount(p: Pick<Payment, 'type'>): boolean {
    return p.type === 'Chegirma';
}
