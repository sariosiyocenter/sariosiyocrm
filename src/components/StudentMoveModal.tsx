import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, AlertTriangle, Users } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * O'quvchini boshqa guruhga ko'chirish yoki o'qishni to'xtatganda pulni
 * qaytarish oynasi.
 *
 * Ikkalasi ham bitta qoidaga tayanadi: bitta dars narxi = oylik narx / o'sha
 * oydagi jadval bo'yicha dars kunlari soni. Shuning uchun oyning o'rtasida
 * ko'chgan o'quvchi eski guruhda o'tgan darslar uchun to'laydi, yangi guruhda
 * esa qolgan darslar uchun. Ikkala guruhning narxi har xil bo'lishi mumkin.
 *
 * Hisob avval ko'rsatiladi (server `preview: true` bilan chaqiriladi), tasdiq
 * bosilgandan keyingina yoziladi.
 */

interface Line {
    groupId: number;
    groupName: string;
    teacher: string | null;
    role?: 'from' | 'to';
    monthlyPrice: number;
    lessonsInMonth: number;
    perLesson: number;
    lessons: number;
    due: number;
    alreadyCharged: number;
    adjust: number;
}

interface Preview {
    month: string;
    date: string;
    lines: Line[];
    balanceDelta: number;
    balanceAfter: number;
    balanceAfterRecalc?: number;
    cashOut?: number;
    student: { id: number; name: string; balanceBefore: number };
}

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

