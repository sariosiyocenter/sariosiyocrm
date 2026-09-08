import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { X, Camera, SwitchCamera, ArrowRight, Image as ImageIcon, AlertTriangle, RotateCcw } from 'lucide-react';
import { loadFaceModels, descriptorFromPhoto, FACE_INPUT_SIZE } from '../lib/faceDescriptor';

/**
 * Face ID bo'yicha o'quvchi qidirish.
 *
 * Yo'qlamadan farqi: bu yerda hech narsa belgilanmaydi — kamera (yoki
 * yuklangan rasm) bo'yicha o'quvchi topiladi va uning profiliga o'tiladi.
 * Ism ham, telefon ham yodda bo'lmaganda ishlatiladi.
 *
 * Tanish qoidasi yo'qlamadagi bilan bir xil: eng yaqin belgi chegaradan
 * yaqin bo'lishi VA ikkinchi o'ringa qaraganda sezilarli yaqin bo'lishi
 * kerak. Ikkinchi shart bajarilmasa "shubhali" deb ko'rsatiladi — xodim
 * o'zi tasdiqlaydi, chunki noto'g'ri profilni ochish chalkashlik tug'diradi.
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
    phone?: string;
    photo?: string;
}

interface Props {
    students: StudentInfo[];
    schoolId: number;
    /** "Profilga o'tish" bosilganda. */
    onPick: (studentId: number) => void;
    onClose: () => void;
}

type Profile = { studentId: number; descriptor: Float32Array; limit: number };
type Hit = { student: StudentInfo; dist: number; sure: boolean };

