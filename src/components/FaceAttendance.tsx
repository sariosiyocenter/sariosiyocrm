import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { X, Camera, UserCheck, Users, CheckCircle2, SwitchCamera, AlertTriangle } from 'lucide-react';
import { descriptorFromPhoto, saveFaceProfiles, faceFailedBefore, rememberFaceTry } from '../lib/faceDescriptor';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

/**
 * Tanish qoidasi.
 *
 * Bitta chegara yetarli emas: markazdagi 220 ta belgi tekshirilganda, bitta
 * guruh ichida 146 ta juft o'quvchining belgilari 0.55 dan yaqin chiqdi —
 * ya'ni eski qoida bilan tizim ishonch bilan boshqa bolani belgilab yuborishi
 * mumkin edi. Shuning uchun ikkita shart:
 *   1) eng yaqin belgi chegaradan yaqin bo'lsin;
 *   2) ikkinchi o'ringa qaraganda sezilarli yaqin bo'lsin (MARGIN).
 * Ikkinchi shart bajarilmasa o'quvchi "shubhali" deb sariq ramka bilan
 * ko'rsatiladi va avtomatik belgilanmaydi — xodim o'zi tanlaydi.
 *
 * Rasmdan olingan belgi kamera bilan olinganidan ishonchsizroq (surat eski,
 * sifati past bo'lishi mumkin), shuning uchun unga qattiqroq chegara.
 */
const LIMIT_CAMERA = 0.55;
const LIMIT_PHOTO = 0.48;
const MARGIN = 0.06;

const euclid = (a: Float32Array, b: Float32Array) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s);
};

interface StudentInfo {
    id: number;
    name: string;
    /** Yuz belgisi shu rasmdan olinadi. */
    photo?: string;
    customPrices?: any;
}

interface Props {
    students: StudentInfo[];
    /** Yuz belgilari shu guruh va filial uchun yuklanadi. */
    groupId: number;
    schoolId: number;
    attendanceStatus: Record<number, string>;
    onMatch: (studentId: number) => void;
    onUnmatch: (studentId: number) => void;
    onClose: (markedIds: number[]) => void;
}

