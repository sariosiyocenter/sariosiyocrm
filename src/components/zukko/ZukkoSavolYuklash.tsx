import { ReactNode, useEffect } from 'react';
import SavolYuklash, { type SaqlashNatijasi } from '../imtihon/bank/SavolYuklash';
import { BANK_YANGILANDI, useBankDaraxt } from '../imtihon/bank/useBankDaraxt';

/**
 * Zukko kartochkasidan: Savollar bankidagi o'sha «Savol qo'shish» oynasi —
 * fan, mavzu va biriktirilgan fayllar tayyor, ajratish o'zi boshlanadi.
 * AI tekshiradi, natijani xodim ko'rib, o'zi saqlaydi. Alohida yuklanadi —
 * bank kodi Zukko ochilganda emas, kerak bo'lganda keladi.
 */
export default function ZukkoSavolYuklash({ fanId, mavzuId, fayllar, kutish, onYop, onSaqlandi }: {
    fanId: number;
    mavzuId: number | null;
    fayllar: File[];
    /** Bank daraxti kelguncha ko'rinadi. */
    kutish: ReactNode;
    /** Saqlanmay yopildi (xato — bank ochilmadi). */
    onYop: (xato?: string) => void;
    onSaqlandi: (natija: SaqlashNatijasi) => void;
}) {
    const { daraxt, xato } = useBankDaraxt();
    useEffect(() => { if (xato) onYop(xato); }, [xato]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (!daraxt) return <>{kutish}</>;
    return (
        <SavolYuklash
            daraxt={daraxt} fanId={fanId} mavzuId={mavzuId} boshFayllar={fayllar} avto yuqorida
            onYop={() => onYop()}
            onSaqlandi={n => {
                window.dispatchEvent(new Event(BANK_YANGILANDI));
                if (n) onSaqlandi(n);
            }}
        />
    );
}
