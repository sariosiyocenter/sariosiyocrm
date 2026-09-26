import React, { useEffect, useRef, useState } from 'react';
import { esc, initials, avatarIcon, RANG_MARKAZ } from '../../lib/mapMarkers';
import { jonlimi, qachon } from '../LogisticsMap';

/**
 * Reja xaritasi (2026-09-26): kunning hamma bolasi — har biri o'z
 * mashinasining rangida, bekat raqami bilan; rejasizlari kulrang. Tanlangan
 * mashinaning yo'li ko'chalar bo'ylab (OSRM, 2026-09-27); yo'l hali kelmagan
 * yoki olinmagan bo'lsa — uzuq to'g'ri chiziq. Bola bosilsa sahifa uni
 * tanlaydi; "joy" rejimida xarita bosilgan nuqta — bolaning uyi.
 *
 * Xarita bir marta yaratiladi, keyin faqat qatlamlar qayta chiziladi —
 * aks holda har o'zgarishda ko'rinish (zoom, surish) boshiga qaytardi.
 * Ko'rinish faqat `moslashKaliti` o'zgarganda (sana, "Hammasi" tugmasi)
 * yoki `fokus` berilganda moslanadi.
 */

export type BolaHolati = 'rejasiz' | 'rejada' | 'olindi' | 'yetkazildi' | 'chiqmadi';

export interface XBola {
    id: number;
    name: string;
    photo?: string | null;
    pos: [number, number];
    rang: string;
    tartib?: number | null;
    holat: BolaHolati;
    xira?: boolean;
}

export interface XYol {
    key: string;
    rang: string;
    nuqtalar: [number, number][];
    uzuq: boolean;
    xira: boolean;
}

export interface XHaydovchi {
    id: number;
    name: string;
    rang: string;
    location?: { lat: number; lng: number; live: boolean; liveUntil?: string | null; updatedAt: string } | null;
}

interface Props {
    markaz: [number, number];
    orgName?: string;
    logo?: string;
    bolalar: XBola[];
    yollar: XYol[];
    haydovchilar: XHaydovchi[];
    tanlangan: number | null;
    rejim: 'oddiy' | 'boyash' | 'joy';
    joyNuqta?: [number, number] | null;
    onBola: (id: number) => void;
    onXarita: (pos: [number, number]) => void;
    /** O'zgarsa — ko'rinish hamma nuqtalarga moslanadi. */
    moslashKaliti: string;
    /** Berilsa (va kaliti o'zgarsa) — ko'rinish shu nuqtalarga moslanadi. */
    fokus?: { kalit: string; nuqtalar: [number, number][] } | null;
    className?: string;
    children?: React.ReactNode;
}

const KULRANG = '#94a3b8';

const HOLAT_BELGI: Partial<Record<BolaHolati, { bg: string; belgi: string }>> = {
    olindi: { bg: '#0284c7', belgi: '🚐' },
    yetkazildi: { bg: '#16a34a', belgi: '✓' },
    chiqmadi: { bg: '#e11d48', belgi: '✕' },
};

/** Uzoqlashganda markerlar kichrayadi (rasm va raqamsiz nuqta) — 300 ta bola bir to'da bo'lib qolmasin. */
export type Olcham = 'kichik' | 'orta' | 'katta';
export const olchamOl = (zoom: number): Olcham => (zoom >= 15 ? 'katta' : zoom >= 14 ? 'orta' : 'kichik');

