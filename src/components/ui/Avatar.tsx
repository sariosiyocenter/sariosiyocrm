import React, { useEffect, useState } from 'react';
import { displayName } from '../../lib/displayName';

/**
 * Avatar — ilovadagi yagona nusxa.
 *
 * Muhim qoida: surat va bosh harflar hech qachon birga chiqmaydi.
 *
 * Ilgari bosh harflar orqa qatlamda turib, surat ustiga qo'yilardi —
 * shunda surat yuklanmasa harflar ochilib qolardi. Lekin ilovada
 * "fonni tozalash" amali bor va ko'p suratlar shaffof PNG: o'sha
 * suratlarning shaffof joyidan harflar ko'rinib, ikkalasi ustma-ust
 * tushib qolardi.
 *
 * Endi shart aniq: surat bor va yuklandi — faqat surat; aks holda —
 * faqat harflar. Yuklanmagani onError orqali bilinadi, ya'ni buzuq
 * manzil ham bo'sh doira qoldirmaydi.
 */
export interface AvatarProps {
    name?: string | null;
    photo?: string | null;
    /** Tomoni, piksel. Standart 32. */
    size?: number;
    /** Harflar o'lchami, piksel. Berilmasa o'lchamdan hisoblanadi. */
    fontSize?: number;
    /** Doira o'rniga yumaloq kvadrat. */
    square?: boolean;
    className?: string;
    children?: React.ReactNode;
}

function initials(name?: string | null) {
    return displayName(name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0] || '')
        .join('')
        .toUpperCase();
}

export default function Avatar({
    name, photo, size = 32, fontSize, square, className = '', children,
}: AvatarProps) {
    const [failed, setFailed] = useState(false);

    // Boshqa o'quvchiga o'tilganda oldingi xatolik esda qolmasin.
    useEffect(() => { setFailed(false); }, [photo]);

    const src = (photo || '').trim();
    const showPhoto = src.length > 0 && !failed;

    return (
        <div
            className={`relative shrink-0 overflow-hidden flex items-center justify-center bg-brand/12 text-brand font-semibold ${square ? 'rounded-xl' : 'rounded-full'} ${className}`}
            style={{ width: size, height: size, fontSize: fontSize ?? Math.max(9, Math.round(size * 0.36)) }}
        >
            {showPhoto ? (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                    className="w-full h-full object-cover object-top"
                />
            ) : (
                initials(name)
            )}
            {children}
        </div>
    );
}
