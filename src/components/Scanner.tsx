import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle, AlertCircle, ArrowLeft, QrCode, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import jsQR from 'jsqr';

type ScanStep = 'idle' | 'qr_scanning' | 'manual_entry' | 'saving' | 'done';

interface ScanContext {
    examId: number;
    studentId: number;
    variantCode: string;
    studentName: string;
    examName: string;
    variantQuestions: { order: number; correctOption: string }[];
    maxScore: number;
}

export default function Scanner() {
    const navigate = useNavigate();
    const { addExamResult, exams, students, selectedSchoolId } = useCRM();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);

    const [step, setStep] = useState<ScanStep>('idle');
    const [scanCtx, setScanCtx] = useState<ScanContext | null>(null);
    const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D' | null>>({});
    const [savedResult, setSavedResult] = useState<{ score: number; percentage: number; studentName: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => () => stopCamera(), [stopCamera]);

    const startQRScan = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setStep('qr_scanning');
            scanLoop();
        } catch {
            setError("Kamera ruxsati berilmadi. Brauzer sozlamalarini tekshiring.");
        }
    };

    const scanLoop = () => {
        const scan = () => {
            if (!videoRef.current || !canvasRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video.readyState !== video.HAVE_ENOUGH_DATA) {
                animFrameRef.current = requestAnimationFrame(scan);
                return;
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
            if (code) {
                handleQRDetected(code.data);
                return; // stop loop after detection
            }
            animFrameRef.current = requestAnimationFrame(scan);
        };
        animFrameRef.current = requestAnimationFrame(scan);
    };

    const handleQRDetected = (data: string) => {
        stopCamera();
        try {
            const parsed = JSON.parse(data);
            const { e: examId, s: studentId, v: variantCode } = parsed;

            const exam = exams.find(ex => ex.id === examId);
            const student = students.find(st => st.id === studentId);

            if (!exam) { setError(`Imtihon (ID: ${examId}) topilmadi`); setStep('idle'); return; }
            if (!student) { setError(`O'quvchi (ID: ${studentId}) topilmadi`); setStep('idle'); return; }

            const variant = exam.variants?.find(v => v.variantCode === variantCode);
            if (!variant) { setError(`Variant ${variantCode} topilmadi`); setStep('idle'); return; }

            const initAnswers: Record<number, 'A' | 'B' | 'C' | 'D' | null> = {};
            variant.questions.forEach((_: any, idx: number) => { initAnswers[idx + 1] = null; });
            setAnswers(initAnswers);

            setScanCtx({
                examId, studentId, variantCode,
                studentName: student.name,
                examName: exam.name,
                variantQuestions: variant.questions.map((q: any, idx: number) => ({
                    order: idx + 1,
                    correctOption: q.correctOption
                })),
                maxScore: exam.maxScore
            });
            setStep('manual_entry');
        } catch {
            setError("QR kod o'qishda xatolik. Boshqa kod emasmi?");
            setStep('idle');
        }
    };

    const submitAnswers = async () => {
        if (!scanCtx || !selectedSchoolId) return;
        setStep('saving');
        try {
            const saved = await addExamResult({
                studentId: scanCtx.studentId,
                examId: scanCtx.examId,
                variantCode: scanCtx.variantCode,
                answers,
                score: 0,
                percentage: 0,
            } as any);
            setSavedResult({
                score: saved.score,
                percentage: saved.percentage,
                studentName: scanCtx.studentName
            });
            setStep('done');
        } catch (err: any) {
            setError("Natijani saqlashda xatolik: " + err.message);
            setStep('manual_entry');
        }
    };

    const resetScanner = () => {
        setScanCtx(null);
        setAnswers({});
        setSavedResult(null);
        setError(null);
        setStep('idle');
    };

    const allAnswered = scanCtx && Object.values(answers).every(a => a !== null);

    return (
        <div className="fixed inset-0 z-[300] bg-gray-950 flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between p-5 bg-black/50 backdrop-blur-md border-b border-white/10">
                <button onClick={() => { stopCamera(); navigate('/exams'); }} className="text-white hover:bg-white/10 p-2 rounded-xl transition-all">
                    <ArrowLeft size={22} />
                </button>
                <h2 className="text-white font-black uppercase tracking-widest text-xs">Natija Skaneri</h2>
                <div className="w-10" />
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center gap-3">
                    <AlertCircle className="text-rose-400 shrink-0" size={18} />
                    <p className="text-rose-300 text-xs font-bold">{error}</p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">

                {/* STEP: IDLE */}
                {step === 'idle' && (
                    <div className="flex flex-col items-center justify-center h-full p-12 space-y-8 text-center">
                        <div className="w-24 h-24 bg-teal-500/20 rounded-[2.5rem] flex items-center justify-center ring-8 ring-teal-500/5">
                            <QrCode className="w-10 h-10 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-xl uppercase tracking-widest mb-2">Javob Varaqasini Skaner Qilish</h3>
                            <p className="text-gray-400 text-xs uppercase font-bold tracking-tight max-w-xs mx-auto">
                                Varaqadagi QR kodni kameraga ko'rsating. Sistema o'quvchi va variantni avtomatik aniqlaydi.
                            </p>
                        </div>
                        <button
                            onClick={startQRScan}
                            className="px-12 py-4 bg-teal-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-teal-500/20 hover:bg-teal-500 transition-all"
                        >
                            Kamerani Yoqish
                        </button>
                    </div>
                )}

                {/* STEP: QR SCANNING */}
                {step === 'qr_scanning' && (
                    <div className="relative w-full h-full min-h-[60vh] flex items-center justify-center bg-black">
                        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        {/* Scanner overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 relative">
                                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />
                                <div className="absolute top-1/2 w-full h-0.5 bg-teal-500/60 animate-pulse" />
                            </div>
                        </div>
                        <p className="absolute bottom-8 text-[10px] font-black text-white/60 uppercase tracking-widest">QR kodni ramkaga joylang</p>
                    </div>
                )}

                {/* STEP: MANUAL ENTRY */}
                {step === 'manual_entry' && scanCtx && (
                    <div className="p-5 space-y-5">
                        {/* Student info card */}
                        <div className="bg-teal-900/30 border border-teal-700/50 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
                                {scanCtx.studentName[0]}
                            </div>
                            <div>
                                <p className="text-white font-black text-sm">{scanCtx.studentName}</p>
                                <p className="text-teal-400 text-[10px] font-bold uppercase tracking-widest">
                                    {scanCtx.examName} · Variant {scanCtx.variantCode}
                                </p>
                            </div>
                        </div>

                        {/* Bubble grid */}
                        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                            <div className="grid grid-cols-5 bg-gray-800/50 px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                <span>#</span><span className="text-center">A</span><span className="text-center">B</span><span className="text-center">C</span><span className="text-center">D</span>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-800/50">
                                {scanCtx.variantQuestions.map(({ order }) => (
                                    <div key={order} className="grid grid-cols-5 items-center px-4 py-2.5">
                                        <span className="text-gray-500 font-black text-xs">{order}</span>
                                        {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => setAnswers(prev => ({ ...prev, [order]: opt }))}
                                                className={`mx-auto w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all ${
                                                    answers[order] === opt
                                                        ? 'bg-teal-500 border-teal-400 text-white scale-110'
                                                        : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Progress */}
                        <p className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            {Object.values(answers).filter(Boolean).length} / {scanCtx.variantQuestions.length} javob berildi
                        </p>

                        <button
                            onClick={submitAnswers}
                            disabled={!allAnswered}
                            className="w-full py-4 bg-teal-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            Natijani Saqlash <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* STEP: SAVING */}
                {step === 'saving' && (
                    <div className="flex flex-col items-center justify-center h-full p-12 space-y-6 text-center">
                        <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center animate-pulse">
                            <QrCode className="w-8 h-8 text-teal-400" />
                        </div>
                        <p className="text-white font-black uppercase tracking-widest text-sm">Saqlanmoqda...</p>
                    </div>
                )}

                {/* STEP: DONE */}
                {step === 'done' && savedResult && (
                    <div className="flex flex-col items-center justify-center h-full p-10 space-y-8 text-center">
                        <div className="w-24 h-24 bg-teal-500/20 rounded-[2.5rem] flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-teal-400" />
                        </div>
                        <div>
                            <p className="text-teal-400 text-[10px] font-black uppercase tracking-widest mb-1">Muvaffaqiyatli saqlandi</p>
                            <p className="text-white font-black text-xl">{savedResult.studentName}</p>
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Ball</span>
                                <span className="text-white text-2xl font-black">{savedResult.score}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Foiz</span>
                                <span className={`text-xl font-black ${savedResult.percentage >= 50 ? 'text-teal-400' : 'text-rose-400'}`}>
                                    {savedResult.percentage}%
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col w-full gap-3">
                            <button
                                onClick={resetScanner}
                                className="w-full py-4 bg-teal-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-teal-500 transition-all"
                            >
                                Keyingi Varaqa
                            </button>
                            <button
                                onClick={() => { stopCamera(); navigate('/exams'); }}
                                className="w-full py-4 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/20 transition-all"
                            >
                                Skanerni Yopish
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
