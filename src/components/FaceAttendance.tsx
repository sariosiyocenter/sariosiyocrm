import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { X, Camera, UserCheck, Users, CheckCircle2 } from 'lucide-react';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

interface StudentInfo {
    id: number;
    name: string;
    customPrices?: any;
}

interface Props {
    students: StudentInfo[];
    attendanceStatus: Record<number, string>;
    onMatch: (studentId: number) => void;
    onClose: (markedIds: number[]) => void;
}

export default function FaceAttendance({ students, attendanceStatus, onMatch, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const markedRef = useRef<Set<number>>(new Set());

    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadMsg, setLoadMsg] = useState('Modellar yuklanmoqda...');
    const [lastMatched, setLastMatched] = useState<StudentInfo | null>(null);
    const [labeledDescriptors, setLabeledDescriptors] = useState<faceapi.LabeledFaceDescriptors[]>([]);
    const [presentCount, setPresentCount] = useState(0);

    const enrolledStudents = students.filter(s => s.customPrices?.faceDescriptor);
    const totalEnrolled = enrolledStudents.length;

    // Load models + build descriptors
    useEffect(() => {
        const load = async () => {
            try {
                setLoadMsg('Yuz aniqlash modeli...');
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                setLoadMsg('Yuz belgilari modeli...');
                await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
                setLoadMsg("Yuz tanish modeli...");
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                const labeled = enrolledStudents.map(s =>
                    new faceapi.LabeledFaceDescriptors(
                        String(s.id),
                        [new Float32Array(s.customPrices.faceDescriptor)]
                    )
                );
                setLabeledDescriptors(labeled);
                setPhase('ready');
            } catch (err) {
                setLoadMsg('Model yuklab bo\'lmadi. Internet aloqasini tekshiring.');
                setPhase('error');
            }
        };
        load();
    }, []);

    // Start camera after models ready
    useEffect(() => {
        if (phase !== 'ready') return;
        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                setLoadMsg('Kameraga ruxsat berilmagan.');
                setPhase('error');
            }
        };
        start();
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [phase]);

    const detect = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || labeledDescriptors.length === 0) return;

        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, displaySize);

        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
            .withFaceLandmarks(true)
            .withFaceDescriptors();

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length === 0) return;

        const resized = faceapi.resizeResults(detections, displaySize);
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);

        resized.forEach(det => {
            const match = matcher.findBestMatch(det.descriptor);
            const box = det.detection.box;
            const isKnown = match.label !== 'unknown';

            // Draw bounding box
            ctx.strokeStyle = isKnown ? '#22c55e' : '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            if (isKnown) {
                const studentId = parseInt(match.label);
                const student = students.find(s => s.id === studentId);
                if (!student) return;

                // Name label background
                ctx.fillStyle = '#22c55e';
                const textH = 22;
                ctx.fillRect(box.x, box.y - textH, box.width, textH);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 13px Arial';
                ctx.fillText(student.name, box.x + 6, box.y - 5);

                // Auto-mark if not already marked in this session
                if (!markedRef.current.has(studentId) && attendanceStatus[studentId] !== 'Keldi') {
                    markedRef.current.add(studentId);
                    onMatch(studentId);
                    setLastMatched(student);
                    setPresentCount(c => c + 1);
                    setTimeout(() => setLastMatched(null), 2500);
                }
            }
        });
    }, [labeledDescriptors, students, attendanceStatus, onMatch]);

    // Detection loop
    useEffect(() => {
        if (phase !== 'ready') return;
        intervalRef.current = setInterval(detect, 250);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [phase, detect]);

    const markedThisSession = students.filter(s => markedRef.current.has(s.id));
    const alreadyPresent = students.filter(s => attendanceStatus[s.id] === 'Keldi' && !markedRef.current.has(s.id));

    return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-950/90 backdrop-blur border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Camera size={16} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-black uppercase tracking-tight">Face ID Yo'qlama</p>
                        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest">
                            {totalEnrolled}/{students.length} o'quvchi ro'yxatda
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                        <UserCheck size={13} className="text-emerald-400" />
                        <span className="text-emerald-300 text-xs font-black tabular-nums">{markedThisSession.length + alreadyPresent.length}/{students.length}</span>
                    </div>
                    <button onClick={() => onClose(Array.from(markedRef.current))} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer">
                        <X size={16} className="text-white" />
                    </button>
                </div>
            </div>

            {/* Warning banner if no students enrolled */}
            {totalEnrolled === 0 && phase === 'ready' && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
                    <Users size={13} className="text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-[10px] font-bold">
                        Hech bir o'quvchi yuz ro'yxatidan o'tmagan — avval har bir o'quvchi sahifasida <span className="text-white">"Face ID ro'yxatdan o'tkazish"</span> tugmasini bosing
                    </p>
                </div>
            )}

            {/* Camera view */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {phase === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-5" />
                        <p className="text-white text-sm font-bold">{loadMsg}</p>
                        <p className="text-gray-500 text-xs mt-2">Bu bir marta yuklanadi</p>
                    </div>
                )}
                {phase === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <p className="text-rose-400 text-sm font-bold text-center px-8">{loadMsg}</p>
                        <button onClick={() => onClose([])} className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold cursor-pointer">Yopish</button>
                    </div>
                )}

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: 'scaleX(-1)' }}
                />

                {/* Match notification */}
                {lastMatched && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-emerald-500/30 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
                        <UserCheck size={22} />
                        <div>
                            <p className="font-black text-base">{lastMatched.name}</p>
                            <p className="text-emerald-100 text-xs font-bold">Keldi ✓</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Present list + Finish button */}
            <div className="bg-gray-950 border-t border-gray-800">
                {/* Students who passed */}
                <div className="px-5 pt-3 pb-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-2">
                        Face ID dan o'tganlar — {markedThisSession.length + alreadyPresent.length} ta
                    </p>
                    {markedThisSession.length === 0 && alreadyPresent.length === 0 ? (
                        <p className="text-gray-700 text-[9px] font-bold uppercase tracking-widest text-center py-1">Hali hech kim aniqlanmadi...</p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {markedThisSession.map(s => (
                                <span key={s.id} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                                    <CheckCircle2 size={10} className="text-emerald-400" /> {s.name}
                                </span>
                            ))}
                            {alreadyPresent.map(s => (
                                <span key={s.id} className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-900/40 border border-gray-800 px-2.5 py-1 rounded-lg">
                                    <CheckCircle2 size={10} className="text-gray-500" /> {s.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Finish button */}
                <div className="px-5 pb-5 pt-2">
                    <button
                        onClick={() => onClose(Array.from(markedRef.current))}
                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <CheckCircle2 size={16} />
                        Tugatish — {markedThisSession.length + alreadyPresent.length} ta qatnashdi
                    </button>
                </div>
            </div>
        </div>
    );
}