function bolaIcon(L: any, b: XBola, tanlangan: boolean, olcham: Olcham) {
    const size = tanlangan ? 44 : olcham === 'katta' ? 34 : olcham === 'orta' ? 28 : 16;
    const nuqta = size < 24;
    const rejasiz = b.holat === 'rejasiz';
    const ring = rejasiz ? KULRANG : b.rang;
    const inner = nuqta ? ''
        : b.photo
        ? `<img src="${esc(b.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" />`
        : `<span style="font:800 ${Math.round(size / 3)}px/1 system-ui,sans-serif;color:${rejasiz ? '#64748b' : ring}">${esc(initials(b.name))}</span>`;
    const tartib = b.tartib && !nuqta ? `
        <div style="position:absolute;top:-6px;right:-7px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;
                    background:${ring};color:#fff;border:2px solid #fff;font:800 10.5px/15px system-ui,sans-serif;text-align:center;
                    box-shadow:0 2px 5px rgba(15,23,42,.35)">${b.tartib}</div>` : '';
    const h = nuqta ? undefined : HOLAT_BELGI[b.holat];
    const holat = h ? `
        <div style="position:absolute;bottom:-3px;right:-5px;width:17px;height:17px;border-radius:50%;background:${h.bg};
                    color:#fff;border:2px solid #fff;font:800 9px/13px system-ui,sans-serif;text-align:center">${h.belgi}</div>` : '';
    const halqa = tanlangan ? `box-shadow:0 0 0 5px ${ring}55,0 8px 20px rgba(15,23,42,.45);` : 'box-shadow:0 3px 10px rgba(15,23,42,.35);';
    return L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `
          <div style="position:relative;width:${size}px;height:${size}px;opacity:${b.xira ? 0.3 : 1};transition:opacity .15s">
            <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:${nuqta ? (rejasiz ? '#e2e8f0' : ring) : rejasiz ? '#f1f5f9' : '#fff'};
                        border:${tanlangan ? 4 : nuqta ? 2 : 3}px ${rejasiz ? 'dashed' : 'solid'} ${nuqta && !rejasiz ? '#fff' : ring};${halqa}
                        display:flex;align-items:center;justify-content:center;${rejasiz && b.photo ? 'filter:grayscale(.6);' : ''}">
              ${inner}
            </div>
            ${tartib}${holat}
          </div>`,
    });
}

function mashinaIcon(L: any, color: string, label: string, live: boolean) {
    return L.divIcon({
        className: '',
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        html: `
          <div style="position:relative;width:40px;height:50px">
            <div style="width:40px;height:40px;border-radius:50%;background:${color};border:3px solid #fff;
                        box-shadow:0 6px 16px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1">🚐</div>
            <div style="position:absolute;left:50%;bottom:0;width:0;height:0;transform:translateX(-50%);
                        border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${color}"></div>
            ${live ? `<div style="position:absolute;top:-2px;right:-2px;width:13px;height:13px;border-radius:50%;background:#22c55e;border:2px solid #fff"></div>` : ''}
            <div style="position:absolute;top:42px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(15,23,42,.85);
                        color:#fff;font:700 10px/1 system-ui,sans-serif;padding:3px 6px;border-radius:6px">${esc(label)}</div>
          </div>`,
    });
}

/**
 * Ko'rinish uchun nuqtalar: markazdan eng uzoq 5% tashlanadi (masalan boshqa
 * shaharda noto'g'ri belgilangan uy) — aks holda butun xarita shunga
 * kichrayib, bolalar bitta to'da bo'lib qolardi. Kamida 8 km radius qoladi.
 */
function asosiyNuqtalar(markaz: [number, number], nuqtalar: [number, number][]): [number, number][] {
    if (nuqtalar.length < 5) return [markaz, ...nuqtalar];
    const km = (a: [number, number], b: [number, number]) => {
        const R = 6371, r = Math.PI / 180;
        const h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    };
    const masofa = nuqtalar.map(n => km(markaz, n)).sort((a, b) => a - b);
    const chegara = Math.max(8, masofa[Math.floor(masofa.length * 0.95)] * 1.15);
    return [markaz, ...nuqtalar.filter(n => km(markaz, n) <= chegara)];
}