export default function FaceSearch({ students, schoolId, onPick, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [msg, setMsg] = useState('Yuz belgilari yuklanmoqda…');
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [hit, setHit] = useState<Hit | null>(null);
    /** Yaqin belgi topilmadi — bir necha soniya ko'rsatiladi. */
    const [miss, setMiss] = useState(false);
    const [checkingFile, setCheckingFile] = useState(false);

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => {
        try {
            return localStorage.getItem('faceid_camera') === 'environment' ? 'environment' : 'user';
        } catch {
            return 'user';
        }
    });

    // Butun filialning belgilari — qidiruv bitta guruh bilan cheklanmaydi.
    useEffect(() => {
        let off = false;
        (async () => {
            try {
                const r = await fetch(`/api/face-profiles?schoolId=${schoolId}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const j = await r.json();
                if (!r.ok) throw new Error(j.error || "Yuz belgilarini yuklab bo'lmadi");
                const list: { studentId: number; descriptor: number[]; source?: string }[] = j.profiles || [];

                setMsg('Modellar yuklanmoqda…');
                await loadFaceModels(m => { if (!off) setMsg(m); });

                const parsed: Profile[] = list
                    .filter(p => Array.isArray(p.descriptor) && p.descriptor.length === 128)
                    .map(p => ({
                        studentId: p.studentId,
                        descriptor: new Float32Array(p.descriptor),
                        limit: p.source === 'rasm' ? LIMIT_PHOTO : LIMIT_CAMERA,
                    }));
                if (off) return;
                setProfiles(parsed);
                setPhase('ready');
            } catch (err: any) {
                if (off) return;
                setMsg(err?.message || "Yuklab bo'lmadi. Internet aloqasini tekshiring.");
                setPhase('error');
            }
        })();
        return () => { off = true; };
    }, [schoolId]);

    // Kamera. Natija chiqqach to'xtaydi — qidiruv topilgandan keyin davom
    // etishi shart emas va batareyani yeydi.
    useEffect(() => {
        if (phase !== 'ready' || hit) return;
        let cancelled = false;
        (async () => {
            try {
                streamRef.current?.getTracks().forEach(t => t.stop());
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                // Kamera yo'q bo'lsa ham rasm yuklab qidirish mumkin — shuning
                // uchun bu xato oynani yopmaydi.
                setMsg('Kameraga ruxsat berilmagan — rasm yuklab qidiring.');
            }
        })();
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [phase, facingMode, hit]);

    const toggleCamera = () => {
        setFacingMode(prev => {
            const next = prev === 'user' ? 'environment' : 'user';
            try { localStorage.setItem('faceid_camera', next); } catch { /* private mode */ }
            return next;
        });
    };

    const mirror = facingMode === 'user' ? 'scaleX(-1)' : 'none';

    /** Belgidan eng mos o'quvchini topadi. */
    const match = useCallback((descriptor: Float32Array): Hit | null => {
        let best: { studentId: number; dist: number; limit: number } | null = null;
        let secondDist = Infinity;
        for (const p of profiles) {
            const dist = euclid(descriptor, p.descriptor);
            if (!best || dist < best.dist) {
                if (best) secondDist = best.dist;
                best = { studentId: p.studentId, dist, limit: p.limit };
            } else if (dist < secondDist) {
                secondDist = dist;
            }
        }
        if (!best || best.dist >= best.limit) return null;
        const student = students.find(s => s.id === best!.studentId);
        if (!student) return null;
        return { student, dist: best.dist, sure: (secondDist - best.dist) >= MARGIN };
    }, [profiles, students]);

    const detect = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || profiles.length === 0) return;

        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, displaySize);

        const found = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_INPUT_SIZE, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!found) return;

        const resized = faceapi.resizeResults(found, displaySize);
        const box = resized.detection.box;
        const m = match(found.descriptor as Float32Array);

        ctx.strokeStyle = m ? (m.sure ? '#22c55e' : '#f59e0b') : '#ef4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        if (m) {
            setHit(m);
            setMiss(false);
        } else {
            setMiss(true);
        }
    }, [profiles, match]);

    useEffect(() => {
        if (phase !== 'ready' || hit) return;
        intervalRef.current = setInterval(detect, 300);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [phase, detect, hit]);

    useEffect(() => {
        if (!miss) return;
        const t = setTimeout(() => setMiss(false), 2500);
        return () => clearTimeout(t);
    }, [miss]);

    /** Kamera yo'q bo'lsa yoki qo'lda rasm bo'lsa — shu rasm bo'yicha qidirish. */
    const searchByFile = async (file: File) => {
        setCheckingFile(true);
        setMiss(false);
        try {
            const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
                reader.readAsDataURL(file);
            });
            await loadFaceModels();
            const res = await descriptorFromPhoto(dataUrl);
            if (!res.descriptor) { setMiss(true); return; }
            const m = match(new Float32Array(res.descriptor));
            if (m) setHit(m); else setMiss(true);
        } catch {
            setMiss(true);
        } finally {
            setCheckingFile(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-950/90 backdrop-blur border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand/20 flex items-center justify-center">
                        <Camera size={16} className="text-brand" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-black tracking-tight">Face ID bo'yicha qidirish</p>
                        <p className="text-gray-400 text-[11px] font-bold tabular-nums">
                            {profiles.length} ta o'quvchi Face ID ro'yxatida
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!hit && (
                        <button
                            onClick={toggleCamera}
                            title={facingMode === 'user' ? "Orqa kameraga o'tish" : "Old kameraga o'tish"}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors cursor-pointer"
                        >
                            <SwitchCamera size={13} className="text-white" />
                            <span className="text-white text-[11px] font-bold">{facingMode === 'user' ? 'Old' : 'Orqa'}</span>
                        </button>
                    )}
                    <button aria-label="Yopish" onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer">
                        <X size={16} className="text-white" />
                    </button>
                </div>
            </div>

            {phase === 'ready' && profiles.length === 0 && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-[11px] font-bold">
                        Bu filialda hali birorta yuz belgisi yo'q. Belgi o'quvchining profil rasmidan
                        o'zi olinadi — profillarga aniq rasm qo'ying.
                    </p>
                </div>
            )}

            <div className="flex-1 relative overflow-hidden bg-black">
                {phase === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <div className="w-12 h-12 border-2 border-brand border-t-transparent rounded-full animate-spin mb-5" />
                        <p className="text-white text-sm font-bold">{msg}</p>
                    </div>
                )}
                {phase === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-8">
                        <p className="text-rose-400 text-sm font-bold text-center">{msg}</p>
                        <button onClick={onClose} className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold cursor-pointer">Yopish</button>
                    </div>
                )}

                {!hit && (
                    <>
                        <video ref={videoRef} autoPlay playsInline muted
                            className="w-full h-full object-cover" style={{ transform: mirror }} />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: mirror }} />
                    </>
                )}

                {/* Topilgan o'quvchi. Profilga o'tish tugmasi shu yerda — qidiruv
                    natijasi ko'rinib turgan holda, "kim ekan" degan savol
                    qolmaydi. */}
                {hit && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 animate-in fade-in zoom-in duration-300">
                        <div className="w-28 h-28 rounded-3xl overflow-hidden border-2 border-brand bg-gray-900 flex items-center justify-center mb-5">
                            {hit.student.photo
                                ? <img src={hit.student.photo} alt={hit.student.name} className="w-full h-full object-cover" />
                                : <span className="text-3xl font-black text-brand">{hit.student.name.charAt(0)}</span>}
                        </div>
                        <p className="text-white text-lg font-black tracking-tight text-center">{hit.student.name}</p>
                        {hit.student.phone && (
                            <p className="text-gray-400 text-[12px] font-bold tabular-nums mt-1">{hit.student.phone}</p>
                        )}
                        {!hit.sure && (
                            <p className="text-amber-300 text-[11px] font-bold mt-3 text-center max-w-xs">
                                Unga o'xshaydi, lekin markazda o'xshash yana bir o'quvchi bor —
                                profilni ochishdan oldin tekshiring.
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-6 w-full max-w-xs">
                            <button
                                onClick={() => { setHit(null); setMiss(false); }}
                                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl text-[12px] font-bold cursor-pointer transition-colors"
                            >
                                <RotateCcw size={14} /> Qayta
                            </button>
                            <button
                                onClick={() => onPick(hit.student.id)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-white rounded-2xl text-[12px] font-black cursor-pointer transition-colors"
                            >
                                Profilga o'tish <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {!hit && miss && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-gray-700 text-gray-200 px-5 py-3 rounded-2xl text-[12px] font-bold">
                        Bu yuz ro'yxatdan topilmadi
                    </div>
                )}
            </div>

            {!hit && (
                <div className="bg-gray-950 border-t border-gray-800 px-5 py-4">
                    <label className="w-full flex items-center justify-center gap-2 py-3 border border-gray-700 rounded-2xl text-[12px] font-bold text-gray-200 hover:bg-gray-900 cursor-pointer transition-colors">
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) searchByFile(f);
                        }} />
                        <ImageIcon size={14} />
                        {checkingFile ? 'Rasm tekshirilmoqda…' : 'Rasm yuklab qidirish'}
                    </label>
                </div>
            )}
        </div>
    );
}
