import React, { useEffect, useRef, useState } from 'react';
import {
    ZAXIRA_MARKAZ, RANG_MARKAZ, parseLatLng, esc, initials, avatarIcon,
} from '../lib/mapMarkers';

/**
 * Logistika xaritasi: haydovchilar qayerda turibdi va kimni qayerga olib
 * boradi. Har haydovchining o'z rangi bor — uning rejasidagi bolalar ham shu
 * rangda. Haydovchi joylashuvi Telegram botdan keladi (jonli ulashsa, har
 * necha soniyada yangilanadi); sahifa uni 30 soniyada qayta so'raydi.
 *
 * Xarita bir marta yaratiladi, yangilanishda faqat markerlar qayta chiziladi —
 * aks holda har 30 soniyada ko'rinish (zoom, surish) boshiga qaytardi.
 */

export interface MapDriver {
    id: number;
    name: string;
    color: string;
    location?: { lat: number; lng: number; live: boolean; liveUntil?: string | null; updatedAt: string } | null;
}

export interface MapStudent {
    id: number;
    name: string;
    photo?: string | null;
    location?: string | null;
    color: string;
    /** Popup uchun: kimning rejasida va holati. */
    izoh?: string;
}

interface Props {
    drivers: MapDriver[];
    students: MapStudent[];
    centerLocation?: string;
    orgName?: string;
    logo?: string;
    className?: string;
}

/** "3 daq oldin" — joylashuv qanchalik yangi ekani. */
export function qachon(iso?: string | null): string {
    if (!iso) return '';
    const daq = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (daq < 1) return 'hozirgina';
    if (daq < 60) return `${daq} daq oldin`;
    const soat = Math.round(daq / 60);
    if (soat < 24) return `${soat} soat oldin`;
    return new Date(iso).toLocaleDateString('ru-RU');
}

/** Jonli ulashish hali davom etyaptimi (Telegram 8 soat yoki "to'xtatmaguncha"). */
export function jonlimi(loc?: MapDriver['location']): boolean {
    if (!loc?.live) return false;
    if (loc.liveUntil && new Date(loc.liveUntil).getTime() < Date.now()) return false;
    // Jonli joylashuv jim qolsa (telefon o'chdi) — 15 daqiqadan keyin eskirgan.
    return Date.now() - new Date(loc.updatedAt).getTime() < 15 * 60000;
}

function mashinaIcon(L: any, color: string, label: string, live: boolean) {
    return L.divIcon({
        className: '',
        iconSize: [44, 54],
        iconAnchor: [22, 54],
        popupAnchor: [0, -50],
        html: `
          <div style="position:relative;width:44px;height:54px">
            <div style="width:44px;height:44px;border-radius:50%;background:${color};border:3px solid #fff;
                        box-shadow:0 6px 16px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center;
                        font-size:20px;line-height:1">🚐</div>
            <div style="position:absolute;left:50%;bottom:0;width:0;height:0;transform:translateX(-50%);
                        border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid ${color}"></div>
            ${live ? `<div style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff"></div>` : ''}
            <div style="position:absolute;top:46px;left:50%;transform:translateX(-50%);white-space:nowrap;
                        background:rgba(15,23,42,.85);color:#fff;font:700 10px/1 system-ui,sans-serif;padding:3px 6px;border-radius:6px">
              ${esc(label)}
            </div>
          </div>`,
    });
}

export default function LogisticsMap({ drivers, students, centerLocation, orgName, logo, className }: Props) {
    const boxRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const layerRef = useRef<any>(null);
    const fittedRef = useRef('');
    const [xatolik, setXatolik] = useState('');

    const markaz = parseLatLng(centerLocation) || ZAXIRA_MARKAZ;

    // Xarita bir marta.
    useEffect(() => {
        if (!boxRef.current) return;
        const L = (window as any).L;
        if (!L) { setXatolik('Xarita kutubxonasi yuklanmadi — internetni tekshiring.'); return; }
        const map = L.map(boxRef.current, { zoomControl: true }).setView(markaz, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        const t = setTimeout(() => map.invalidateSize(), 200);
        return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Markerlar — har yangilanishda.
    useEffect(() => {
        const L = (window as any).L;
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!L || !map || !layer) return;
        layer.clearLayers();
        const nuqtalar: [number, number][] = [markaz];

        L.marker(markaz, {
            icon: avatarIcon(L, { image: logo, fallback: initials(orgName || 'Markaz'), ring: RANG_MARKAZ, white: true, size: 40 }),
            title: orgName || "O'quv markazi",
        }).addTo(layer).bindPopup(`<b>${esc(orgName || "O'quv markazi")}</b>`);

        for (const s of students) {
            const pos = parseLatLng(s.location);
            if (!pos) continue;
            nuqtalar.push(pos);
            L.marker(pos, {
                icon: avatarIcon(L, { image: s.photo || undefined, fallback: initials(s.name), ring: s.color, size: 32 }),
                title: s.name,
            }).addTo(layer).bindPopup(`<b>${esc(s.name)}</b>${s.izoh ? `<br/>${esc(s.izoh)}` : ''}`);
        }

        for (const d of drivers) {
            if (!d.location) continue;
            const pos: [number, number] = [d.location.lat, d.location.lng];
            nuqtalar.push(pos);
            const live = jonlimi(d.location);
            L.marker(pos, { icon: mashinaIcon(L, d.color, d.name.split(' ')[0], live), zIndexOffset: 1000, title: d.name })
                .addTo(layer)
                .bindPopup(`<b>${esc(d.name)}</b><br/>${live ? '🟢 jonli · ' : ''}${esc(qachon(d.location.updatedAt))}`);
        }

        // Ko'rinish faqat nuqtalar to'plami o'zgarganda moslanadi — admin
        // xaritani surib qo'ygan bo'lsa, har 30 soniyada qaytarib yubormaylik.
        const kalit = students.map(s => s.id).join(',') + '|' + drivers.filter(d => d.location).map(d => d.id).join(',');
        if (kalit !== fittedRef.current && nuqtalar.length > 1) {
            fittedRef.current = kalit;
            map.fitBounds(L.latLngBounds(nuqtalar).pad(0.2), { maxZoom: 15 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(drivers), JSON.stringify(students.map(s => [s.id, s.location, s.color, s.izoh])), centerLocation, logo]);

    return (
        <div className={`relative rounded-2xl overflow-hidden border border-chiziq bg-ichki ${className || 'h-[360px]'}`}>
            <div ref={boxRef} className="absolute inset-0 z-10" />
            {xatolik && (
                <p className="absolute inset-0 z-20 flex items-center justify-center text-[11px] font-bold text-matn-xira px-8 text-center">{xatolik}</p>
            )}
        </div>
    );
}