export default function RejaXarita(p: Props) {
    const boxRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    // Oxirgi avtomatik moslash va foydalanuvchi xaritani o'zi surgan/kattalashtirganmi.
    // Konteyner o'lchami keyin o'zgarsa (sahifa hali chizilayotganda, panel,
    // telefon burilishi) ko'rinish qayta moslanadi — aks holda xarita juda
    // uzoqdan ko'rinib, bolalar bir burchakda to'da bo'lib qolardi.
    const oxirgiMoslash = useRef<{ bounds: any; maxZoom: number } | null>(null);
    const qolda = useRef(false);
    const dasturiy = useRef(false);
    const moslab = (bounds: any, maxZoom: number, animate: boolean) => {
        const map = mapRef.current;
        if (!map) return;
        oxirgiMoslash.current = { bounds, maxZoom };
        qolda.current = false;
        dasturiy.current = true;
        map.fitBounds(bounds, { maxZoom, animate });
        if (!animate) dasturiy.current = false;
    };
    const qatlam = useRef<{ yol: any; bola: any; boshqa: any } | null>(null);
    const cb = useRef(p);
    cb.current = p;
    const [xatolik, setXatolik] = useState('');
    const [tayyor, setTayyor] = useState(false);
    const [olcham, setOlcham] = useState<Olcham>('orta');

    // Xarita bir marta.
    useEffect(() => {
        if (!boxRef.current) return;
        const L = (window as any).L;
        if (!L) { setXatolik('Xarita kutubxonasi yuklanmadi — internetni tekshiring.'); return; }
        const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true }).setView(p.markaz, 13);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap', maxZoom: 19,
        }).addTo(map);
        // OSRM ochiq serverining shartlari: manba va "xaritani tuzatish" havolasi.
        // "Leaflet" belgisi olib tashlandi — telefonda yozuv bir qatorga sig'sin.
        map.attributionControl.setPrefix(false);
        map.attributionControl.addAttribution(`yo'llar: <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">xaritani tuzatish</a>`);
        qatlam.current = { yol: L.layerGroup().addTo(map), boshqa: L.layerGroup().addTo(map), bola: L.layerGroup().addTo(map) };
        map.on('click', (e: any) => cb.current.onXarita([e.latlng.lat, e.latlng.lng]));
        map.on('zoomend', () => setOlcham(olchamOl(map.getZoom())));
        map.on('dragstart', () => { qolda.current = true; });
        map.on('zoomstart', () => { if (!dasturiy.current) qolda.current = true; });
        map.on('moveend', () => { dasturiy.current = false; });
        mapRef.current = map;
        setTayyor(true);
        // Konteyner o'lchami o'zgarsa — xarita cho'zilsin; foydalanuvchi o'zi
        // surmagan bo'lsa ko'rinish ham qayta moslansin.
        const ro = new ResizeObserver(() => {
            map.invalidateSize();
            const m = oxirgiMoslash.current;
            if (m && !qolda.current && map.getSize().x > 0) moslab(m.bounds, m.maxZoom, false);
        });
        ro.observe(boxRef.current);
        return () => { ro.disconnect(); map.remove(); mapRef.current = null; qatlam.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Yo'llar.
    useEffect(() => {
        const L = (window as any).L;
        const q = qatlam.current;
        if (!L || !q) return;
        q.yol.clearLayers();
        for (const y of p.yollar) {
            if (y.nuqtalar.length < 2) continue;
            // Oq "soya" chiziq ustida rangli — har qanday fonda ko'rinadi.
            L.polyline(y.nuqtalar, { color: '#fff', weight: 8, opacity: y.xira ? 0.15 : 0.7, interactive: false }).addTo(q.yol);
            L.polyline(y.nuqtalar, {
                color: y.rang, weight: 4.5, opacity: y.xira ? 0.2 : 0.95, interactive: false,
                dashArray: y.uzuq ? '9 8' : undefined, lineCap: 'round', lineJoin: 'round',
            }).addTo(q.yol);
        }
    }, [tayyor, p.yollar]);

    // Markaz, haydovchilar va tanlangan joy.
    useEffect(() => {
        const L = (window as any).L;
        const q = qatlam.current;
        if (!L || !q) return;
        q.boshqa.clearLayers();
        L.marker(p.markaz, {
            icon: avatarIcon(L, { image: p.logo, fallback: initials(p.orgName || 'Markaz'), ring: RANG_MARKAZ, white: true, size: 40 }),
            title: p.orgName || "O'quv markazi", zIndexOffset: 500,
        }).addTo(q.boshqa).bindTooltip(esc(p.orgName || "O'quv markazi"));
        for (const d of p.haydovchilar) {
            if (!d.location) continue;
            const live = jonlimi(d.location);
            L.marker([d.location.lat, d.location.lng], { icon: mashinaIcon(L, d.rang, d.name.split(' ')[0], live), zIndexOffset: 2000, interactive: true })
                .addTo(q.boshqa)
                .bindTooltip(`${esc(d.name)} · ${live ? 'jonli · ' : ''}${esc(qachon(d.location.updatedAt))}`);
        }
        if (p.joyNuqta) {
            L.circleMarker(p.joyNuqta, { radius: 12, color: '#fff', weight: 3, fillColor: '#e11d48', fillOpacity: 1 }).addTo(q.boshqa);
            L.circleMarker(p.joyNuqta, { radius: 26, color: '#e11d48', weight: 2, fillOpacity: 0.08, dashArray: '4 4', interactive: false }).addTo(q.boshqa);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tayyor, JSON.stringify(p.haydovchilar), p.markaz[0], p.markaz[1], p.logo, p.orgName, p.joyNuqta?.[0], p.joyNuqta?.[1]]);

    // Bolalar.
    useEffect(() => {
        const L = (window as any).L;
        const q = qatlam.current;
        if (!L || !q) return;
        q.bola.clearLayers();
        // Bola kam bo'lsa (60 tagacha) uzoqdan ham rasmli marker — nuqta faqat ko'p bolada.
        const o: Olcham = olcham === 'kichik' && p.bolalar.length <= 60 ? 'orta' : olcham;
        // Rejasizlar pastda, tanlangani eng ustida.
        const tartib = [...p.bolalar].sort((a, b) => (a.holat === 'rejasiz' ? 0 : 1) - (b.holat === 'rejasiz' ? 0 : 1));
        for (const b of tartib) {
            const t = b.id === p.tanlangan;
            L.marker(b.pos, { icon: bolaIcon(L, b, t, o), zIndexOffset: t ? 3000 : b.holat === 'rejasiz' ? 0 : 100, keyboard: false, riseOnHover: true })
                .addTo(q.bola)
                .bindTooltip(esc(b.name), { direction: 'top', offset: [0, t ? -24 : -18] })
                .on('click', (e: any) => { L.DomEvent.stopPropagation(e); cb.current.onBola(b.id); });
        }
    }, [tayyor, p.bolalar, p.tanlangan, olcham]);

    // Ko'rinishni moslash.
    const moslandi = useRef('');
    useEffect(() => {
        const L = (window as any).L;
        const map = mapRef.current;
        if (!L || !map || !tayyor) return;
        if (moslandi.current === p.moslashKaliti) return;
        const nuqtalar = asosiyNuqtalar(p.markaz, p.bolalar.map(b => b.pos));
        moslandi.current = p.moslashKaliti;
        if (nuqtalar.length > 1) moslab(L.latLngBounds(nuqtalar).pad(0.12), 15, true);
        else map.setView(p.markaz, 13);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tayyor, p.moslashKaliti, p.bolalar.length]);

    const fokuslandi = useRef('');
    useEffect(() => {
        const L = (window as any).L;
        const map = mapRef.current;
        if (!L || !map || !tayyor || !p.fokus) return;
        if (fokuslandi.current === p.fokus.kalit) return;
        fokuslandi.current = p.fokus.kalit;
        const n = p.fokus.nuqtalar;
        if (n.length === 1) map.setView(n[0], Math.max(map.getZoom(), 15), { animate: true });
        else if (n.length > 1) moslab(L.latLngBounds(n).pad(0.2), 16, true);
    }, [tayyor, p.fokus]);

    return (
        <div className={`relative overflow-hidden bg-ichki ${p.className || ''} ${p.rejim !== 'oddiy' ? 'reja-xarita-tanlash' : ''}`}>
            <div ref={boxRef} className="absolute inset-0 z-10" />
            {xatolik && (
                <p className="absolute inset-0 z-20 flex items-center justify-center text-[12px] font-bold text-matn-xira px-8 text-center">{xatolik}</p>
            )}
            {p.children}
        </div>
    );
}
