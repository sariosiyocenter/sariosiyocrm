import React from 'react';

/**
 * Ko'rsatkich kartochkasi — ilovadagi yagona nusxa.
 *
 * Ilgari bu kartochka uchta faylda (CourseDetails, StudentDetails,
 * TeacherDetails) so'zma-so'z takrorlangan edi. Uchtasi bir-biridan asta
 * uzoqlashib borardi: birida radius 2xl, boshqasida xl; birida qiymat 30px,
 * boshqasida 28px. Endi bitta joy.
 *
 * Chizmadan chiqqan ikki qoida shu yerda majburlangan:
 *
 * 1. Har bir `bar` bilan birga `barCaption` bo'lishi shart. Izohsiz chiziq
 *    nimaning ulushi ekanini aytmaydi, ya'ni hech narsa anglatmaydi.
 * 2. `tone` raqamning o'ziga rang beradi, `subTone` esa faqat izohga.
 *    "Guruhlar 5" sariq bo'lsa, go'yo 5 yomon son — aslida muammo izohda:
 *    bittasiga ustoz biriktirilmagan.
 */
export interface StatTileProps {
    label: string;
    value: React.ReactNode;
    unit?: string;
    subValue?: React.ReactNode;
    /** Raqamning rangi. Raqamning o'zi yomon xabar bo'lgandagina beriladi. */
    tone?: 'good' | 'warn' | 'bad' | 'brand';
    /** Izohning rangi. Muammo raqamda emas, izohda bo'lsa shu ishlatiladi. */
    subTone?: 'good' | 'warn' | 'bad';
    /** 0–100. `barCaption` bilan birga beriladi. */
    bar?: number | null;
    barTone?: 'good' | 'warn' | 'bad' | 'brand';
    /** Chiziq nimaning ulushi ekani. `bar` berilsa majburiy. */
    barCaption?: React.ReactNode;
    /** Butun kartochkani qizil qiladi — e'tibor talab qiladigan bitta raqam uchun. */
    accent?: boolean;
    onClick?: () => void;
}

const MATN = {
    good: 'text-yaxshi',
    warn: 'text-ogoh',
    bad: 'text-xato',
    brand: 'text-brand',
};

const FON = {
    good: 'bg-yaxshi',
    warn: 'bg-ogoh',
    bad: 'bg-xato',
    brand: 'bg-brand',
};

export default function StatTile({
    label, value, unit, subValue, tone, subTone,
    bar, barTone = 'brand', barCaption, accent, onClick,
}: StatTileProps) {
    const valueCls = tone ? MATN[tone] : 'text-matn';
    const subCls = subTone ? MATN[subTone] : 'text-matn-xira';
    const kartochka = accent
        ? 'bg-xato-fon border-xato-chiziq hover:border-xato'
        : 'bg-sirt border-chiziq hover:border-chiziq-kuchli';

    return (
        <div
            onClick={onClick}
            className={`rounded-xl border px-4 py-3.5 transition-colors ${kartochka} ${onClick ? 'cursor-pointer' : ''}`}
        >
            <span className="text-[12px] text-matn-sokin">{label}</span>
            <div className="mt-1 flex items-baseline">
                <span className={`raqam text-[27px] font-semibold leading-[1.1] ${valueCls}`} title={String(value)}>
                    {value}
                </span>
                {unit && <span className="raqam text-[13px] text-matn-xira ml-1">{unit}</span>}
            </div>

            {bar != null ? (
                <>
                    <div className="mt-2.5 h-1 rounded-full bg-chiziq overflow-hidden">
                        <div
                            className={`h-full rounded-full ${FON[barTone]}`}
                            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
                        />
                    </div>
                    <span className="text-[11px] text-matn-xira block mt-1.5 truncate">{barCaption}</span>
                </>
            ) : subValue ? (
                <span className={`text-[12px] block mt-1.5 truncate ${subCls}`}>{subValue}</span>
            ) : null}
        </div>
    );
}
