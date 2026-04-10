import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle, ArrowLeft, QrCode, Scan } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';

declare global {
    interface Window {
        cv: any;
    }
}

export default function Scanner() {
    const navigate = useNavigate();
    const { addExamResult, exams } = useCRM();
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [cvLoaded, setCvLoaded] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Load OpenCV.js
    useEffect(() => {
        if (!window.cv) {
            const script = document.createElement('script');
            script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
            script.async = true;
            script.onload = () => {
                const checkCv = setInterval(() => {
                    if (window.cv && window.cv.onRuntimeInitialized) {
                        window.cv.onRuntimeInitialized = () => {
                            setCvLoaded(true);
                            clearInterval(checkCv);
                        };
                    }
                }, 100);
            };
            document.body.appendChild(script);
        } else {
            setCvLoaded(true);
        }
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsScanning(true);
            setError(null);
        } catch (err) {
            setError("Kamera ruxsati berilmadi.");
        }
    };

    const processFrame = () => {
        if (!window.cv || !videoRef.current || !canvasRef.current) return;

        const cv = window.cv;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // --- OMR Logic Placeholder ---
        // 1. Detect timing marks using cv.findContours
        // 2. Warp perspective to get a flat sheet
        // 3. Scan bubble centers for density
        // -----------------------------

        // For now, let's simulate a success scan after 2 seconds
        setTimeout(() => {
            setResult({ studentId: "ID-123", variant: "V001", score: 25 });
            setIsScanning(false);
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col pt-safe animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-black/50 backdrop-blur-md border-b border-white/10 z-10">
                <button onClick={() => navigate('/exams')} className="text-white hover:bg-white/10 p-2 rounded-xl transition-all">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-white font-black uppercase tracking-widest text-xs">OMR Scanner Pro</h2>
                <div className="w-10"></div>
            </div>

            {/* Viewport */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                {!isScanning && !result && (
                    <div className="text-center p-12 space-y-8 animate-in zoom-in-95 duration-700">
                        <div className="w-24 h-24 bg-teal-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto ring-8 ring-teal-500/5">
                            <Camera className="w-10 h-10 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-xl uppercase tracking-widest mb-2">Skanerlashni boshlash</h3>
                            <p className="text-gray-400 text-xs uppercase font-bold tracking-tight">Varaqadagi burchak markazlariga e'tibor bering</p>
                        </div>
                        <button 
                            disabled={!cvLoaded}
                            onClick={startCamera}
                            className="px-12 py-4 bg-teal-600 disabled:bg-gray-800 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-teal-500/20 hover:scale-105 transition-all"
                        >
                            {cvLoaded ? 'Kamerani yoqish' : 'OpenCV yuklanmoqda...'}
                        </button>
                    </div>
                )}

                {isScanning && (
                    <div className="relative w-full h-full flex items-center justify-center">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" width={1080} height={1920} />
                        
                        {/* Overlay Guide */}
                        <div className="absolute inset-0 border-[64px] border-black/40 flex items-center justify-center">
                            <div className="w-full h-full border-2 border-teal-500/50 rounded-2xl relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-500 -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-500 -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-500 -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-500 -mb-1 -mr-1"></div>
                                
                                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-teal-500/20 animate-pulse"></div>
                            </div>
                        </div>

                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
                             <button 
                                onClick={processFrame}
                                className="w-20 h-20 bg-white/10 backdrop-blur-xl border-4 border-white rounded-full flex items-center justify-center active:scale-90 transition-all"
                            >
                                <div className="w-14 h-14 bg-white rounded-full"></div>
                            </button>
                            <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Timing marklarni moslang</p>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="absolute inset-0 bg-teal-600 z-50 flex flex-col items-center justify-center text-white p-12 animate-in slide-in-from-bottom duration-700">
                        <CheckCircle className="w-20 h-20 mb-8" />
                        <h4 className="text-2xl font-black uppercase tracking-widest mb-1">Muvaffaqiyatli!</h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-8">Natijalar tahlil qilindi</p>
                        
                        <div className="bg-white/10 rounded-[2rem] p-8 w-full space-y-6 mb-12 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-60">ID Raqami</span>
                                <span className="text-lg font-black tracking-tight">{result.studentId}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-60">Variant</span>
                                <span className="text-lg font-black tracking-tight">{result.variant}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-60">To'plangan Ball</span>
                                <span className="text-4xl font-black text-amber-400">{result.score}</span>
                            </div>
                        </div>

                        <div className="flex flex-col w-full gap-4">
                            <button 
                                onClick={() => setResult(null)}
                                className="w-full py-5 bg-white text-teal-600 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em]"
                            >
                                Keyingi varaqa
                            </button>
                            <button 
                                onClick={() => navigate('/exams')}
                                className="w-full py-5 bg-white/10 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em]"
                            >
                                Skanerni yopish
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {error && (
                <div className="absolute top-24 left-6 right-6 p-4 bg-rose-500/20 border border-rose-500/50 rounded-2xl flex items-center gap-3 backdrop-blur-md">
                    <AlertCircle className="text-rose-500" size={20} />
                    <p className="text-white text-xs font-bold uppercase tracking-tight">{error}</p>
                </div>
            )}
        </div>
    );
}
