/**
 * Xarita markerlari — o'quvchi profilida ham, marshrut xaritasida ham
 * bir xil ko'rinsin deb bitta joyda.
 *
 * Leaflet ikonkasi oddiy HTML bo'lgani uchun marker ichiga portret ham,
 * markaz logosi ham qo'yiladi.
 */

/**
 * Markaz nuqtasi Sozlamalarda belgilanmagan bo'lsa shu ishlatiladi — bot
 * "Geolokatsiya" tugmasida ota-onalarga aynan shu nuqtani yuboradi.
 * Taxminiy: tuman markazi, bino emas.
 */
export const ZAXIRA_MARKAZ: [number, number] = [38.4833, 67.9333];

/** Brend rangi (o'quvchi markeri) va markaz markerining rangi. */
export const RANG_OQUVCHI = '#1b6b6b';
export const RANG_MARKAZ = '#0ea5e9';

/** "38.47,67.95" → [38.47, 67.95]; noto'g'ri qiymat uchun null. */
export function parseLatLng(value?: string | null): [number, number] | null {
    if (!value || !value.includes(',')) return null;
    const [lat, lng] = value.split(',').map(Number);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return [lat, lng];
}

/** Ikki nuqta orasidagi masofa, km (haversine). */
export function distanceKm(a: [number, number], b: [number, number]): number {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLng = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Masofani odam o'qiydigan ko'rinishda: 850 m / 3.2 km. */
export function masofaMatni(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Marker HTML ichiga tushadigan matn — ism ham, rasm manzili ham. */
export function esc(text: string): string {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Ism-familiyadan ikki harfli bosh harf: rasm bo'lmasa shu chiqadi. */
export function initials(name: string): string {
    return String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

export interface AvatarIconOpts {
    image?: string;
    fallback: string;
    ring: string;
    /** Logo uchun: oq fon va rasm to'liq sig'sin. */
    white?: boolean;
    /** Bekat raqami — marshrut xaritasida tartibni ko'rsatadi. */
    badge?: string | number;
    /** Kichikroq marker: bekatlar ko'p bo'lsa xarita to'lib ketmasin. */
    size?: number;
}

/**
 * Dumaloq rasmli marker. `L` — global Leaflet (index.html dan yuklanadi).
 */
export function avatarIcon(L: any, opts: AvatarIconOpts) {
    const size = opts.size || 54;
    const inner = opts.image
        ? `<img src="${esc(opts.image)}" alt="" style="width:100%;height:100%;object-fit:${opts.white ? 'contain' : 'cover'};${opts.white ? 'padding:5px;' : ''}display:block" />`
        : `<span style="font:700 ${Math.round(size / 3.6)}px/1 system-ui,sans-serif;color:${opts.ring}">${esc(opts.fallback)}</span>`;

    const badge = opts.badge === undefined || opts.badge === null ? '' : `
            <div style="position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;
                        border-radius:10px;background:${opts.ring};color:#fff;border:2px solid #fff;
                        font:800 11px/16px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(15,23,42,.35)">
              ${esc(String(opts.badge))}
            </div>`;

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
            ${badge}
          </div>`,
    });
}
