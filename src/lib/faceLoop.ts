/**
 * Face ID kamera sikli — yo'qlama (FaceAttendance) va qidiruv (FaceSearch) uchun.
 *
 * Egasi (2026-09-26): "face id davomatda 15 tadan keyin taxminan chiqib
 * ketayapti", "android telefon brauzerida faceid responsiveligi yaxshimas".
 * Sabab: tekshiruv setInterval(250 ms) bilan ishga tushardi, telefonda esa
 * bitta tekshiruv (yuz topish + belgilar + tanish) 0.5–2 soniya oladi.
 * Tekshiruvlar ustma-ust to'planib, har biri WebGL xotirasini egallardi —
 * bir necha daqiqadan keyin brauzer sahifani yopib yuborardi, oraliqda esa
 * ekran qotib qolardi. Endi keyingi tekshiruv oldingisi TUGAGANDAN keyin
 * boshlanadi; sahifa ko'rinmayotganda (ekran o'chgan) umuman ishlamaydi.
 */

/** @returns to'xtatish funksiyasi */
export function ketmaKetTekshir(fn: () => Promise<void>, oraliqMs = 300): () => void {
    let toxta = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const aylanish = async () => {
        if (toxta) return;
        const boshi = performance.now();
        if (!document.hidden) {
            try {
                await fn();
            } catch (e) {
                // Bitta kadr xatosi (masalan, kamera almashayotganda) siklni to'xtatmasin.
                console.warn('[Face ID]', e);
            }
        }
        if (toxta) return;
        timer = setTimeout(aylanish, Math.max(100, oraliqMs - (performance.now() - boshi)));
    };
    timer = setTimeout(aylanish, oraliqMs);
    return () => {
        toxta = true;
        if (timer) clearTimeout(timer);
    };
}

/**
 * Kamera o'lchami. Detektor baribir 416 px ga kichraytiradi — 1280×720 kadr
 * har tekshiruvda telefon GPU siga 3 barobar ko'p ma'lumot yuklardi, foydasiz.
 */
export const KAMERA_OLCHAMI = { width: { ideal: 640 }, height: { ideal: 480 } };

/** Kanvas o'lchami faqat o'zgarganda — har kadrda qayta ajratilmasin. */
export function kanvasniMoslash(canvas: HTMLCanvasElement, w: number, h: number) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
}