export default function FaceAttendance({ students, groupId, schoolId, attendanceStatus, onMatch, onUnmatch, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const markedRef = useRef<Set<number>>(new Set());

    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadMsg, setLoadMsg] = useState('Modellar yuklanmoqda...');
    const [lastMatched, setLastMatched] = useState<StudentInfo | null>(null);
    const [profiles, setProfiles] = useState<{ studentId: number; descriptor: Float32Array; limit: number }[]>([]);
    /** Tanildi, lekin ishonch past — xodim o'zi tasdiqlashi kerak. */
    const [uncertain, setUncertain] = useState<string | null>(null);
    const [markedSet, setMarkedSet] = useState<Set<number>>(new Set());
    /** Qaysi kamera ishlayapti. Telefonda old kamera bilan yuzni tutish noqulay —
     *  xodim odatda o'quvchiga orqa kamerani qaratadi, shuning uchun almashtirish
     *  tugmasi bor va tanlov keyingi safar ham eslab qolinadi. */
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => {
        try {
            return localStorage.getItem('faceid_camera') === 'environment' ? 'environment' : 'user';
        } catch {
            return 'user';
        }
    });

    // Ro'yxatdan o'tgan o'quvchilar soni — belgilar serverdan kelgach ma'lum bo'ladi.
    const [totalEnrolled, setTotalEnrolled] = useState(0);

    // Yuz belgilarini yuklash + modellar.
    //
    // Belgilar ilgari o'quvchi yozuvining ichida (customPrices) kelardi va
    // /api/init bilan hamma o'quvchi uchun yuborilardi. Endi alohida jadvalda
    // va faqat shu guruh uchun so'raladi.
    useEffect(() => {
        const load = async () => {
            try {
                setLoadMsg('Yuz belgilari yuklanmoqda...');
                const r = await fetch(`/api/face-profiles?schoolId=${schoolId}&groupId=${groupId}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const j = await r.json();
                if (!r.ok) throw new Error(j.error || 'Yuz belgilarini yuklab bo\'lmadi');
                const list: { studentId: number; descriptor: number[]; source?: string }[] = j.profiles || [];

                setLoadMsg('Yuz aniqlash modeli...');
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                setLoadMsg('Yuz belgilari modeli...');
                await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
                setLoadMsg("Yuz tanish modeli...");
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                const parsed = list
                    .filter(p => Array.isArray(p.descriptor) && p.descriptor.length === 128)
                    .map(p => ({
                        studentId: p.studentId,
                        descriptor: new Float32Array(p.descriptor),
                        limit: p.source === 'rasm' ? LIMIT_PHOTO : LIMIT_CAMERA,
                    }));

                // Belgisi yo'q, lekin rasmi bor o'quvchilar — shu yerda, o'sha
                // zahoti rasmidan olinadi. Alohida "Face ID ga qo'shish"
                // qadami yo'q: yangi o'quvchi guruhga qo'shilsa, birinchi
                // yo'qlamada o'zi ro'yxatga tushadi. Rasmida yuz topilmaganlar
                // shu seansda qayta urinilmaydi.
                const have = new Set(parsed.map(p => p.studentId));
                const missing = students.filter(s =>
                    !have.has(s.id) && typeof s.photo === 'string' && s.photo.length > 100
                    && !faceFailedBefore(s.id, s.photo)
                );
                const fresh: { studentId: number; descriptor: number[] }[] = [];
                for (let i = 0; i < missing.length; i++) {
                    const s = missing[i];
                    setLoadMsg(`Yangi o'quvchilar rasmidan belgi olinmoqda… ${i + 1}/${missing.length}`);
                    const res = await descriptorFromPhoto(s.photo as string);
                    rememberFaceTry(s.id, s.photo as string, !!res.descriptor);
                    if (!res.descriptor) continue;
                    fresh.push({ studentId: s.id, descriptor: res.descriptor });
                    parsed.push({ studentId: s.id, descriptor: new Float32Array(res.descriptor), limit: LIMIT_PHOTO });
                }
                if (fresh.length) {
                    // Saqlanmasa ham yo'qlama ishlayveradi — belgilar xotirada bor.
                    try {
                        for (let i = 0; i < fresh.length; i += 25) {
                            await saveFaceProfiles(schoolId, fresh.slice(i, i + 25));
                        }
                    } catch { /* keyingi safar qayta urinadi */ }
                }

                setTotalEnrolled(parsed.length);
                setProfiles(parsed);
                setPhase('ready');
            } catch (err: any) {
                setLoadMsg(err?.message || 'Model yuklab bo\'lmadi. Internet aloqasini tekshiring.');
                setPhase('error');
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId, groupId]);

    // Start camera after models ready — kamera almashtirilganda ham qayta ishga tushadi
    useEffect(() => {
        if (phase !== 'ready') return;
        let cancelled = false;
        const start = async () => {
            try {
                // Avvalgi oqim yopilmasa, ba'zi qurilmalar ikkinchi kamerani bermaydi.
                streamRef.current?.getTracks().forEach(t => t.stop());
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                setLoadMsg('Kameraga ruxsat berilmagan.');
                setPhase('error');
            }
        };
        start();
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [phase, facingMode]);

    const toggleCamera = () => {
        setFacingMode(prev => {
            const next = prev === 'user' ? 'environment' : 'user';
            try { localStorage.setItem('faceid_camera', next); } catch { /* private mode */ }
            return next;
        });
    };

    // Old kamera ko'zguday aks ettiriladi, orqa kamera esa yo'q — aks holda
    // o'quvchiga qaratilgan tasvir teskari ko'rinadi.
    const mirror = facingMode === 'user' ? 'scaleX(-1)' : 'none';

    const detect = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || profiles.length === 0) return;

        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, displaySize);

        // inputSize 320 da detektor yuzni tez-tez o'tkazib yuborardi: sinovda
        // ekranni to'ldirib turgan yuz ham topilmadi, 416 da esa 0.9 ishonch
        // bilan topildi. Tezlik farqi sezilmaydi (har 250 ms da bir marta).
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptors();

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length === 0) return;

        const resized = faceapi.resizeResults(detections, displaySize);

        resized.forEach(det => {
            // Eng yaqin ikkita belgi. Ikkinchisi kerak: agar u ham deyarli
            // shunday yaqin bo'lsa, qaysi biri ekanini ayta olmaymiz.
            let best: { studentId: number; dist: number; limit: number } | null = null;
            let secondDist = Infinity;
            for (const p of profiles) {
                const dist = euclid(det.descriptor as Float32Array, p.descriptor);
                if (!best || dist < best.dist) {
                    if (best) secondDist = best.dist;
                    best = { studentId: p.studentId, dist, limit: p.limit };
                } else if (dist < secondDist) {
                    secondDist = dist;
                }
            }

            const box = det.detection.box;
            const student = best ? students.find(s => s.id === best!.studentId) : undefined;
            const close = !!best && best.dist < best.limit;
            const clear = !!best && (secondDist - best.dist) >= MARGIN;
            const isKnown = close && clear && !!student;
            // Yaqin, lekin ikkinchisidan ajratib bo'lmadi — noto'g'ri belgilashdan
            // ko'ra so'ragan yaxshi.
            const isDoubtful = close && !clear && !!student;

            ctx.strokeStyle = isKnown ? '#22c55e' : isDoubtful ? '#f59e0b' : '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            if (isDoubtful && student) {
                ctx.fillStyle = '#f59e0b';
                const th = 22;
                ctx.fillRect(box.x, box.y - th, box.width, th);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 13px Arial';
                ctx.save();
                if (facingMode === 'user') { ctx.translate(2 * (box.x + box.width / 2), 0); ctx.scale(-1, 1); }
                ctx.fillText(student.name + ' ?', box.x + 6, box.y - 5);
                ctx.restore();
                setUncertain(student.name);
                return;
            }

            if (isKnown && student) {
                const studentId = best!.studentId;

                // Name label background
                ctx.fillStyle = '#22c55e';
                const textH = 22;
                ctx.fillRect(box.x, box.y - textH, box.width, textH);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 13px Arial';
                // Old kamerada kanvas video bilan birga ko'zguda aks etadi —
                // ramka to'g'ri turadi, lekin matn teskari o'qilardi. Matnni
                // ramka o'rtasiga nisbatan qaytadan aks ettiramiz.
                ctx.save();
                if (facingMode === 'user') {
                    ctx.translate(2 * (box.x + box.width / 2), 0);
                    ctx.scale(-1, 1);
                }
                ctx.fillText(student.name, box.x + 6, box.y - 5);
                ctx.restore();

                // Auto-mark if not already detected in this session
                if (!markedRef.current.has(studentId)) {
                    markedRef.current.add(studentId);
                    setMarkedSet(new Set(markedRef.current));
                    onMatch(studentId);
                    setLastMatched(student);
                    setTimeout(() => setLastMatched(null), 2500);
                }
            }
        });
    }, [profiles, students, attendanceStatus, onMatch, facingMode]);

    // Detection loop
    useEffect(() => {
        if (phase !== 'ready') return;
        intervalRef.current = setInterval(detect, 250);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [phase, detect]);

    // "Shubhali" ogohlantirishi bir necha soniyadan keyin o'chadi.
    useEffect(() => {
        if (!uncertain) return;
        const t = setTimeout(() => setUncertain(null), 3000);
        return () => clearTimeout(t);
    }, [uncertain]);

    const markedThisSession = students.filter(s => markedSet.has(s.id));

    const removeMarked = (studentId: number) => {
        markedRef.current.delete(studentId);
        setMarkedSet(new Set(markedRef.current));
        onUnmatch(studentId);
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-950/90 backdrop-blur border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Camera size={16} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-black tracking-tight">Face ID Yo'qlama</p>
                        <p className="text-matn-xira text-[11px] font-bold">
                            {totalEnrolled}/{students.length} o'quvchi ro'yxatda
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleCamera}
                        title={facingMode === 'user' ? "Orqa kameraga o'tish" : "Old kameraga o'tish"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors cursor-pointer"
                    >
                        <SwitchCamera size={13} className="text-white" />
                        <span className="text-white text-[11px] font-bold">{facingMode === 'user' ? 'Old' : 'Orqa'}</span>
                    </button>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                        <UserCheck size={13} className="text-emerald-400" />
                        <span className="text-emerald-300 text-xs font-black tabular-nums">{markedThisSession.length}/{totalEnrolled}</span>
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
                    <p className="text-amber-300 text-[11px] font-bold">
                        Bu guruhda hech kimning yuzi aniqlanmadi — o'quvchilarning <span className="text-white">profil rasmi</span> yo'q yoki rasmda yuz ko'rinmayapti. Aniqroq rasm qo'ysangiz Face ID o'zi ishlaydi.
                    </p>
                </div>
            )}

            {/* Ishonch past bo'lgan tanish — avtomatik belgilanmaydi */}
            {uncertain && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-[11px] font-bold">
                        <span className="text-white">{uncertain}</span> ga o'xshaydi, lekin guruhda unga o'xshash boshqa o'quvchi ham bor —
                        avtomatik belgilanmadi. Yaqinroq turing yoki ro'yxatdan qo'lda belgilang.
                    </p>
                </div>
            )}

            {/* Camera view */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {phase === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-5" />
                        <p className="text-white text-sm font-bold">{loadMsg}</p>
                        <p className="text-matn-sokin text-xs mt-2">Bu bir marta yuklanadi</p>
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
                    style={{ transform: mirror }}
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: mirror }}
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
                <div className="px-5 pt-3 pb-2" style={{ maxHeight: '130px', overflowY: 'auto' }}>
                    {markedThisSession.length === 0 ? (
                        <p className="text-gray-700 text-[11px] font-bold text-center py-1">Hali hech kim aniqlanmadi...</p>
                    ) : (
                        <div>
                            <p className="text-emerald-500 text-[11px] font-bold mb-1.5">
                                Qatnashdi — {markedThisSession.length} ta
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {markedThisSession.map(s => (
                                    <span key={s.id} className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 pl-2.5 pr-1 py-1 rounded-lg">
                                        <CheckCircle2 size={10} className="text-emerald-400" /> {s.name}
                                        <button aria-label="Yopish" onClick={() => removeMarked(s.id)} className="ml-1 text-emerald-600 hover:text-rose-400 transition-colors cursor-pointer">
                                            <X size={18} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Finish button */}
                <div className="px-5 pb-5 pt-2">
                    <button
                        onClick={() => onClose(Array.from(markedRef.current))}
                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <CheckCircle2 size={16} />
                        Tugatish — {markedThisSession.length} ta Face ID dan o'tdi
                    </button>
                </div>
            </div>
        </div>
    );
}
