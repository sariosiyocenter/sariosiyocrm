import React from 'react';
import { X, ImageOff } from 'lucide-react';

/**
 * Suratni to'liq o'lchamda ko'rsatuvchi oyna.
 *
 * Profil sahifasidagi avatar har qancha kattalashtirilsa ham yuzni yaxshi ko'rish
 * uchun kichik. Avatarni bosish suratni butun ekranga ochadi.
 *
 * `actions` — surat ostidagi tugmalar (yuklash, kamera, fonni tozalash).
 * Telefonda avatar ustidagi tugmalar chiqmaydi (sichqoncha yo'q — hover yo'q),
 * shuning uchun surat bilan ishlash shu oynada, katta tugmalar bilan bo'ladi.
 */
export default function PhotoViewer({ src, name, onClose, actions }: {
    src?: string | null;
    name?: string;
    onClose: () => void;
    actions?: React.ReactNode;
}) {
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[400] bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6"
            onClick={onClose}
        >
            <button
                aria-label="Yopish"
                onClick={onClose}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
                <X size={22} />
            </button>
            {src ? (
                <img
                    src={src}
                    alt={name || ''}
                    onClick={e => e.stopPropagation()}
                    className={`max-w-full ${actions ? 'max-h-[62vh]' : 'max-h-[80vh]'} w-auto min-w-[min(18rem,100%)] rounded-2xl object-contain shadow-2xl`}
                />
            ) : (
                <div onClick={e => e.stopPropagation()}
                    className="w-[min(18rem,100%)] aspect-[3/4] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/50">
                    <ImageOff size={40} />
                    <span className="text-sm font-bold">Surat yo'q</span>
                </div>
            )}
            {name && (
                <p className="mt-4 text-sm font-bold text-white/90 tracking-tight text-center">{name}</p>
            )}
            {actions ? (
                <div onClick={e => e.stopPropagation()} className="mt-4 w-full max-w-md grid grid-cols-3 gap-2">
                    {actions}
                </div>
            ) : (
                <p className="mt-1 text-[11px] font-bold text-white/40">Yopish uchun bosing</p>
            )}
        </div>
    );
}

/** PhotoViewer ostidagi bitta katta tugma — barmoq bilan bosishga qulay. */
export const photoActionCls =
    'flex flex-col items-center justify-center gap-1.5 min-h-[64px] px-2 py-3 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/25 disabled:opacity-50 text-white text-[12px] font-bold text-center cursor-pointer transition-colors';
