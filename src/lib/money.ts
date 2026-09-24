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
    // Musbat `Oylik` — ko'chirish/chiqishdagi qayta hisob (kredit), pul emas.
    return p.amount > 0 && p.type !== 'Chegirma' && p.type !== 'Oylik';
}

/** Chegirma (qayta hisob) yozuvimi. */
export function isDiscount(p: Pick<Payment, 'type'>): boolean {
    return p.type === 'Chegirma';
}

/**
 * Ro'yxat tartibi: eng yangisi tepada. Avval to'lov sanasi, bir kunda —
 * bazaga kiritilgan vaqti, so'ng id.
 *
 * Ilgari Moliyadagi ro'yxat bazadan kelgan tartibni shunchaki teskari
 * qilardi. Baza tartibni kafolatlamaydi: tahrirlangan yozuv oxiriga
 * surilardi va 22-sentabrdagi to'lov 24-sentabrdagidan tepada turardi.
 */
export function newestFirst<T extends { id: number; date: string; createdAt?: string }>(a: T, b: T): number {
    return (b.date || '').localeCompare(a.date || '')
        || (b.createdAt || '').localeCompare(a.createdAt || '')
        || b.id - a.id;
}