export default function StudentMoveModal({ studentId, mode, onClose }: {
    studentId: number;
    mode: 'transfer' | 'refund';
    onClose: () => void;
}) {
    const { students, groups, courses, selectedSchoolId, showNotification, retryLoad } = useCRM();
    const student = students.find(s => s.id === studentId);

    const studentGroups = groups.filter(g => (student?.groups || []).includes(g.id));
    const otherGroups = groups.filter(g => !(student?.groups || []).includes(g.id));

    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [fromGroupId, setFromGroupId] = useState<number | ''>(studentGroups[0]?.id ?? '');
    const [toGroupId, setToGroupId] = useState<number | ''>('');
    const [refundMode, setRefundMode] = useState<'balance' | 'cash'>('balance');

    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const schoolId = student?.schoolId || selectedSchoolId;

    const load = useCallback(async () => {
        if (!schoolId || !date) return;
        if (mode === 'transfer' && !toGroupId) { setPreview(null); setError(null); return; }
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const url = `/api/students/${studentId}/${mode}`;
            const body = mode === 'transfer'
                ? { schoolId, fromGroupId: fromGroupId || null, toGroupId, date, preview: true }
                : { schoolId, date, mode: refundMode, preview: true };
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Hisoblab bo\'lmadi'); setPreview(null); return; }
            setPreview(data);
        } catch {
            setError('Aloqa xatosi');
            setPreview(null);
        } finally {
            setLoading(false);
        }
    }, [schoolId, date, mode, studentId, fromGroupId, toGroupId, refundMode]);

    useEffect(() => { load(); }, [load]);

    const apply = async () => {
        if (saving || !preview) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const body = mode === 'transfer'
                ? { schoolId, fromGroupId: fromGroupId || null, toGroupId, date }
                : { schoolId, date, mode: refundMode };
            const res = await fetch(`/api/students/${studentId}/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { showNotification(data.error || 'Xatolik', 'error'); return; }
            showNotification(
                mode === 'transfer' ? "O'quvchi ko'chirildi va hisob qayta hisoblandi" : 'Qayta hisob bajarildi',
                'success'
            );
            retryLoad();
            onClose();
        } catch {
            showNotification('Aloqa xatosi', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!student) return null;

    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
    const labelCls = "block text-[11px] font-extrabold text-matn-xira mb-2";

    const courseName = (g: any) => courses.find(c => c.id === g.courseId)?.name || '';

    return (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-2xl p-8 space-y-5 my-auto">
                <div className="flex items-center justify-between pb-4 border-b border-chiziq-mayin/50">
                    <div>
                        <h3 className="text-lg font-black text-matn tracking-tight">
                            {mode === 'transfer' ? "Boshqa guruhga ko'chirish" : "O'qishni to'xtatish va qayta hisob"}
                        </h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5">{student.name}</p>
                    </div>
                    <button aria-label="Yopish" onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>{mode === 'transfer' ? "Ko'chirish sanasi" : 'Chiqish sanasi'}</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                        <p className="text-[10px] text-matn-xira mt-1">Shu kundan boshlab yangi hisob yuritiladi.</p>
                    </div>

                    {mode === 'transfer' ? (
                        <>
                            <div>
                                <label className={labelCls}>Qaysi guruhdan</label>
                                <select value={fromGroupId} onChange={e => setFromGroupId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                                    <option value="">— (yangi guruh qo'shiladi)</option>
                                    {studentGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name} {courseName(g) && `(${courseName(g)})`}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Qaysi guruhga *</label>
                                <select value={toGroupId} onChange={e => setToGroupId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                                    <option value="">Guruhni tanlang</option>
                                    {otherGroups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} {courseName(g) && `(${courseName(g)})`} — {g.days === 'TOQ' ? 'toq kunlar' : g.days === 'JUFT' ? 'juft kunlar' : g.days === 'HAR_KUNI' ? 'har kuni' : 'jadval yo\'q'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className={labelCls}>Pul qanday qaytarilsin</label>
                            <select value={refundMode} onChange={e => setRefundMode(e.target.value as any)} className={inputCls}>
                                <option value="balance">Balansda qolsin</option>
                                <option value="cash">Naqd berilsin (kassadan chiqim)</option>
                            </select>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                        <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{error}</p>
                    </div>
                )}

                {loading && !error && (
                    <p className="text-[11px] font-bold text-matn-xira text-center py-6">Hisoblanmoqda…</p>
                )}

                {preview && !error && (
                    <div className="space-y-4">
                        <div className="bg-ichki border border-chiziq rounded-2xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-chiziq bg-sirt/50">
                                        <th className="p-3 text-[10px] font-bold text-matn-xira">Guruh</th>
                                        <th className="p-3 text-[10px] font-bold text-matn-xira text-right">Darslar</th>
                                        <th className="p-3 text-[10px] font-bold text-matn-xira text-right">Hisob</th>
                                        <th className="p-3 text-[10px] font-bold text-matn-xira text-right">Yechilgan</th>
                                        <th className="p-3 text-[10px] font-bold text-matn-xira text-right">Tuzatish</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-chiziq-mayin">
                                    {preview.lines.map(l => (
                                        <tr key={l.groupId + String(l.role)}>
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5">
                                                    {l.role === 'to' && <ArrowRight size={12} className="text-brand shrink-0" />}
                                                    <span className="text-[12px] font-bold text-matn">{l.groupName}</span>
                                                </div>
                                                <span className="text-[10px] text-matn-xira flex items-center gap-1 mt-0.5">
                                                    <Users size={9} />{l.teacher || 'ustoz yo\'q'} · 1 dars {money(l.perLesson)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right num text-[12px] text-matn-2">{l.lessons}/{l.lessonsInMonth}</td>
                                            <td className="p-3 text-right num text-[12px] text-matn">{money(l.due)}</td>
                                            <td className="p-3 text-right num text-[12px] text-matn-xira">{money(l.alreadyCharged)}</td>
                                            <td className={`p-3 text-right num text-[12px] font-bold ${l.adjust > 0 ? 'text-emerald-600' : l.adjust < 0 ? 'text-rose-500' : 'text-matn-xira'}`}>
                                                {l.adjust > 0 ? '+' : ''}{money(l.adjust)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-ichki rounded-2xl border border-chiziq space-y-2">
                            <div className="flex items-center justify-between text-[12px]">
                                <span className="text-matn-sokin">Hozirgi balans</span>
                                <span className={`num font-bold ${preview.student.balanceBefore < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {money(preview.student.balanceBefore)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[12px]">
                                <span className="text-matn-sokin">Qayta hisob</span>
                                <span className={`num font-bold ${preview.balanceDelta > 0 ? 'text-emerald-600' : preview.balanceDelta < 0 ? 'text-rose-500' : 'text-matn-xira'}`}>
                                    {preview.balanceDelta > 0 ? '+' : ''}{money(preview.balanceDelta)}
                                </span>
                            </div>
                            {mode === 'refund' && refundMode === 'cash' && (
                                <div className="flex items-center justify-between text-[12px]">
                                    <span className="text-matn-sokin">Naqd beriladi (kassadan)</span>
                                    <span className="num font-bold text-rose-500">{money(preview.cashOut || 0)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t border-dashed border-chiziq">
                                <span className="text-[12px] font-bold text-matn">Yakuniy balans</span>
                                <span className={`num text-[15px] font-bold ${preview.balanceAfter < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {money(preview.balanceAfter)}
                                </span>
                            </div>
                            <p className="text-[10px] text-matn-xira pt-1">
                                {preview.balanceAfter < 0
                                    ? `O'quvchi ${money(Math.abs(preview.balanceAfter))} so'm to'lashi kerak.`
                                    : preview.balanceAfter > 0
                                        ? `O'quvchining hisobida ${money(preview.balanceAfter)} so'm qoladi.`
                                        : 'Hisob teng.'}
                            </p>
                        </div>

                        {mode === 'refund' && refundMode === 'cash' && (preview.cashOut || 0) === 0 && (
                            <p className="text-[10px] text-matn-xira">
                                Naqd qaytarish uchun balans musbat bo'lishi kerak — hozir qaytariladigan ortiqcha pul yo'q.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                        Bekor
                    </button>
                    <button type="button" onClick={apply} disabled={saving || !preview || !!error}
                        className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-2xl cursor-pointer transition-all">
                        {saving ? 'Saqlanmoqda…' : mode === 'transfer' ? "Ko'chirish" : 'Tasdiqlash'}
                    </button>
                </div>
            </div>
        </div>
    );
}
