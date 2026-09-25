import type { Exam } from '../../types';

/** GET /api/exams/:id — imtihon, uning variantlari, kurslari va bosqichlar holati. */
export type ImtihonTafsil = Exam & {
  variantlar: { session: number; code: string }[];
  assignments: { groupId: number; group: { id: number; name: string; schoolId: number } }[];
  _count: { results: number; seats: number };
  holat: BosqichHolati;
};

/** Modul tablaridagi belgilar uchun sanoqlar (routes/imtihon.js `bosqichHolati`). */
export interface BosqichHolati {
  orinlar: number;
  keldi: number;
  kelmadi: number;
  natijalar: number;
  shubhali: number;
  skanerlanmagan: number;
  xabar: number;
}

/** Imtihonlar modulining 6 bosqichi (tab). */
export type TabId = 'savollar' | 'imtihonlar' | 'orin' | 'chop' | 'skaner' | 'natija';
