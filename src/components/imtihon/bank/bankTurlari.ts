import type { DarsFiltri, NatijaFiltri, Question, SavolTuri, YangiKun } from '../../../types';

// Savollar banki ekranining (BankJadvali) umumiy turlari va kichik yordamchilari — ekran
// bo'laklari (savol kartasi, guruh kartasi, «Boshqa filtrlar» paneli) shulardan foydalanadi.

export type Holat = '' | 'faol' | 'qoralama' | 'arxiv';
/** Ikki holatli saralash: '' — hammasi. */
export type BorYoq = '' | 'bor' | 'yoq';
/** Rasm saralashi: bor / yo'q va «chizma kutmoqda» (matnda [rasm] belgisi). */
export type RasmFiltri = BorYoq | 'kutmoqda';

/** Ro'yxat saralashi (chapdagi tuzilma tanlovidan tashqari hammasi). */
export interface Saralash {
  qiyinlik: number[]; darajalar: number[]; belgilar: Record<number, number[]>;
  holat: Holat; tur: '' | SavolTuri; qidiruv: string; qidDan: string; qidGacha: string;
  izohlar: string[]; matnli: BorYoq; joylashuv: number[];
  /**
   * Rasmli / rasmsiz savollar (rasm savolda, variantda yoki umumiy shartda); 'kutmoqda' — matnda
   * «[rasm]» belgisi bor, chizma hali qo'yilmagan (rasmsiz hisoblanmaydi).
   */
  rasm: RasmFiltri;
  /** Yechimi bor / yo'q savollar. */
  yechim: BorYoq;
  /** Yechim ustoz tasdiqlagan yoki hali tasdiqlanmagan (AI qoralamasi); '' — hammasi. */
  yechimHolati: '' | 'tasdiqlangan' | 'qoralama';
  /** Video yechim holati (tanlanganlar — "yoki"). */
  dars: DarsFiltri[];
  /** Imtihonda ishlatilgan / ishlatilmagan savollar. */
  ishlatilgan: BorYoq;
  /** Imtihon natijasiga ko'ra qiyinlik (tanlanganlar — "yoki"). */
  natija: NatijaFiltri[];
  /** Tarjimasi bor / yo'q savollar. */
  tarjima: BorYoq;
  /** Oxirgi necha kunda qo'shilgan; 0 — hammasi. */
  yangi: 0 | YangiKun;
}
export const BOSH_SARALASH: Saralash = {
  qiyinlik: [], darajalar: [], belgilar: {}, holat: '', tur: '', qidiruv: '', qidDan: '', qidGacha: '',
  izohlar: [], matnli: '', joylashuv: [], rasm: '', yechim: '',
  yechimHolati: '', dars: [], ishlatilgan: '', natija: [], tarjima: '', yangi: 0,
};

export const JOYLASHUV_NOMI: Record<number, string> = { 0: 'Avtomatik', 1: '1 ustun', 2: '2 ustun', 4: '4 ustun' };
export const HOLAT_NOMI: Record<Exclude<Holat, ''>, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };
export const RASM_NOMI: Record<Exclude<RasmFiltri, ''>, string> = { bor: 'Rasmli', yoq: 'Rasmsiz', kutmoqda: 'Chizma kutmoqda' };
export const YECHIM_NOMI: Record<Exclude<BorYoq, ''>, string> = { bor: 'Yechimi bor', yoq: "Yechimi yo'q" };
export const YECHIM_HOLATI_NOMI: Record<'tasdiqlangan' | 'qoralama', string> = { tasdiqlangan: 'Tasdiqlangan yechim', qoralama: 'Tasdiqlanmagan yechim' };
export const DARS_NOMI: Record<DarsFiltri, string> = { tasdiqlangan: 'Tasdiqlangan', qoralama: 'Tasdiqlanmagan', eskirgan: 'Eskirgan', yoq: "Videosi yo'q" };
export const ISHLATILGAN_NOMI: Record<Exclude<BorYoq, ''>, string> = { bor: 'Ishlatilgan', yoq: 'Ishlatilmagan' };
export const NATIJA_NOMI: Record<NatijaFiltri, string> = { oson: 'Oson (70%+ topgan)', orta: "O'rta (40–70%)", qiyin: 'Qiyin (40% dan kam)', yoq: "Ma'lumot yo'q" };
export const TARJIMA_NOMI: Record<Exclude<BorYoq, ''>, string> = { bor: 'Tarjimasi bor', yoq: "Tarjimasi yo'q" };
export const YANGI_NOMI: Record<YangiKun, string> = { 1: 'Oxirgi 24 soat', 7: 'Oxirgi 7 kun', 30: 'Oxirgi 30 kun' };

