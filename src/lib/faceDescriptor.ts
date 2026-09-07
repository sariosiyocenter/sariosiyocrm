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

/** Rasmdagi yagona yuzning belgisi. Modellar oldindan yuklangan bo'lishi kerak. */
export async function descriptorFromPhoto(src: string): Promise<FaceResult> {
    let img: HTMLImageElement;
    try {
        img = await loadImage(src);
    } catch {
        return { reason: 'rasm' };
    }
    try {
        const found = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_INPUT_SIZE, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptors();

        if (found.length === 0) return { reason: 'topilmadi' };
        // Ikki kishilik rasmda kim kimligini aytib bo'lmaydi — taxmin qilmaymiz.
        if (found.length > 1) return { reason: 'kop' };
        return { descriptor: Array.from(found[0].descriptor) };
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
