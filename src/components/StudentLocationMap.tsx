import React, { useEffect, useRef, useState } from 'react';
import { X, Navigation, ExternalLink, MapPin } from 'lucide-react';

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

/** "38.47,67.95" → [38.47, 67.95]; noto'g'ri qiymat uchun null. */
function parseLatLng(value?: string): [number, number] | null {
    if (!value || !value.includes(',')) return null;
    const [lat, lng] = value.split(',').map(Number);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return [lat, lng];
}

/** Ikki nuqta orasidagi masofa, km (haversine). */
function distanceKm(a: [number, number], b: [number, number]): number {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLng = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Marker HTML ichiga tushadigan matn — ism ham, rasm manzili ham. */
function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Ism-familiyadan ikki harfli bosh harf: rasm bo'lmasa shu chiqadi. */
function initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

/**
 * Dumaloq rasmli marker. Leaflet ikonkasi — oddiy HTML, shuning uchun
 * portret ham, logo ham shu yerda `img` bo'lib turadi.
 */
function avatarIcon(L: any, opts: { image?: string; fallback: string; ring: string; label: string; white?: boolean }) {
    const size = 54;
    const inner = opts.image
        ? `<img src="${esc(opts.image)}" alt="" style="width:100%;height:100%;object-fit:${opts.white ? 'contain' : 'cover'};${opts.white ? 'padding:5px;' : ''}display:block" />`
        : `<span style="font:700 15px/1 system-ui,sans-serif;color:${opts.ring}">${esc(opts.fallback)}</span>`;
    return L.divIcon({
        className: '',
        iconSize: [size, size + 10],
        iconAnchor: [size / 2, size + 10],
        popupAnchor: [0, -size],
        html: `
          <div style="position:relative;width:${size}px;height:${size + 10}px">
            <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;
                        background:${opts.white ? '#fff' : '#e2e8f0'};border:3px solid ${opts.ring};
                        box-shadow:0 6px 16px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center">
              ${inner}
            </div>
            <div style="position:absolute;left:50%;bottom:0;width:0;height:0;transform:translateX(-50%);
                        border-left:7px solid transparent;border-right:7px solid transparent;
                        border-top:11px solid ${opts.ring}"></div>
          </div>`,
    });
}

export default function StudentLocationMap({ studentName, studentPhoto, location, centerLocation, orgName, logo, onClose }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [xatolik, setXatolik] = useState('');

    const uy = parseLatLng(location);
    const markaz = parseLatLng(centerLocation);
    const masofa = uy && markaz ? distanceKm(uy, markaz) : null;

    useEffect(() => {
        if (!mapRef.current || !uy) return;
        const L = (window as any).L;
        if (!L) { setXatolik("Xarita kutubxonasi yuklanmadi — internetni tekshiring."); return; }

        const map = L.map(mapRef.current, { zoomControl: true }).setView(uy, 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        L.marker(uy, {
            icon: avatarIcon(L, { image: studentPhoto, fallback: initials(studentName), ring: '#1b6b6b', label: studentName }),
            title: studentName,
        }).addTo(map).bindPopup(`<b>${esc(studentName)}</b><br/>O'quvchi uyi`);

        if (markaz) {
            L.marker(markaz, {
                icon: avatarIcon(L, { image: logo, fallback: initials(orgName || 'Markaz'), ring: '#0ea5e9', label: orgName || 'Markaz', white: true }),
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
    const yolHavolasi = uy
        ? (markaz
            ? `https://www.google.com/maps/dir/${markaz[0]},${markaz[1]}/${uy[0]},${uy[1]}`
            : `https://www.google.com/maps/dir/?api=1&destination=${uy[0]},${uy[1]}`)
        : '';

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
                            {masofa !== null
                                ? `Markazdan ${masofa < 1 ? Math.round(masofa * 1000) + ' m' : masofa.toFixed(1) + ' km'} uzoqlikda`
                                : "Markaz joylashuvi Sozlamalarda belgilanmagan"}
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
