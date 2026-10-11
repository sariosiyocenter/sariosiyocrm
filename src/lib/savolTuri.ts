import type { SavolTuri } from '../types';

// Savol turlarining ekrandagi nomi — hamma joyda bitta. Guruhli turlar Milliy sertifikat
// (MS) varag'idagi raqamlari bilan ataladi (egasi, 2026-10-10): 33–35 — moslashtirish
// guruhi, 36–45 — qismli savol (a, b); yozma — MS-41-43 (batafsil yechim bilan).
export const TUR_NOMI: Record<SavolTuri, string> = {
  yopiq: 'Variantli', raqamli: 'Raqamli javob', moslash: 'Moslashtirish',
  juft: 'MS-33-35', qismli: 'MS-36-45', yozma: 'Yozma',
};

/** Nom yonidagi qisqa izoh (tanlov tugmalari va maslahat matnlari uchun). */
export const TUR_IZOHI: Partial<Record<SavolTuri, string>> = {
  juft: 'moslashtirish guruhi', qismli: 'qismli savol (a, b)', yozma: 'MS-41-43, batafsil yechim bilan',
};
