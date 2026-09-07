import { useEffect, useRef, useState } from 'react';
import { X, ScanFace, Play, Square, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { loadFaceModels, descriptorFromPhoto, saveFaceProfiles } from '../lib/faceDescriptor';

/**
 * Face ID ni mavjud profil rasmlaridan to'ldirish.
 *
 * Ilgari Face ID yo'qlamasi faqat kamera orqali alohida "ro'yxatdan
 * o'tkazilgan" o'quvchini tanirdi — profil rasmlari umuman ishlatilmasdi.
 * Markazda 235 ta rasm bor, ularni bittalab qayta suratga olish — bir necha
 * soatlik ish. Bu oyna o'sha rasmlarni brauzerda o'qib, har biridan yuz
 * belgisini chiqaradi va saqlaydi.
 *
 * Hisob-kitob brauzerda bo'ladi (serverda yuz tanish kutubxonasi yo'q), shuning
 * uchun oyna ochiq turishi kerak. Har 25 tadan keyin natija serverga yuboriladi
 * — yarim yo'lda to'xtatilsa ham bajarilgani saqlanib qoladi.
 */

interface Row {
    id: number;
    name: string;
    photo: string;
    state: 'kutilmoqda' | 'topildi' | 'topilmadi' | 'kop' | 'xato';
}

const CHUNK = 25;

export default function FaceBulkEnroll({ onClose }: { onClose: (saved: number) => void }) {
    const { students, selectedSchoolId, showNotification } = useCRM();

    const [enrolledIds, setEnrolledIds] = useState<Set<number> | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [phase, setPhase] = useState<'tayyorlanmoqda' | 'tayyor' | 'ishlamoqda' | 'tugadi' | 'xato'>('tayyorlanmoqda');
    const [msg, setMsg] = useState('Ro\'yxat tayyorlanmoqda…');
    const [done, setDone] = useState(0);
    const [saved, setSaved] = useState(0);
    const stopRef = useRef(false);
    const savedRef = useRef(0);

    const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

    // Kim allaqachon ro'yxatdan o'tgan — yengil so'rov (faqat ID lar).
    useEffect(() => {
        let off = false;
        (async () => {
            try {
                const r = await fetch(`/api/face-profiles?schoolId=${selectedSchoolId}&ids=1`, { headers: auth() });
                const j = await r.json();
                if (!r.ok) throw new Error(j.error || 'Yuklab bo\'lmadi');
                if (off) return;
                setEnrolledIds(new Set((j.profiles || []).map((p: any) => p.studentId)));
            } catch (e: any) {
                if (!off) { setMsg(e.message || 'Xatolik'); setPhase('xato'); }
            }
        })();
        return () => { off = true; };
    }, [selectedSchoolId]);

    // Rasmi bor, lekin hali ro'yxatdan o'tmagan faol o'quvchilar.
    useEffect(() => {
        if (!enrolledIds) return;
        const list = students
            .filter(s => s.status !== 'Arxiv')
            .filter(s => typeof s.photo === 'string' && s.photo.length > 100)
            .filter(s => !enrolledIds.has(s.id))
            .map(s => ({ id: s.id, name: s.name, photo: s.photo as string, state: 'kutilmoqda' as const }));
        setRows(list);
        setPhase('tayyor');
        setMsg(list.length
            ? `${list.length} ta o'quvchining rasmi bor va hali Face ID ga qo'shilmagan.`
            : "Rasmi bor hamma o'quvchi allaqachon Face ID ga qo'shilgan.");
    }, [enrolledIds, students]);

    const send = async (batch: { studentId: number; descriptor: number[] }[]) => {
        if (!batch.length) return;
        savedRef.current += await saveFaceProfiles(selectedSchoolId, batch);
        setSaved(savedRef.current);
    };

    const run = async () => {
        stopRef.current = false;
        setPhase('ishlamoqda');
        try {
            await loadFaceModels(setMsg);
        } catch {
            setMsg('Modellarni yuklab bo\'lmadi. Internet aloqasini tekshiring.');
            setPhase('xato');
            return;
        }

        setMsg('Rasmlar tekshirilmoqda…');
        let batch: { studentId: number; descriptor: number[] }[] = [];

        for (let i = 0; i < rows.length; i++) {
            if (stopRef.current) break;
            const row = rows[i];
            const res = await descriptorFromPhoto(row.photo);
            let state: Row['state'];
            if (res.descriptor) {
                batch.push({ studentId: row.id, descriptor: res.descriptor });
                state = 'topildi';
            } else {
                state = res.reason === 'topilmadi' ? 'topilmadi' : res.reason === 'kop' ? 'kop' : 'xato';
            }

            setRows(prev => prev.map((r, idx) => idx === i ? { ...r, state } : r));
            setDone(i + 1);

            if (batch.length >= CHUNK) {
                try { await send(batch); } catch (e: any) { showNotification(e.message, 'error'); }
                batch = [];
            }
        }

        try { await send(batch); } catch (e: any) { showNotification(e.message, 'error'); }
        setPhase('tugadi');
        setMsg(stopRef.current ? "To'xtatildi." : 'Tugadi.');
    };

    const counts = {
        topildi: rows.filter(r => r.state === 'topildi').length,
        topilmadi: rows.filter(r => r.state === 'topilmadi').length,
        kop: rows.filter(r => r.state === 'kop').length,
        xato: rows.filter(r => r.state === 'xato').length,
    };
    const problems = rows.filter(r => r.state !== 'kutilmoqda' && r.state !== 'topildi');
    const percent = rows.length ? Math.round((done / rows.length) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[300] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={() => phase !== 'ishlamoqda' && onClose(savedRef.current)} />
            <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8 space-y-5 my-auto">
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-chiziq-mayin/50">
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-matn tracking-tight flex items-center gap-2">
                            <ScanFace size={18} className="text-brand" /> Rasmlardan Face ID
                        </h3>
                        <p className="text-[11px] font-bold text-matn-xira mt-1">
                            Profil rasmlaridan yuz belgisi olinadi — har birini qayta suratga olish shart emas
                        </p>
                    </div>
                    <button type="button" aria-label="Yopish" disabled={phase === 'ishlamoqda'}
                        onClick={() => onClose(savedRef.current)}
                        className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer disabled:opacity-40">
                        <X size={18} />
                    </button>
                </div>

                <p className="text-[12px] font-bold text-matn-sokin">{msg}</p>

                {(phase === 'ishlamoqda' || phase === 'tugadi') && (
                    <div className="space-y-3">
                        <div className="h-2 rounded-full bg-ichki overflow-hidden">
                            <div className="h-full bg-brand transition-all" style={{ width: percent + '%' }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-matn-sokin"><span className="num">{done}</span> / <span className="num">{rows.length}</span></span>
                            <span className="text-yaxshi"><span className="num">{saved}</span> ta saqlandi</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="px-2 py-2 rounded-xl bg-yaxshi-fon border border-yaxshi/25">
                                <p className="num text-[15px] font-semibold text-yaxshi">{counts.topildi}</p>
                                <p className="text-[10px] font-bold text-matn-xira">yuz topildi</p>
                            </div>
                            <div className="px-2 py-2 rounded-xl bg-ichki border border-chiziq">
                                <p className="num text-[15px] font-semibold text-matn">{counts.topilmadi}</p>
                                <p className="text-[10px] font-bold text-matn-xira">topilmadi</p>
                            </div>
                            <div className="px-2 py-2 rounded-xl bg-ichki border border-chiziq">
                                <p className="num text-[15px] font-semibold text-matn">{counts.kop + counts.xato}</p>
                                <p className="text-[10px] font-bold text-matn-xira">bir nechta / xato</p>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'tugadi' && problems.length > 0 && (
                    <div className="rounded-2xl border border-chiziq bg-ichki/50 max-h-48 overflow-y-auto">
                        <p className="px-4 py-2.5 text-[11px] font-bold text-matn-xira border-b border-chiziq flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-ogoh" />
                            Bularni kamera orqali qo'shish kerak ({problems.length})
                        </p>
                        <div className="divide-y divide-chiziq/60">
                            {problems.map(r => (
                                <div key={r.id} className="px-4 py-2 flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold text-matn truncate">{r.name}</span>
                                    <span className="text-[10px] font-bold text-matn-xira shrink-0">
                                        {r.state === 'topilmadi' ? 'yuz topilmadi' : r.state === 'kop' ? 'bir nechta yuz' : 'rasm ochilmadi'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {phase === 'tayyor' && rows.length > 0 && (
                    <p className="text-[10px] text-matn-xira">
                        Oyna ochiq turishi kerak — hisob brauzerda bajariladi. Taxminan
                        {' '}<span className="num">{Math.max(1, Math.round(rows.length / 40))}</span>–<span className="num">{Math.max(2, Math.round(rows.length / 15))}</span> daqiqa.
                        Yarim yo'lda to'xtatsangiz ham bajarilgani saqlanib qoladi.
                    </p>
                )}

                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                    {phase === 'ishlamoqda' ? (
                        <button type="button" onClick={() => { stopRef.current = true; }}
                            className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer flex items-center justify-center gap-2">
                            <Square size={13} /> To'xtatish
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={() => onClose(savedRef.current)}
                                className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer">
                                {phase === 'tugadi' ? 'Yopish' : 'Bekor'}
                            </button>
                            {phase === 'tayyor' && rows.length > 0 && (
                                <button type="button" onClick={run}
                                    className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl cursor-pointer flex items-center justify-center gap-2">
                                    <Play size={13} /> Boshlash
                                </button>
                            )}
                            {phase === 'tugadi' && counts.topildi > 0 && (
                                <div className="flex-1 py-3 rounded-2xl bg-yaxshi-fon border border-yaxshi/25 text-yaxshi text-xs font-extrabold flex items-center justify-center gap-2">
                                    <CheckCircle2 size={14} /> <span className="num">{saved}</span> ta qo'shildi
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
