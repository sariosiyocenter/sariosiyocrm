// Savolning video darsi (lib/imtihonDars.js): ssenariy qadamlari va ovoz. "Video" fayl emas —
// pleer (DarsPleer.tsx) shu qadamlardan doskani o'zi chizadi.

/** Bitta qadam: doskaga yoziladigani, o'qituvchi nutqi va ovozdagi vaqti (soniya). */
export interface DarsQadami {
  sarlavha: string;
  /** Oddiy matn (HTML emas): har qator alohida, formulalar $...$ ichida. */
  doska: string;
  nutq: string;
  boshi: number;
  davomi: number;
}

/** O'quvchiga ko'rinadigan dars (natija sahifasi). */
export interface Dars {
  qadamlar: DarsQadami[];
  davomiylik: number;
  /** Ovoz fayli (MP3); null — dars subtitr bilan, ovozsiz o'ynaydi. */
  ovoz: string | null;
}

/** Bank ekranidagi (ustoz ko'radigan) dars. */
export interface BankDarsi extends Dars {
  status: 'qoralama' | 'tasdiqlangan';
  /** Dars tuzilgandan keyin yechim o'zgargan — o'quvchiga ko'rinmaydi. */
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
