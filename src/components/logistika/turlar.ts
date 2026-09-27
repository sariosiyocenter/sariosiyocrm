/** Logistika → Reja: server javobi va qoralama shakllari. */

export interface DayStop {
    studentId: number; name: string; phone?: string; address?: string; location?: string; photo?: string;
    narx?: number | null; masofaKm?: number | null;
}

export interface DayPlan {
    id: number; name: string; date: string; navbat: number;
    /** Dars tugash vaqti (to'lqin) — "18:00"; null — qo'lda tuzilgan reja. */
    tolqin?: string | null;
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

/** Haydovchining shu to'lqindagi javobi (botda "Ha / Yo'q" yoki admin belgilagan). */
export interface TolqinJavob {
    driverId: number;
    status: 'HA' | 'YOQ' | 'KUTILMOQDA';
    askedAt?: string | null;
    answeredAt?: string | null;
    /** "Ha" degan, lekin rejaga kirmagan — "kerak emas" deb yozilgan. */
    kerakEmas?: boolean;
}

/** Bitta to'lqin: shu vaqtda darsi tugaydigan transport bolalari va avtomatika holati. */
export interface TolqinHolat {
    endTime: string;
    kurslar: { id: number; name: string }[];
    bolalar: number[];
    kelmaganlar: { id: number; sabab: string }[];
    sorashVaqti: string | null;
    rejaVaqti: string | null;
    soralganAt: string | null;
    rejaAt: string | null;
    /** Avtomatika to'xtagan sabab: 'ha_yoq', 'bola_yoq', 'reja_bor', 'taxminiy' … */
    izoh: string | null;
    javoblar: TolqinJavob[];
}

/** Logistika avtomatikasi (butun markazga bitta). */
export interface AvtoSozlama { sorash: boolean; sorashOldin: number; rejalash: boolean; rejalashOldin: number }

export interface Kun {
    date: string; plans: DayPlan[]; drivers: DayDriver[]; tarif: any | null;
    tolqinlar: TolqinHolat[]; avto: AvtoSozlama | null; hozir: string | null;
}

/** Bitta haydovchining bitta reysi (lib/rejaTahrir.js dagi "car"). */
export interface Car { key: string; routeId: number | null; driverId: number; navbat: number; studentIds: number[] }

/** Yuborilmagan o'zgarishlar: mashinalar tarkibi. null — bazadagi holat. */
export interface Qoralama { cars: Car[]; asosImzo: string }

/** Faqat shu sahifaning ko'rinishi (serverga ketmaydi): kim ketmaydi, kim qo'lda qo'shildi, kim ishlamaydi (qo'lda rejada). */
export interface Korinish { chiqarilgan: number[]; qoshilgan: number[]; olinmagan: number[] }

export type CarHolati = 'yetkazildi' | 'yolda' | 'yangi' | 'ozgargan' | 'bosh' | 'yuborilgan';
