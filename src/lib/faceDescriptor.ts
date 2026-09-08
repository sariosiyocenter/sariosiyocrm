import * as faceapi from 'face-api.js';

/**
 * Profil rasmidan Face ID belgisini (128 ta son) chiqarish.
 *
 * Face ID uchun alohida suratga tushish yo'q: belgi o'quvchining profil
 * rasmidan olinadi. Rasm almashtirilsa belgi ham qayta hisoblanadi, shunda
 * yo'qlama har doim eng oxirgi rasmga qarab ishlaydi.
 *
 * Hisob brauzerda bajariladi — serverda yuz tanish kutubxonasi yo'q.
 */

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

/**
 * Detektor o'lchami. 320 da yuz tez-tez topilmasdi — ekranni to'ldirib turgan
 * yuz ham "yo'q" chiqardi; 416 da o'sha rasm 0.9 ishonch bilan topiladi.
 */
export const FACE_INPUT_SIZE = 416;

let modelsPromise: Promise<void> | null = null;
let ssdPromise: Promise<void> | null = null;

/** Modellarni bir marta yuklaydi (takroriy chaqiruvlar o'sha va'dani kutadi). */
export function loadFaceModels(onStep?: (msg: string) => void): Promise<void> {
    if (!modelsPromise) {
        modelsPromise = (async () => {
            onStep?.('Yuz aniqlash modeli…');
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            onStep?.('Yuz belgilari modeli…');
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
            onStep?.('Yuz tanish modeli…');
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        })().catch(err => { modelsPromise = null; throw err; });
    }
    return modelsPromise;
}

/**
 * Kuchliroq (va og'irroq) detektor — faqat tiny detektor yuzni topa olmaganda.
 *
 * Tiny detektor tez, lekin rasmda yuz kichik bo'lsa yoki bosh biroz burilgan
 * bo'lsa uni o'tkazib yuboradi: profil rasmida yuz aniq ko'rinib turgani
 * holda ham "yuz topilmadi" chiqardi. SSD MobileNet o'sha rasmlarni topadi.
 * Vazni ~5 MB, shuning uchun oldindan emas, kerak bo'lganda va bir marta
 * yuklanadi.
 */
function loadSsd(): Promise<void> {
    if (!ssdPromise) {
        ssdPromise = faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
            .catch(err => { ssdPromise = null; throw err; });
    }
    return ssdPromise;
}

export type FaceFail = 'topilmadi' | 'kop' | 'rasm';

/**
 * Shu seansda qaysi (o'quvchi, rasm) juftligi uchun urinib ko'rilgan.
 *
 * Rasmida yuz aniqlanmaydigan o'quvchi bor — ularni har safar (profil ochilganda
 * ham, yo'qlama ochilganda ham) qaytadan hisoblab o'tirish behuda vaqt.
 */
const tried = new Map<string, boolean>();

const triedKey = (studentId: number, photo: string) => studentId + ':' + photo;

/** Shu rasm bo'yicha urinib ko'rilgan va yuz topilmaganmi. */
export function faceFailedBefore(studentId: number, photo: string): boolean {
    return tried.get(triedKey(studentId, photo)) === false;
}

export function rememberFaceTry(studentId: number, photo: string, ok: boolean): void {
    tried.set(triedKey(studentId, photo), ok);
}

/** Xodim "qayta urinish" bosganda: kesh o'chadi, rasm boshqatdan tekshiriladi. */
export function forgetFaceTry(studentId: number, photo: string): void {
    tried.delete(triedKey(studentId, photo));
}

/** `descriptor` bo'lsa — topildi; aks holda `reason` sababni aytadi. */
export interface FaceResult {
    descriptor?: number[];
    reason?: FaceFail;
}

