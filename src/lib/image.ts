/**
 * Client-side image compression utility.
 * Resizes and compresses any image base64 data URL to an optimized maximum width and height
 * to drastically reduce upload payloads, database footprints, and background removal processing times.
 */
/**
 * Profil suratlari uchun o'lcham va sifat.
 *
 * Ro'yxatdagi 28px avatar uchun 640px yetarli edi, lekin profil sahifasida surat
 * endi kattaroq ko'rsatiladi va 0.75 sifatdagi 640px siqilish artefaktlari
 * ko'zga tashlanardi. Bu suratlar Supabase'ga fayl bo'lib yuklanadi (data URL
 * emas), shuning uchun kattaroq o'lcham /api/init javobini og'irlashtirmaydi.
 */
export const PROFILE_PHOTO = { maxWidth: 900, maxHeight: 900, quality: 0.9 };

export function compressImage(base64Str: string, maxWidth = 640, maxHeight = 640, quality = 0.75): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                // Fonsiz (shaffof) rasm JPEG ga aylantirilsa foni qora bo'lib
                // qolardi. PNG/WebP manba shaffofligi bilan saqlanadi.
                resolve(hasAlphaSource(base64Str)
                    ? exportWithAlpha(canvas, quality)
                    // 0.75 quality is the sweet spot: perfect look, 10-50x smaller size
                    : canvas.toDataURL('image/jpeg', quality));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
    });
}

/** Profil surati: kattaroq o'lcham, yuqori sifat, fayl bo'lib saqlanadi. */
export function uploadProfilePhoto(base64Str: string, filename = 'photo.jpg'): Promise<string> {
    return compressAndUpload(base64Str, filename, PROFILE_PHOTO.maxWidth, PROFILE_PHOTO.maxHeight, PROFILE_PHOTO.quality);
}

/**
 * Compresses an image and stores it in Supabase Storage, returning its public URL.
 *
 * Prefer this over keeping the data URL. A base64 image saved straight into a row
 * travels inside every /api/init response for every user on every app load — three
 * such images once accounted for 829 KB of a 1215 KB payload. A URL costs ~100 bytes
 * and the browser caches the file itself.
 *
 * Falls back to the compressed data URL if the upload fails, so a save never blocks
 * on the network.
 */
export async function compressAndUpload(
    base64Str: string,
    filename = 'image.jpg',
    maxWidth = 640,
    maxHeight = 640,
    quality = 0.75
): Promise<string> {
    const compressed = await compressImage(base64Str, maxWidth, maxHeight, quality);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ data: compressed, filename }),
        });
        if (!res.ok) return compressed;
        const { url } = await res.json();
        return url || compressed;
    } catch {
        return compressed;
    }
}

/** Manba shaffof bo'lishi mumkinmi (PNG / WebP). JPEG da shaffoflik yo'q. */
function hasAlphaSource(src: string): boolean {
    return /^data:image\/(png|webp)/i.test(src);
}

/**
 * Shaffoflikni saqlaydigan format: WebP (kichik, sifatli), brauzer WebP yoza
 * olmasa (Safari) — PNG.
 */
function exportWithAlpha(canvas: HTMLCanvasElement, quality = 0.95): string {
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

/** Rasmni yuklaydi. Storage havolasi CORS bilan — canvasdan piksel o'qish uchun. */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Rasm ochilmadi'));
        img.src = src;
    });
}

function fitSize(w: number, h: number, max: number): [number, number] {
    const k = Math.min(1, max / Math.max(w, h));
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/** Modelga yuboriladigan nusxaning o'lchami: BRIA baribir 1024 da ishlaydi. */
const BG_MODEL_SIZE = 1024;
/** Natijaning eng katta tomoni — profil suratidan (900) biroz katta. */
const BG_RESULT_SIZE = 1200;

/**
 * Fonni tozalaydi va rasm sifatini saqlaydi.
 *
 * Ilgari xizmat qaytargan rasm o'zi saqlanardi: u modelga yuborilgan nusxadan
 * olingan (ochiq formada 640px, 0.75 sifatli JPEG), keyin yana siqilardi —
 * natijada yuz xiralashardi. Endi modeldan faqat NIQOB (qaysi piksel odam,
 * qaysisi fon) olinadi va u ASL rasmning o'z piksellariga qo'yiladi: rang va
 * aniqlik aslidagidek qoladi, faqat fon shaffof bo'ladi.
 *
 * `src` — data URL yoki Storage havolasi. Qaytaradi: shaffof WebP/PNG data URL.
 */
export async function removeBackgroundHQ(src: string, endpoint = '/api/utils/remove-bg'): Promise<string> {
    const asl = await loadImage(src);
    const w = asl.naturalWidth, h = asl.naturalHeight;

    // 1. Modelga — har doim data URL (server havolani o'qiy olmasdi).
    const [mw, mh] = fitSize(w, h, BG_MODEL_SIZE);
    const kirish = document.createElement('canvas');
    kirish.width = mw; kirish.height = mh;
    const kx = kirish.getContext('2d')!;
    kx.imageSmoothingQuality = 'high';
    kx.drawImage(asl, 0, 0, mw, mh);

    const token = localStorage.getItem('token');
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image: kirish.toDataURL('image/jpeg', 0.95) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.image) {
        throw new Error(data.error || "Fonni tozalab bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
    }

    // 2. Niqobni asl rasmga ko'chiramiz.
    try {
        const kesilgan = await loadImage(data.image);
        const [ow, oh] = fitSize(w, h, BG_RESULT_SIZE);

        const natija = document.createElement('canvas');
        natija.width = ow; natija.height = oh;
        const nx = natija.getContext('2d')!;
        nx.imageSmoothingQuality = 'high';
        nx.drawImage(asl, 0, 0, ow, oh);
        const piksel = nx.getImageData(0, 0, ow, oh);

        const niqob = document.createElement('canvas');
        niqob.width = ow; niqob.height = oh;
        const qx = niqob.getContext('2d')!;
        qx.imageSmoothingQuality = 'high';
        qx.drawImage(kesilgan, 0, 0, ow, oh);
        const alfa = qx.getImageData(0, 0, ow, oh).data;

        for (let i = 3; i < piksel.data.length; i += 4) piksel.data[i] = alfa[i];
        nx.putImageData(piksel, 0, 0);
        return exportWithAlpha(natija, 0.95);
    } catch {
        // Canvas o'qib bo'lmasa (CORS) — xizmatning o'z natijasi.
        return data.image;
    }
}
