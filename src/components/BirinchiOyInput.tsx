import React, { useEffect, useState } from 'react';

/**
 * Kursga qo'shishda birinchi oy summasi (egasi, 2026-09-23): tizim kelgan
 * sanadan hisoblab ko'rsatadi ("15-sentabrdan 7 dars — 269 231"), xodim
 * xohlasa o'zi yozadi ("300 000 to'lasin"). Qo'lda yozilgani `onChange`
 * orqali qaytadi; undefined — tizim hisoblagani yoziladi.
 *
 * O'quvchi qo'shish formasida, kurs sahifasida va kartochkadagi "Kursga
 * qo'shish" oynasida — bir xil.
 */
export default function BirinchiOyInput({ groupId, schoolId, startDate, studentId, value, onChange, trial, label }: {
    groupId: number;
    schoolId: number;
    startDate: string;
    studentId?: number;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    trial?: boolean;
    label?: string;
}) {
    const [taklif, setTaklif] = useState<{ suggested: number | null; lessons: number | null; price: number } | null>(null);

    useEffect(() => {
        if (!groupId || !schoolId) return;
        let off = false;
        (async () => {
            try {
                const r = await fetch(`/api/groups/${groupId}/charge-quote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
                    body: JSON.stringify({ schoolId, startDate, studentId }),
                });
                const j = await r.json();
                if (!off && r.ok) setTaklif(j);
            } catch { /* taklifsiz ham qo'lda yozsa bo'ladi */ }
        })();
        return () => { off = true; };
    }, [groupId, schoolId, startDate, studentId]);

    if (trial) {
        return <p className="text-[10px] font-bold text-matn-xira">Sinov — hisob Faol qilinganda yoziladi</p>;
    }
    const korinadi = value !== undefined ? String(value) : (taklif?.suggested != null ? String(taklif.suggested) : '');
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-matn-xira truncate">{label || 'Birinchi oy summasi'}</span>
                <input type="number" min={0} inputMode="numeric" value={korinadi}
                    placeholder={taklif?.suggested == null ? 'summa' : ''}
                    onChange={e => onChange(e.target.value === '' ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    className={`num w-32 shrink-0 px-3 py-2 bg-sirt border rounded-xl text-xs font-bold text-right tabular-nums outline-none focus:border-brand ${value !== undefined ? 'border-brand text-brand' : 'border-chiziq text-matn'}`} />
            </div>
            <p className="flex items-center justify-between gap-2 text-[10px] font-medium text-matn-xira mt-1">
                <span>
                    {taklif?.suggested != null
                        ? `Tizim hisobi: ${taklif.suggested.toLocaleString('ru-RU')} (${taklif.lessons} dars, oylik ${taklif.price.toLocaleString('ru-RU')})`
                        : taklif ? 'Jadval yo\'q — summani yozing' : 'Hisoblanmoqda…'}
                </span>
                {value !== undefined && taklif?.suggested != null && (
                    <button type="button" onClick={() => onChange(undefined)} className="font-bold text-brand hover:underline cursor-pointer shrink-0">hisoblangani</button>
                )}
            </p>
        </div>
    );
}
