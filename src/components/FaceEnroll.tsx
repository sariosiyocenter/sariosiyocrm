import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { X, Camera, CheckCircle, AlertCircle } from 'lucide-react';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

interface Props {
    studentName: string;
    onSave: (descriptor: number[]) => void;
    onClose: () => void;
}

export default function FaceEnroll({ studentName, onSave, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [phase, setPhase] = useState<'loading' | 'ready' | 'capturing' | 'success' | 'error'>('loading');
    const [msg, setMsg] = useState('Modellar yuklanmoqda...');

    useEffect(() => {
        const init = async () => {
            try {
                setMsg('Yuz aniqlash modeli...');
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                setMsg('Yuz belgilari modeli...');
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                setMsg('Yuz tanish modeli...');
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setPhase('ready');
                setMsg("Kameraga qarang va \"Yuzni saqlash\" tugmasini bosing");
            } catch (err: any) {
                const isCamera = err?.name === 'NotAllowedError' || err?.name === 'NotFoundError';
                setMsg(isCamera ? 'Kameraga ruxsat berilmagan.' : 'Model yuklab bo\'lmadi. Internet aloqasini tekshiring.');
                setPhase('error');
            }
        };
        init();
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const handleCapture = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        setPhase('capturing');
        setMsg('Yuz aniqlanmoqda...');

        try {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setPhase('ready');
                setMsg('Yuz topilmadi. To\'g\'ridan kameraga qarang.');
                return;
            }

            const descriptor = Array.from(detection.descriptor);
            streamRef.current?.getTracks().forEach(t => t.stop());
            setPhase('success');
            setMsg('Yuz muvaffaqiyatli saqlandi!');
            onSave(descriptor);
        } catch {
            setPhase('ready');
            setMsg('Xatolik yuz berdi. Qayta urinib ko\'ring.');
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-violet-600 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <Camera size={15} className="text-white" />
                        </div>
                        <div>
                            <p className="text-white text-sm font-black uppercase tracking-tight">Yuz ro'yxatdan o'tkazish</p>
                            <p className="text-violet-200 text-[9px] font-bold uppercase tracking-widest">{studentName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors cursor-pointer">
                        <X size={14} className="text-white" />
                    </button>
                </div>

                {/* Camera */}
                <div className="relative bg-black aspect-video">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    {/* Overlay face guide */}
                    {phase === 'ready' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-36 h-44 border-2 border-dashed border-white/50 rounded-[60px]" />
                        </div>
                    )}
                    {(phase === 'loading' || phase === 'capturing') && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mb-3" />
                        </div>
                    )}
                    {phase === 'success' && (
                        <div className="absolute inset-0 bg-emerald-500/80 flex flex-col items-center justify-center">
                            <CheckCircle size={40} className="text-white" />
                        </div>
                    )}
                </div>

                {/* Bottom */}
                <div className="p-5 space-y-4">
                    <div className="flex items-start gap-2">
                        {phase === 'error' && <AlertCircle size={14} className="text-rose-400 mt-0.5 shrink-0" />}
                        {phase === 'success' && <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />}
                        <p className={`text-xs font-bold ${phase === 'error' ? 'text-rose-500' : phase === 'success' ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {msg}
                        </p>
                    </div>

                    {phase === 'success' ? (
                        <button onClick={onClose} className="w-full py-3 rounded-2xl bg-emerald-500 text-white text-sm font-black uppercase tracking-wider cursor-pointer hover:bg-emerald-600 transition-colors">
                            Yopish
                        </button>
                    ) : (
                        <button
                            onClick={handleCapture}
                            disabled={phase !== 'ready'}
                            className="w-full py-3 rounded-2xl bg-violet-600 text-white text-sm font-black uppercase tracking-wider cursor-pointer hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Yuzni saqlash
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
