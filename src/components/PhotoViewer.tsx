import React from 'react';
import { X } from 'lucide-react';

/**
 * Suratni to'liq o'lchamda ko'rsatuvchi oyna.
 *
 * Profil sahifasidagi avatar har qancha kattalashtirilsa ham yuzni yaxshi ko'rish
 * uchun kichik. Avatarni bosish suratni butun ekranga ochadi.
 */
export default function PhotoViewer({ src, name, onClose }: {
    src: string;
    name?: string;
    onClose: () => void;
}) {
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[400] bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6"
            onClick={onClose}
        >
            <button
                aria-label="Yopish"
                onClick={onClose}
                className="absolute top-5 right-5 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
                <X size={20} />
            </button>
            <img
                src={src}
                alt={name || ''}
                onClick={e => e.stopPropagation()}
                className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            />
            {name && (
                <p className="mt-4 text-sm font-bold text-white/90 tracking-tight">{name}</p>
            )}
            <p className="mt-1 text-[11px] font-bold text-white/40">Yopish uchun bosing</p>
        </div>
    );
}
