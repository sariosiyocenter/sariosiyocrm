import React, { useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, SwitchCamera } from 'lucide-react';

interface PhotoCaptureProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
}

export default function PhotoCapture({ onCapture, onClose }: PhotoCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    /** Old yoki orqa kamera. Telefonda o'quvchini suratga olish uchun orqa kamera
     *  kerak bo'ladi, shuning uchun almashtirish tugmasi bor. */
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => {
        try {
            return localStorage.getItem('photo_camera') === 'environment' ? 'environment' : 'user';
        } catch {
            return 'user';
        }
    });

    const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
        try {
            setError(null);
            // Avvalgi oqim ochiq qolsa, ba'zi qurilmalar ikkinchi kamerani bermaydi.
            const previous = videoRef.current?.srcObject as MediaStream | null;
            previous?.getTracks().forEach(track => track.stop());

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            } else {
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error("Camera error:", err);
            setError("Kameraga ruxsat berilmagan yoki kamera topilmadi");
        }
    };

    const switchCamera = () => {
        const next = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(next);
        try { localStorage.setItem('photo_camera', next); } catch { /* private mode */ }
        startCamera(next);
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsStreaming(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    const handleConfirm = () => {
        if (capturedImage) {
            onCapture(capturedImage);
            onClose();
        }
    };

    const handleRetry = () => {
        setCapturedImage(null);
        startCamera();
    };

    React.useEffect(() => {
        startCamera();
        return () => stopCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col items-center">
                <div className="w-full p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Rasmga olish</h3>
                    <div className="flex items-center gap-1">
                        {!capturedImage && (
                            <button
                                onClick={switchCamera}
                                title={facingMode === 'user' ? "Orqa kameraga o'tish" : "Old kameraga o'tish"}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                <SwitchCamera className="w-5 h-5 text-slate-500" />
                                <span className="text-xs font-bold text-slate-500">{facingMode === 'user' ? 'Old' : 'Orqa'}</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="relative w-full aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                    {error ? (
                        <div className="text-center p-10">
                            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <p className="text-white font-bold">{error}</p>
                        </div>
                    ) : capturedImage ? (
                        <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                        />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="p-8 w-full flex items-center justify-center gap-4">
                    {!capturedImage ? (
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-[#5C67F2] rounded-full flex items-center justify-center shadow-2xl shadow-brand/40 hover:scale-110 active:scale-95 transition-all text-white"
                        >
                            <Camera className="w-8 h-8" />
                        </button>
                    ) : (
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={handleRetry}
                                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Qayta olish
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-4 bg-[#5C67F2] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-brand hover:bg-brand-dark transition-all"
                            >
                                <Check className="w-5 h-5" />
                                Tasdiqlash
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function XCircle({ className }: { className: string }) {
    return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
