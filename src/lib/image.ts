/**
 * Client-side image compression utility.
 * Resizes and compresses any image base64 data URL to an optimized maximum width and height
 * to drastically reduce upload payloads, database footprints, and background removal processing times.
 */
export function compressImage(base64Str: string, maxWidth = 640, maxHeight = 640): Promise<string> {
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
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
    });
}
