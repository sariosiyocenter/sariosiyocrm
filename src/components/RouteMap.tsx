import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
    ZAXIRA_MARKAZ, RANG_OQUVCHI, RANG_MARKAZ,
    parseLatLng, distanceKm, masofaMatni, esc, initials, avatarIcon,
} from '../lib/mapMarkers';

/**
 * Marshrut xaritasi: bekatlar tartib bilan, har biri o'quvchi portreti va
 * raqami bilan; markaz o'z logosi bilan.
 *
 * Ilgari marshrutda faqat matnli manzil ko'rinardi — kim qayerda turgani va
 * tartib mantiqiymi yo'qmi bilinmasdi. Koordinatasi yo'q o'quvchi xaritada
 * ko'rinmaydi, shuning uchun ularning soni alohida aytiladi.
 */
export interface RouteMapStop {
    studentId: number;
    name: string;
    photo?: string | null;
    location?: string | null;
}

interface Props {
    stops: RouteMapStop[];
    /** "kenglik,uzunlik" — markaz binosi (Sozlamalardan). */
    centerLocation?: string;
    orgName?: string;
    logo?: string;
    /** Marshrut yo'nalishi: chiziq markazdan boshlanadimi yoki markazda tugaydimi. */
    direction?: 'KETISH' | 'QAYTISH';
    /** Bekat bosilganda — ro'yxatda o'sha qatorni ajratib ko'rsatish uchun. */
    onStopClick?: (studentId: number) => void;
    className?: string;
}

export default function RouteMap({ stops, centerLocation, orgName, logo, direction = 'KETISH', onStopClick, className }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [xatolik, setXatolik] = useState('');

    const markaz = parseLatLng(centerLocation) || ZAXIRA_MARKAZ;
    const nuqtali = stops.filter(s => parseLatLng(s.location));
    const nuqtasiz = stops.length - nuqtali.length;

    // Umumiy masofa: markazdan bekatlar bo'ylab (yoki teskari) — marshrut
    // tartibi mantiqiymi yo'qmi shundan ko'rinadi.
    let jamiKm = 0;
    {
        const ketma = nuqtali.map(s => parseLatLng(s.location)!);
        const yol = direction === 'QAYTISH' ? [...ketma, markaz] : [markaz, ...ketma];
        for (let i = 1; i < yol.length; i++) jamiKm += distanceKm(yol[i - 1], yol[i]);
    }

    useEffect(() => {
        if (!mapRef.current) return;
        const L = (window as any).L;
        if (!L) { setXatolik('Xarita kutubxonasi yuklanmadi — internetni tekshiring.'); return; }
        setXatolik('');

        const map = L.map(mapRef.current, { zoomControl: true }).setView(markaz, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        L.marker(markaz, {
            icon: avatarIcon(L, { image: logo, fallback: initials(orgName || 'Markaz'), ring: RANG_MARKAZ, white: true, size: 46 }),
            title: orgName || "O'quv markazi",
        }).addTo(map).bindPopup(`<b>${esc(orgName || "O'quv markazi")}</b><br/>O'quv markazi`);

        const koordinatalar: [number, number][] = [];
        nuqtali.forEach((stop, idx) => {
            const pos = parseLatLng(stop.location)!;
            koordinatalar.push(pos);
            const marker = L.marker(pos, {
                icon: avatarIcon(L, {
                    image: stop.photo || undefined,
                    fallback: initials(stop.name),
                    ring: RANG_OQUVCHI,
                    badge: idx + 1,
                    size: 44,
                }),
                title: stop.name,
            }).addTo(map);
            marker.bindPopup(`<b>${idx + 1}. ${esc(stop.name)}</b>`);
            if (onStopClick) marker.on('click', () => onStopClick(stop.studentId));
        });

        if (koordinatalar.length > 0) {
            const yol = direction === 'QAYTISH' ? [...koordinatalar, markaz] : [markaz, ...koordinatalar];
            L.polyline(yol, { color: RANG_OQUVCHI, weight: 2, opacity: 0.7, dashArray: '6 8' }).addTo(map);
            map.fitBounds(L.latLngBounds(yol).pad(0.3));
        }

        // Konteyner o'lchami ochilish paytida hali aniq bo'lmasligi mumkin.
        const t = setTimeout(() => map.invalidateSize(), 200);
        return () => { clearTimeout(t); map.remove(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(stops.map(s => [s.studentId, s.location, s.photo])), centerLocation, logo, orgName, direction]);

    return (
        <div className={className}>
            <div className="relative rounded-2xl overflow-hidden border border-chiziq h-[320px] bg-ichki">
                <div ref={mapRef} className="absolute inset-0 z-10" />
                {xatolik && (
                    <p className="absolute inset-0 z-20 flex items-center justify-center text-[11px] font-bold text-matn-xira px-8 text-center">{xatolik}</p>
                )}
                {!xatolik && nuqtali.length === 0 && (
                    <p className="absolute inset-0 z-20 flex items-center justify-center text-[11px] font-bold text-matn-xira px-8 text-center pointer-events-none">
                        Bekatlarning birortasida ham xaritadagi joylashuv belgilanmagan
                    </p>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1">
                <span className="text-[10px] font-bold text-matn-xira flex items-center gap-1">
                    <MapPin size={11} className="text-brand" /> Yo'l uzunligi: {masofaMatni(jamiKm)}
                </span>
                {nuqtasiz > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500">
                        {nuqtasiz} ta o'quvchida joylashuv belgilanmagan — xaritada ko'rinmaydi
                    </span>
                )}
            </div>
        </div>
    );
}
