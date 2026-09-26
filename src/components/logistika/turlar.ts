/** Logistika → Reja: server javobi va qoralama shakllari. */

export interface DayStop {
    studentId: number; name: string; phone?: string; address?: string; location?: string; photo?: string;
    narx?: number | null; masofaKm?: number | null;
}

export interface DayPlan {
    id: number; name: string; date: string; navbat: number;
    driver: { id: number; name: string; phone?: string; telegram: boolean } | null;
    transport: { id: number; name: string; model?: string; number?: string; capacity: number } | null;
    stops: DayStop[];
    run: { startedAt?: string | null; finishedAt?: string | null } | null;
    holatlar: Record<number, string>;
    pul?: { jami: number; aniqlanmagan: number; olingan: number };
}

export interface DayDriver {
    id: number; name: string; phone?: string; telegram: boolean;
    transport: { id: number; name: string; model?: string; number?: string; capacity: number; status: string } | null;
    location: { lat: number; lng: number; live: boolean; liveUntil?: string | null; updatedAt: string } | null;
}

export interface Kun { date: string; plans: DayPlan[]; drivers: DayDriver[]; tarif: any | null }

/** Bitta haydovchining bitta reysi (lib/rejaTahrir.js dagi "car"). */
export interface Car { key: string; routeId: number | null; driverId: number; navbat: number; studentIds: number[] }

/** Yuborilmagan o'zgarishlar: mashinalar tarkibi. null — bazadagi holat. */
export interface Qoralama { cars: Car[]; asosImzo: string }

/** Faqat shu sahifaning ko'rinishi (serverga ketmaydi): bugun kim ketmaydi, kim qo'lda qo'shildi, kim ishlamaydi. */
export interface Korinish { chiqarilgan: number[]; qoshilgan: number[]; olinmagan: number[] }

export type CarHolati = 'yetkazildi' | 'yolda' | 'yangi' | 'ozgargan' | 'bosh' | 'yuborilgan';
