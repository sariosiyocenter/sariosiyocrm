// Payme shu filialda amalda qaysi rejimda.
//
// Kassa bitta — butun markazga (egasi, 2026-10-08): o'z Payme sozlamasi yo'q filial
// markaz kassasidan foydalanadi. Server buni `paymeAmalda` da aytadi (services/payme.js
// kassaHolati); filialning o'z `paymeMode` i esa faqat Sozlamalar → Payme formasi uchun.
type PaymeSozlama = { paymeAmalda?: string | null; paymeMode?: string | null; paymeMerchantId?: string | null };

export function paymeRejimi(settings: PaymeSozlama | null | undefined): 'off' | 'test' | 'live' {
    const r = settings?.paymeAmalda || settings?.paymeMode || 'off';
    return r === 'live' || r === 'test' ? r : 'off';
}

/** Havola yaratsa bo'ladimi (jonli yoki test rejim). */
export const paymeYoqilgan = (settings: PaymeSozlama | null | undefined) => paymeRejimi(settings) !== 'off';
