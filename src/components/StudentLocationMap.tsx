import React, { useEffect, useRef, useState } from 'react';
import { X, Navigation, ExternalLink, MapPin } from 'lucide-react';
import { ZAXIRA_MARKAZ, RANG_OQUVCHI, RANG_MARKAZ, parseLatLng, distanceKm, masofaMatni, esc, initials, avatarIcon } from '../lib/mapMarkers';

/**
 * O'quvchining uyi va o'quv markazi bitta xaritada.
 *
 * Ilgari profildagi "Xaritada ko'rish" Google Maps'ni yangi oynada ochardi —
 * u yerda faqat qizil nuqta chiqadi, kimniki ekani bilinmaydi. Endi xarita
 * CRM ichida ochiladi: o'quvchi o'z portreti bilan, markaz o'z logosi bilan
 * turadi, ikkisi orasida masofa yoziladi. Google Maps yo'lni ko'rsatish uchun
 * tugma bo'lib qoladi — navigatsiyani baribir u yaxshiroq qiladi.
 */
interface Props {
    studentName: string;
    studentPhoto?: string;
    /** "kenglik,uzunlik" — o'quvchi uyi. */
    location: string;
    /** "kenglik,uzunlik" — markaz binosi. Sozlamalarda belgilanmagan bo'lishi mumkin. */
    centerLocation?: string;
    orgName?: string;
    logo?: string;
    onClose: () => void;
}

export default function StudentLocationMap({ studentName, studentPhoto, location, centerLocation, orgName, logo, onClose }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [xatolik, setXatolik] = useState('');

    const uy = parseLatLng(location);
    // Belgilangan nuqta bo'lmasa ham markaz xaritada ko'rinsin: usiz o'quvchi
    // qayerda turgani hech narsaga nisbatan bo'lmay qoladi.
    const belgilangan = parseLatLng(centerLocation);
    const markaz = belgilangan || ZAXIRA_MARKAZ;
    const masofa = uy ? distanceKm(uy, markaz) : null;

    useEffect(() => {
        if (!mapRef.current || !uy) return;
        const L = (window as any).L;
        if (!L) { setXatolik("Xarita kutubxonasi yuklanmadi — internetni tekshiring."); return; }

        const map = L.map(mapRef.current, { zoomControl: true }).setView(uy, 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        L.marker(uy, {
            icon: avatarIcon(L, { image: studentPhoto, fallback: initials(studentName), ring: RANG_OQUVCHI }),
            title: studentName,
        }).addTo(map).bindPopup(`<b>${esc(studentName)}</b><br/>O'quvchi uyi`);

        {
            L.marker(markaz, {
                icon: avatarIcon(L, { image: logo, fallback: initials(orgName || 'Markaz'), ring: RANG_MARKAZ, white: true }),
                title: orgName || "O'quv markazi",
            }).addTo(map).bindPopup(`<b>${esc(orgName || "O'quv markazi")}</b><br/>O'quv markazi`);

            // Uzuq chiziq — qaysi o'quvchi qaysi tomonda turishi darrov ko'rinadi.
            L.polyline([markaz, uy], { color: '#1b6b6b', weight: 2, opacity: 0.7, dashArray: '6 8' }).addTo(map);
            map.fitBounds(L.latLngBounds([markaz, uy]).pad(0.35));
        }

        // Modal ochilganda konteyner o'lchami hali aniq bo'lmasligi mumkin.
        setTimeout(() => map.invalidateSize(), 200);
        return () => map.remove();
    }, [location, centerLocation, studentPhoto, logo, studentName, orgName]);

    const kartaHavolasi = uy ? `https://www.google.com/maps?q=${uy[0]},${uy[1]}` : '';
    const yolHavolasi = uy ? `https://www.google.com/maps/dir/${markaz[0]},${markaz[1]}/${uy[0]},${uy[1]}` : '';

    return (
        <div className="fixed inset-0 z-[300] flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-sirt w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-chiziq min-h-[420px] h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-6 sm:px-10 py-5 flex items-center justify-between border-b border-chiziq-mayin bg-ichki">
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-matn tracking-tight flex items-center gap-3 truncate">
                            <MapPin className="text-brand shrink-0" />
                            <span className="truncate">{studentName}</span>
                        </h2>
                        <p className="text-[11px] font-bold text-matn-xira mt-1 leading-none pt-1">
                            {masofa !== null && `Markazdan ${masofaMatni(masofa)} uzoqlikda`}
                            {!belgilangan && <span className="text-amber-600 dark:text-amber-500"> · markaz nuqtasi taxminiy, Sozlamalardan aniqlang</span>}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 shrink-0 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-matn-xira hover:text-gray-900 dark:hover:text-white transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600" aria-label="Yopish">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 relative bg-ichki">
                    <div ref={mapRef} className="absolute inset-0 z-10" />
                    {xatolik && (
                        <p className="absolute inset-0 z-20 flex items-center justify-center text-[11px] font-bold text-matn-xira px-8 text-center">{xatolik}</p>
                    )}
                </div>

                <div className="p-5 sm:px-8 sm:py-6 bg-ichki border-t border-chiziq flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-matn-xira mb-1.5 ml-1 uppercase tracking-wider">Koordinatalar</p>
                        <div className="bg-sirt px-4 py-2 rounded-xl border border-chiziq text-xs font-bold text-matn-sokin tracking-wider truncate">
                            {uy ? `${uy[0].toFixed(6)}, ${uy[1].toFixed(6)}` : "Noto'g'ri qiymat"}
                        </div>
                    </div>
                    <a href={kartaHavolasi} target="_blank" rel="noopener noreferrer"
                        className="px-6 py-3.5 bg-sirt text-matn-sokin border border-chiziq rounded-2xl text-[11px] font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
                        <ExternalLink size={15} /> Google Maps
                    </a>
                    <a href={yolHavolasi} target="_blank" rel="noopener noreferrer"
                        className="px-8 py-3.5 bg-brand text-white rounded-2xl text-[11px] font-bold hover:bg-brand-dark active:scale-[0.98] transition-all shadow-xl shadow-[#1b6b6b]/20 flex items-center justify-center gap-2">
                        <Navigation size={15} /> Yo'l ko'rsatish
                    </a>
                </div>
            </div>
        </div>
    );
}