export const almashtirRoyxat = <K,>(l: K[], k: K) => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]);

/** Tanlanadigan tabletka-tugma (saralash qiymati). */
export const TABLETKA = (faol: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn hover:border-chiziq-kuchli'}`;
/** Kartadagi yorliq: qo'yilgani — to'liq chiziq, qo'yilmagani — punktir. */
export const CHIP = 'inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md border text-[11.5px] font-semibold whitespace-nowrap';
export const CHIP_BOR = `${CHIP} border-chiziq bg-ichki text-matn`;
export const CHIP_BOSH = `${CHIP} border-dashed border-chiziq-kuchli text-matn-xira`;

/** Ro'yxatdagi savol (GET bank/royxat). Yechimning o'zi ro'yxatda kelmaydi — faqat bor-yo'qligi. */
export type BankQatori = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'toplam' | 'source' | 'tagIds' | 'topic' | 'bankTopicId' | 'usedCount' | 'createdAt' | 'imageUrl' | 'options' | 'correctAnswer' | 'answers' | 'points' | 'remark' | 'passageId' | 'joylashuv' | 'passage' | 'solutionStatus'>
  & { yechimBor?: boolean; /** Imtihonga yaramasa — sababi (server hisoblaydi). */ xato?: string | null };

/** Bank ekranidagi ochiladigan menyular. 'yechim' — guruhli savol bo'lagining yechimi. */
export type MenyuTuri = 'fan' | 'savol' | 'mavzu' | 'daraja' | 'guruh' | 'yana' | 'guruhkarta' | 'yechim';

/** Yechim oynasining rejimi: ko'rish yoki o'zgartirish (AI ga qanday bo'lishi aytiladi). */
export type YechimRejimi = 'korish' | 'ozgartirish';

/** Chap paneldagi tuzilma tanlovi: butun fan, bitta bo'lim yoki bitta mavzu. */
export type MavzuTanlovi = { tur: 'hamma' } | { tur: 'bolim'; nom: string } | { tur: 'mavzu'; id: number };

/**
 * Saralash holatidan `GET bank/royxat?f=` ga yuboriladigan filtr (URL uchun kodlangan JSON).
 * Bank ro'yxati (BankJadvali) va «Savol qo'shish» oynasi (SavolTanlash) bir xil filtrlaydi —
 * shuning uchun bitta joyda. `holatMajbur` — holat saralashdan qat'i nazar shu qiymatga qo'yiladi.
 */
export function saralashdanSorov(s: Saralash, fanId: number | undefined, tanlov: MavzuTanlovi, holatMajbur?: Holat): string {
  return encodeURIComponent(JSON.stringify({
    fanId, qidDan: s.qidDan || undefined, qidGacha: s.qidGacha || undefined, holat: (holatMajbur ?? s.holat) || undefined,
    bolimlar: tanlov.tur === 'bolim' ? [tanlov.nom] : undefined, mavzular: tanlov.tur === 'mavzu' ? [tanlov.id] : [],
    qiyinlik: s.qiyinlik, darajalar: s.darajalar, qiyinlikSof: true, belgilar: s.belgilar,
    tur: s.tur || undefined, qidiruv: s.qidiruv.trim() || undefined,
    izohlar: s.izohlar, matnli: s.matnli || undefined, joylashuv: s.joylashuv, rasm: s.rasm || undefined, yechim: s.yechim || undefined,
    yechimHolati: s.yechimHolati || undefined, dars: s.dars, ishlatilgan: s.ishlatilgan || undefined, natija: s.natija,
    tarjima: s.tarjima || undefined, yangi: s.yangi || undefined,
  }));
}
