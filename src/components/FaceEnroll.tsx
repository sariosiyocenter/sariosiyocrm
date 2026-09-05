import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { X, Camera, SwitchCamera, RefreshCw } from 'lucide-react';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

interface Props {
    studentName: string;
    /** Yuz belgisi (128 ta son) va nazorat uchun olingan surat. */
    onEnroll: (descriptor: number[], photo: string) => Promise<void> | void;
    onClose: () => void;
}

/**
 * O'quvchini Face ID ga ro'yxatdan o'tkazish.
 *
 * Face ID yo'qlamasi o'quvchining customPrices.faceDescriptor maydonini o'qiydi,
 * lekin ilovada bu maydonni yozadigan joy yo'q edi — shuning uchun yo'qlama hech
 * kimni tanimasdi. Shu oyna o'sha bo'shliqni to'ldiradi.
 */
export default function FaceEnroll({ studentName, onEnroll, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [phase, setPhase] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
    const [message, setMessage] = useState('Modellar yuklanmoqda...');
    // Yuzni yaqindan olish uchun odatda orqa kamera qulay, shuning uchun tanlov
    // eslab qolinadi — Face ID yo'qlamasi bilan bir xil kalitda saqlanadi.
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => {
        try {
            return localStorage.getItem('faceid_camera') === 'environment' ? 'environment' : 'user';
        } catch {
            return 'user';
        }
    });

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setMessage('Yuz aniqlash modeli...');
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                setMessage('Yuz belgilari modeli...');
                await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
                setMessage('Yuz tanish modeli...');
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                if (cancelled) return;
                setMessage("Yuzni ramkaga to'g'rilang va tugmani bosing");
                setPhase('ready');
            } catch {
                if (cancelled) return;
                setMessage("Model yuklab bo'lmadi. Internet aloqasini tekshiring.");
                setPhase('error');
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const modelsReady = phase !== 'loading' && phase !== 'error';

    useEffect(() => {
        if (!modelsReady) return;
        let cancelled = false;
        const start = async () => {
            try {
                streamRef.current?.getTracks().forEach(t => t.stop());
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                if (cancelled) return;
                setMessage('Kameraga ruxsat berilmagan.');
                setPhase('error');
            }
        };
        start();
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, [facingMode, modelsReady]);

    const toggleCamera = () => {
        setFacingMode(prev => {
            const next = prev === 'user' ? 'environment' : 'user';
            try { localStorage.setItem('faceid_camera', next); } catch { /* private mode */ }
            return next;
        });
    };

    const capture = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        setPhase('saving');
        setMessage('Yuz tekshirilmoqda...');
        try {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
                .withFaceLandmarks(true)
                .withFaceDescriptors();

            if (detections.length === 0) {
                setMessage("Yuz topilmadi. Yorug'roq joyda, kameraga qarab qayta urinib ko'ring.");
                setPhase('ready');
                return;
            }
            if (detections.length > 1) {
                setMessage("Kadrda bir nechta yuz bor. Faqat o'quvchi ko'rinsin.");
                setPhase('ready');
                return;
            }

            // Nazorat surati: profilda kimning yuzi yozilgani ko'rinib tursin.
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const photo = canvas.toDataURL('image/jpeg', 0.85);

            await onEnroll(Array.from(detections[0].descriptor), photo);
            onClose();
        } catch (err) {
            console.error('Face enroll failed', err);
            setMessage('Saqlashda xatolik yuz berdi.');
            setPhase('ready');
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-gray-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-sirt rounded-[2rem] border border-chiziq w-full max-w-xl overflow-hidden shadow-2xl">
                <div className="px-5 py-4 border-b border-chiziq flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-matn tracking-tight">Face ID ro'yxatdan o'tkazish</h3>
                        <p className="text-[11px] font-bold text-matn-xira truncate">{studentName}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {phase !== 'error' && (
                            <button
                                onClick={toggleCamera}
                                title={facingMode === 'user' ? "Orqa kameraga o'tish" : "Old kameraga o'tish"}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-ichki transition-colors cursor-pointer"
                            >
                                <SwitchCamera size={15} className="text-matn-xira" />
                                <span className="text-[11px] font-bold text-matn-xira">{facingMode === 'user' ? 'Old' : 'Orqa'}</span>
                            </button>
                        )}
                        <button onClick={onClose} aria-label="Yopish"
                            className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="relative w-full aspect-video bg-gray-950 flex items-center justify-center overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                    />
                    {phase === 'loading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80">
                            <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-white text-xs font-bold">{message}</p>
                        </div>
                    )}
                    {phase === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 px-8">
                            <p className="text-rose-400 text-xs font-bold text-center">{message}</p>
                        </div>
                    )}
                </div>

                <div className="p-5 space-y-3">
                    {modelsReady && (
                        <p className="text-[11px] font-bold text-matn-xira text-center">{message}</p>
                    )}
                    <button
                        onClick={capture}
                        disabled={phase !== 'ready'}
                        className="w-full py-3.5 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        {phase === 'saving' ? <RefreshCw size={15} className="animate-spin" /> : <Camera size={15} />}
                        {phase === 'saving' ? 'Tekshirilmoqda…' : 'Yuzni saqlash'}
                    </button>
                </div>
            </div>
        </div>
    );
}
