import type { SavolTuri } from '../types';

// Savol turlarining ekrandagi nomi — hamma joyda bitta. Guruhli turlar Milliy sertifikat
// (MS) varag'idagi raqamlari bilan ataladi (egasi, 2026-10-10): 33–35 — moslashtirish
// guruhi, 36–45 — qismli savol (a, b); yozma — MS-41-43 (batafsil yechim bilan).
export const TUR_NOMI: Record<SavolTuri, string> = {
  yopiq: '4 variantli', raqamli: 'Raqamli javob', moslash: 'Moslashtirish',
  juft: 'MS-33-35', qismli: 'MS-36-45', yozma: 'Yozma',
};

/** Nom yonidagi qisqa izoh (tanlov tugmalari va maslahat matnlari uchun). */
export const TUR_IZOHI: Partial<Record<SavolTuri, string>> = {
  juft: 'moslashtirish guruhi', qismli: 'qismli savol (a, b)', yozma: 'MS-41-43, batafsil yechim bilan',
};

/**
 * Test turlari — hamma joyda (filtr, tanlov, AI shakllari, yuklash) FAQAT shu to'rttasi (egasi, 2026-10-15:
 * "test turi konstanta bo'lsin, filtrlarda ham hamma joyda faqat o'sha 4 ta tur"): 4 variantli,
 * MS-33-35, MS-36-45 va yozma. Eski `raqamli`/`moslash` turlari bazada qolishi mumkin, lekin tanlov
 * va filtrlarda ko'rsatilmaydi.
 */
export const TEST_TURLARI = ['yopiq', 'juft', 'qismli', 'yozma'] as const satisfies readonly SavolTuri[];
export type TestTuri = (typeof TEST_TURLARI)[number];
export const testTurimi = (t: string): t is TestTuri => (TEST_TURLARI as readonly string[]).includes(t);
