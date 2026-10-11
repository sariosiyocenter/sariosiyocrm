import type { Question, SavolTuri } from '../../../types';

// Savollar banki ekranining (BankJadvali) umumiy turlari va kichik yordamchilari — ekran
// bo'laklari (savol kartasi, guruh kartasi, «Boshqa filtrlar» paneli) shulardan foydalanadi.

export type Holat = '' | 'faol' | 'qoralama' | 'arxiv';
/** Ikki holatli saralash: '' — hammasi. */
export type BorYoq = '' | 'bor' | 'yoq';

/** Ro'yxat saralashi (chapdagi tuzilma tanlovidan tashqari hammasi). */
export interface Saralash {
  qiyinlik: number[]; darajalar: number[]; belgilar: Record<number, number[]>; manbalar: string[];
  toplam: string | null; holat: Holat; tur: '' | SavolTuri; qidiruv: string; qidDan: string; qidGacha: string;
  izohlar: string[]; matnli: BorYoq; joylashuv: number[];
  /** Rasmli / rasmsiz savollar (rasm savolda, variantda yoki umumiy shartda). */
  rasm: BorYoq;
  /** Yechimi bor / yo'q savollar. */
  yechim: BorYoq;
}
export const BOSH_SARALASH: Saralash = {
  qiyinlik: [], darajalar: [], belgilar: {}, manbalar: [], toplam: null, holat: '', tur: '', qidiruv: '', qidDan: '', qidGacha: '',
  izohlar: [], matnli: '', joylashuv: [], rasm: '', yechim: '',
};

export const JOYLASHUV_NOMI: Record<number, string> = { 0: 'Avtomatik', 1: '1 ustun', 2: '2 ustun', 4: '4 ustun' };
export const HOLAT_NOMI: Record<Exclude<Holat, ''>, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };
export const RASM_NOMI: Record<Exclude<BorYoq, ''>, string> = { bor: 'Rasmli', yoq: 'Rasmsiz' };
export const YECHIM_NOMI: Record<Exclude<BorYoq, ''>, string> = { bor: 'Yechimi bor', yoq: "Yechimi yo'q" };

export const almashtirRoyxat = <K,>(l: K[], k: K) => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]);

/** Tanlanadigan tabletka-tugma (saralash qiymati). */
export const TABLETKA = (faol: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn hover:border-chiziq-kuchli'}`;
/** Kartadagi yorliq: qo'yilgani — to'liq chiziq, qo'yilmagani — punktir. */
export const CHIP = 'inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md border text-[11.5px] font-semibold whitespace-nowrap';
export const CHIP_BOR = `${CHIP} border-chiziq bg-ichki text-matn`;
export const CHIP_BOSH = `${CHIP} border-dashed border-chiziq-kuchli text-matn-xira`;

/** Ro'yxatdagi savol (GET bank/royxat). Yechimning o'zi ro'yxatda kelmaydi — faqat bor-yo'qligi. */
export type BankQatori = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'toplam' | 'source' | 'tagIds' | 'topic' | 'bankTopicId' | 'usedCount' | 'createdAt' | 'imageUrl' | 'options' | 'correctAnswer' | 'answers' | 'points' | 'remark' | 'passageId' | 'joylashuv' | 'passage' | 'solutionStatus'>
  & { yechimBor?: boolean };

/** Bank ekranidagi ochiladigan menyular. 'yechim' — guruhli savol bo'lagining yechimi. */
export type MenyuTuri = 'fan' | 'savol' | 'mavzu' | 'daraja' | 'guruh' | 'yana' | 'guruhkarta' | 'yechim';

/** Yechim oynasining rejimi: ko'rish yoki o'zgartirish (AI ga qanday bo'lishi aytiladi). */
export type YechimRejimi = 'korish' | 'ozgartirish';