/** Sabab matni — foydalanuvchiga ko'rsatish uchun. */
export function faceFailText(reason: FaceFail): string {
    return reason === 'topilmadi' ? 'rasmda yuz topilmadi'
        : reason === 'kop' ? 'rasmda bir nechta yuz bor'
            : 'rasm ochilmadi';
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Rasm boshqa domendan (Supabase) keladi: CORS ruxsatisiz kanvas
        // "iflos" bo'lib qoladi va yuz belgisini o'qib bo'lmaydi.
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('rasm ochilmadi'));
        img.src = src;
        setTimeout(() => reject(new Error('rasm juda sekin')), 20000);
    });
}

/**
 * Aniqlash urinishlari ketma-ketligi.
 *
 * Bitta sozlama hamma rasmga to'g'ri kelmaydi: 416 katta yuzni yaxshi topadi,
 * 608 esa kadrning kichik qismini egallagan yuzni. Chegara ham pasayib boradi —
 * oxirgi urinishda "bo'lsa bo'ldi" deb qaraladi, chunki muqobili baribir
 * "yuz topilmadi".
 */
const TINY_TRIES: { inputSize: number; scoreThreshold: number }[] = [
    { inputSize: FACE_INPUT_SIZE, scoreThreshold: 0.5 },
    { inputSize: 608, scoreThreshold: 0.4 },
    { inputSize: 320, scoreThreshold: 0.3 },
];

/**
 * Bir nechta yuz topilganda qaysi biri o'quvchi ekanini tanlaydi.
 *
 * Profil rasmida odatda bitta odam bo'ladi, lekin orqa fonda tasodifiy yuz
 * (devordagi surat, yonidagi odam) ham topilishi mumkin. Agar eng katta yuz
 * ikkinchisidan ikki barobar katta bo'lsa — o'quvchi o'sha, chunki suratga
 * aynan u tushgan. Aks holda taxmin qilmaymiz: noto'g'ri yuz yozib qo'yilsa
 * yo'qlama boshqa bolani belgilab yuboradi.
 */
function pickMain<T extends { detection: { box: { width: number; height: number } } }>(found: T[]): T | null {
    if (found.length === 1) return found[0];
    const byArea = [...found].sort((a, b) =>
        (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height));
    const first = byArea[0].detection.box.width * byArea[0].detection.box.height;
    const second = byArea[1].detection.box.width * byArea[1].detection.box.height;
    return first >= second * 2 ? byArea[0] : null;
}

/** Rasmdagi asosiy yuzning belgisi. Modellar oldindan yuklangan bo'lishi kerak. */
export async function descriptorFromPhoto(src: string): Promise<FaceResult> {
    let img: HTMLImageElement;
    try {
        img = await loadImage(src);
    } catch {
        return { reason: 'rasm' };
    }
    try {
        let tooMany = false;

        for (const opts of TINY_TRIES) {
            const found = await faceapi
                .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions(opts))
                .withFaceLandmarks(true)
                .withFaceDescriptors();
            if (found.length === 0) continue;
            const main = pickMain(found);
            if (main) return { descriptor: Array.from(main.descriptor) };
            tooMany = true;
        }

        // Tiny detektor topa olmadi — kuchliroq modelga o'tamiz.
        try {
            await loadSsd();
            const found = await faceapi
                .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
                .withFaceLandmarks(true)
                .withFaceDescriptors();
            if (found.length > 0) {
                const main = pickMain(found);
                if (main) return { descriptor: Array.from(main.descriptor) };
                tooMany = true;
            }
        } catch { /* og'ir model yuklanmadi — tiny natijasi bilan qolamiz */ }

        return { reason: tooMany ? 'kop' : 'topilmadi' };
    } catch {
        return { reason: 'rasm' };
    }
}

/** Belgini serverga yozish. */
export async function saveFaceProfiles(
    schoolId: number,
    profiles: { studentId: number; descriptor: number[] }[],
): Promise<number> {
    if (!profiles.length) return 0;
    const r = await fetch('/api/face-profiles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, profiles: profiles.map(p => ({ ...p, source: 'rasm' })) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Saqlab bo'lmadi");
    return j.saved || 0;
}
