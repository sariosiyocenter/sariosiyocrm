import { useId } from 'react';

/**
 * Zukko belgisi: brend rangidagi kvadrat, ichida "Z" va uchqun. Tinch holatda
 * uchqun sekin nafas oladi, AI o'ylayotganda Z atrofida aylanadi.
 * Ranglar mavzu tokenlaridan — qorong'u mavzuda brend yorqinroq, harf qoraroq.
 */
export default function ZukkoBelgi({ size = 28, fikrlaydi = false, className = '' }: { size?: number; fikrlaydi?: boolean; className?: string }) {
    const id = useId().replace(/:/g, '');
    return (
        <svg width={size} height={size} viewBox="0 0 28 28" className={`shrink-0 ${className}`} aria-hidden="true">
            <defs>
                <linearGradient id={`zk-g-${id}`} x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="var(--color-brand)" />
                    <stop offset="1" stopColor="var(--color-brand-accent)" />
                </linearGradient>
            </defs>
            <rect width="28" height="28" rx="8.5" fill={`url(#zk-g-${id})`} />
            <path d="M9 9.2h9.6L9.4 18.8H19" fill="none" stroke="var(--color-brand-ust)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <g className={fikrlaydi ? 'zk-aylanish' : ''}>
                <circle cx="21.5" cy="6.5" r="2" fill="var(--color-brand-ust)" className={fikrlaydi ? '' : 'zk-nafas'} />
            </g>
        </svg>
    );
}
