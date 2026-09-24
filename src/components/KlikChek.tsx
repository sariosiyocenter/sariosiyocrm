import React, { useRef } from 'react';
import { Camera, X, ShieldCheck } from 'lucide-react';
import { compressImage } from '../lib/image';

/**
 * Klik to'lovi — administrator tasdig'i bilan (egasi, 2026-09-24):
 * "chekni ko'rsatganda to'langan sana vaqti kiritiladi, adminga shu
 * yuboriladi, admin ko'rib tasdiqlaydi".
 *
 * Xodim chekdagi sana-vaqtni (va xohlasa chek rasmini) kiritadi, to'lov
 * /api/tolov-tasdiq ga "kutilmoqda" bo'lib tushadi. Balansga faqat admin
 * Moliya sahifasida tasdiqlagach o'tadi. Administratorning o'zi kiritsa —
 * darhol balansga (u tasdiqlovchining o'zi).
 *
 * Moliya va o'quvchi kartasidagi to'lov oynalari shu bitta komponentdan
 * foydalanadi — ikkala joyda qoida bir xil.
 */

/** Shu usullar tasdiqdan o'tadi (server: KLIK_TASDIQ_TURLARI). */
export const TASDIQ_TURLARI = ['Klik'];

/** Brauzer vaqti "YYYY-MM-DDTHH:mm" — datetime-local uchun. */
export function hozirgiVaqt(d = new Date()) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const isAdminRole = (role?: string) => role === 'ADMIN' || role === 'SUPERADMIN';

export function KlikChekMaydonlari({ paidAt, setPaidAt, receipt, setReceipt, admin, labelCls, inputCls }: {
    paidAt: string;
    setPaidAt: (v: string) => void;
    receipt: string | null;
    setReceipt: (v: string | null) => void;
    admin: boolean;
    labelCls: string;
    inputCls: string;
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    const rasmTanlandi = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        // Chekdagi yozuv o'qilishi kerak — profil suratidan kattaroq o'lcham.
        reader.onload = async () => setReceipt(await compressImage(String(reader.result), 1400, 1400, 0.82));
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 leading-relaxed flex gap-2">
                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                {admin
                    ? "Siz administratorsiz — to'lov darhol balansga tushadi. Chekdagi vaqt izohga yoziladi."
                    : "Klik to'lovi administrator tasdiqlagach balansga tushadi. Chekdagi to'langan sana va vaqtni kiriting."}
            </p>
            <div>
                <label className={labelCls}>Chekdagi to'langan sana va vaqt {admin ? '' : '*'}</label>
                <input type="datetime-local" className={inputCls} value={paidAt} max={hozirgiVaqt()}
                    onChange={e => setPaidAt(e.target.value)} required={!admin} />
            </div>
            <div>
                <label className={labelCls}>Chek rasmi (ixtiyoriy)</label>
                {receipt ? (
                    <div className="flex items-center gap-3">
                        <img src={receipt} alt="Chek" className="w-16 h-16 object-cover rounded-xl border border-chiziq" />
                        <button type="button" onClick={() => setReceipt(null)}
                            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer">
                            <X size={12} /> Olib tashlash
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={() => fileRef.current?.click()}
                        className="w-full py-2.5 rounded-xl border border-dashed border-chiziq bg-sirt text-[11px] font-bold text-matn-sokin hover:border-brand hover:text-brand flex items-center justify-center gap-2 cursor-pointer">
                        <Camera size={14} /> Chekni suratga olish / yuklash
                    </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={rasmTanlandi} />
            </div>
        </div>
    );
}

/** Tasdiqqa yuborish (admin bo'lmagan xodim). */
export async function klikniYuborish(body: {
    schoolId: number | null | undefined; studentId: number; amount: number; type: string;
    paidAt: string; receipt: string | null; note?: string;
}) {
    const res = await fetch('/api/tolov-tasdiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Tasdiqqa yuborib bo'lmadi");
    return data;
}

/** Chekdagi vaqt "24.09.2026 14:32" ko'rinishida. */
export const chekVaqti = (s?: string | null) =>
    s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}` : '';
