import React, { useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, SwitchCamera } from 'lucide-react';

interface PhotoCaptureProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
}

/** Ko'rinish oynasi va saqlanadigan rasm nisbati: portret 3:4. */
const FRAME_RATIO = 3 / 4;

/**
 * Yuz siluetining shakli (viewBox 300×400 — oynaning o'zi). Bosh ovali yuqori
 * o'rtada: kvadrat avatar ham shu qismni kesib oladi, Face ID esa yuz rasmning
 * yarmiga yaqinini egallaganda eng ishonchli topadi.
 */
const HEAD = { cx: 150, cy: 150, rx: 72, ry: 92 };
// Bo'yin va yelkalar: to'ldirilgani — xiralashtirishdan kesib olinadi (bo'yin
// tepasi bosh ovalining ichiga kiradi), chiziqlari — faqat tashqi kontur.
const BODY = 'M 16 400 C 20 336 68 312 114 302 C 125 299 128 290 128 280 L 128 226 L 172 226 L 172 280 C 172 290 175 299 186 302 C 232 312 280 336 284 400 Z';
const BODY_LEFT = 'M 16 400 C 20 336 68 312 114 302 C 125 299 128 290 128 280 L 128 238';
const BODY_RIGHT = 'M 172 238 L 172 280 C 172 290 175 299 186 302 C 232 312 280 336 284 400';

function FaceGuide() {
    return (
        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <defs>
                <mask id="photo-face-cutout">
                    <rect width="300" height="400" fill="white" />
                    <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} fill="black" />
                    <path d={BODY} fill="black" />
                </mask>
            </defs>
            {/* Siluetdan tashqarisi xiralashadi — yuzni qayerga qo'yish darhol ko'rinadi. */}
            <rect width="300" height="400" fill="rgba(15,23,42,0.55)" mask="url(#photo-face-cutout)" />
            <g fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round">
                <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} vectorEffect="non-scaling-stroke" />
                <path d={BODY_LEFT} vectorEffect="non-scaling-stroke" />
                <path d={BODY_RIGHT} vectorEffect="non-scaling-stroke" />
            </g>
        </svg>
    );
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

    // Oynada ko'ringan qism aynan saqlanadi. Ilgari kameraning butun kadri
    // (keng, yon tomonlari bilan) olinardi va yuz rasmda kichkina chiqardi.
    // Endi 3:4 portret markazdan kesiladi — siluetga joylashgan yuz rasmning
    // ham markazida turadi.
    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        let sw = vw, sh = vh;
        if (vw / vh > FRAME_RATIO) sw = Math.round(vh * FRAME_RATIO);
        else sh = Math.round(vw / FRAME_RATIO);
        const sx = Math.round((vw - sw) / 2);
        const sy = Math.round((vh - sh) / 2);

        canvas.width = sw;
        canvas.height = sh;
        context.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
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
            <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-full overflow-y-auto shadow-2xl flex flex-col items-center">
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

                <div className="w-full bg-slate-900 flex justify-center">
                    {/* Portret oyna: balandligi ekranga sig'adi, eni nisbatdan chiqadi. */}
                    <div className="relative aspect-[3/4] overflow-hidden" style={{ width: 'min(100%, calc(60vh * 0.75))' }}>
                        {error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10">
                                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                                <p className="text-white font-bold">{error}</p>
                            </div>
                        ) : capturedImage ? (
                            <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover" alt="Olingan rasm" />
                        ) : (
                            <>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="absolute inset-0 w-full h-full object-cover"
                                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                                />
                                <FaceGuide />
                                <p className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-900/70 text-white text-[11px] font-bold">
                                    Yuzni ramka ichiga joylashtiring
                                </p>
                            </>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                </div>

                <div className="p-6 w-full flex items-center justify-center gap-4">
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
