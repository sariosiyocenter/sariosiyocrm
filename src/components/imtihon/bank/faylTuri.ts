import { TUR_NOMI, TUR_IZOHI } from '../../../lib/savolTuri';
import type { GuruhTuri } from '../../../types';

// Fayl turi (egasi, 2026-10-10: "savollarni qo'lda qo'shmaymiz, fayldan qo'shamiz, faqat fayl turi
// har doim bo'lsin: 4 variantli, MS-33-35, MS-36-45, yozma"). «Fayldan» yo'lida xodim faylda nima
// borligini o'zi aytadi: shunga qarab AI ko'rsatmasi, Word jadvalini o'qish qoidasi va taklif
// qilinadigan Word shablon tanlanadi. `moslash` va `qismli` — guruhli savollar (Passage.tur).

export type FaylTuri = 'yopiq' | GuruhTuri | 'yozma';

export const FAYL_TURLARI: { v: FaylTuri; nom: string; izoh: string }[] = [
  { v: 'yopiq', nom: '4 variantli', izoh: 'Oddiy test: har savolning A–D variantlari va bitta to\'g\'ri javobi bor.' },
  { v: 'moslash', nom: TUR_NOMI.juft, izoh: `${bosh(TUR_IZOHI.juft)}: bitta umumiy shart, bir nechta savol va hammasiga bitta javoblar ro'yxati (A–F).` },
  { v: 'qismli', nom: TUR_NOMI.qismli, izoh: `${bosh(TUR_IZOHI.qismli)}: bitta raqam ostida umumiy shart va a), b) qismlari — har qismning o'z javobi.` },
  { v: 'yozma', nom: TUR_NOMI.yozma, izoh: "MS-41-43: to'liq yechimi yoziladigan masala. AI har birini yechib, batafsil izohli yechim qo'shadi." },
];

function bosh(s: string | undefined): string {
  const t = String(s || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const faylTuriNomi = (t: FaylTuri): string => FAYL_TURLARI.find(x => x.v === t)?.nom || t;
/** Guruhli savol turimi (bankka `bank/guruhlar` orqali, guruh bo'lib tushadi). */
export const guruhTurimi = (t: FaylTuri | string): t is GuruhTuri => t === 'moslash' || t === 'qismli';
/** Guruh turining nomi (MS-33-35 / MS-36-45). */
export const guruhNomi = (t: GuruhTuri): string => (t === 'moslash' ? TUR_NOMI.juft : TUR_NOMI.qismli);

/**
 * Mavzusi aniqlanmagan savollar tushadigan mavzu (egasi: "mavzu nomi turmasin — yo AI ajratsin, yoki
 * noma'lum bo'lsin, o'zimiz qo'shib chiqamiz"). Fanning oddiy mavzusi: birinchi savol bilan o'zi
 * yaratiladi, bank ro'yxatida ko'rinadi va sanaladi — xodim savollarni undan kerakli mavzularga ko'chiradi.
 */
export const NOMALUM_MAVZU = "Noma'lum";
