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
                ctx.drawImage(img, 0, 0, width, height);
                // 0.75 quality is the sweet spot: perfect look, 10-50x smaller size
                resolve(canvas.toDataURL('image/jpeg', quality));
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
