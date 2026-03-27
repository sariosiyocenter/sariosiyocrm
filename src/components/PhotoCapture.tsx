import React, { useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, Image as ImageIcon } from 'lucide-react';

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

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            }
        } catch (err) {
            console.error("Camera error:", err);
            setError("Kameraga ruxsat berilmagan yoki kamera topilmadi");
        }
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
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col items-center">
                <div className="w-full p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Rasmga olish</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
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
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="p-8 w-full flex items-center justify-center gap-6">
                    {!capturedImage ? (
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-[#5C67F2] rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/40 hover:scale-110 active:scale-95 transition-all text-white"
                        >
                            <Camera className="w-8 h-8" />
                        </button>
                    ) : (
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={handleRetry}
                                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Qayta olish
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-4 bg-[#5C67F2] text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all"
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
