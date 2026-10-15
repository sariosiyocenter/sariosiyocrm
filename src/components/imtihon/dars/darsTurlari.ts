// Savolning video yechimi (lib/imtihonDars.js): ssenariy qadamlari va ovoz. "Video" fayl emas —
// pleer (DarsPleer.tsx) shu qadamlardan doskani o'zi chizadi.

/**
 * Doskaga chiziladigan element (lib/darsChizma.js elementniTozala). Koordinatalar matematik
 * (y yuqoriga); `tur` ga qarab kerakli maydonlar to'ldirilgan bo'ladi.
 */
export interface ChizmaElementi {
  tur: 'oqlar' | 'nuqta' | 'kesma' | 'aylana' | 'yoy' | 'burchak' | 'kopburchak' | 'grafik' | 'matn' | 'jism';
  /** Burchak belgisi: to'g'ri burchak (kvadratcha). */
  togri?: boolean;
  rang?: 'asosiy' | 'urgu' | 'ikkinchi';
  nom?: string;
  x?: number; y?: number; r?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  /** Kesma jism uchlari orasida (masalan A va C₁) — koordinata o'rniga. */
  uch1?: string; uch2?: string;
  xdan?: number; xgacha?: number; ydan?: number; ygacha?: number;
  /** O'qlar: X bo'linmalari π bilan (trigonometriya). */
  birlik?: 'pi';
  dan?: number; gacha?: number;
  nuqtalar?: { x: number; y: number; nom?: string }[];
  yopiq?: boolean; uzuq?: boolean; strelka?: boolean;
  ifoda?: string; matn?: string;
  jism?: 'parallelepiped' | 'kub' | 'piramida' | 'silindr' | 'konus' | 'shar';
  a?: number; b?: number; c?: number; h?: number; belgilar?: string;
}

/** Bitta qadam: doskaga yoziladigani, o'qituvchi nutqi va ovozdagi vaqti (soniya). */
export interface DarsQadami {
  sarlavha: string;
  /** Oddiy matn (HTML emas): har qator alohida, formulalar $...$ ichida. */
  doska: string;
  nutq: string;
  /** Shu qadamda doskaga chiziladigan yangi elementlar (avvalgilari qoladi). */
  chizma?: ChizmaElementi[];
  /** Shu qadamda ko'rsatiladigan savol rasmi (o'zimizning Storage havolasi). */
  rasm?: string;
  boshi: number;
  davomi: number;
}

/** O'quvchiga ko'rinadigan video yechim (natija sahifasi). */
export interface Dars {
  qadamlar: DarsQadami[];
  davomiylik: number;
  /** Ovoz fayli (MP3); null — video yechim subtitr bilan, ovozsiz o'ynaydi. */
  ovoz: string | null;
}

/** Bank ekranidagi (ustoz ko'radigan) video yechim. */
export interface BankDarsi extends Dars {
  status: 'qoralama' | 'tasdiqlangan';
  /** Video yechim tuzilgandan keyin yechim o'zgargan — o'quvchiga ko'rinmaydi. */
  eskirgan: boolean;
  korsatma: string | null;
}

/** GET/PUT/DELETE questions/:id/dars va POST …/dars/ovoz javobi. */
export interface DarsHolati {
  dars: BankDarsi | null;
  yechimBor: boolean;
  yechimTasdiqlangan: boolean;
}

/** POST questions/:id/dars/ai javobi — AI tuzgan, hali saqlanmagan ssenariy. */
export interface DarsTaklifi {
  qadamlar: DarsQadami[];
  davomiylik: number;
  ogohlar: string[];
}

export const darsVaqti = (soniya: number): string => {
  const s = Math.max(0, Math.round(soniya));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
