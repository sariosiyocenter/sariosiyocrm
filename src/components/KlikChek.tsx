import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { compressImage } from '../lib/image';

/**
 * Klik to'lovi — administrator tasdig'i bilan (egasi, 2026-09-24):
 * "chekni ko'rsatganda to'langan sana vaqti kiritiladi, adminga shu
 * yuboriladi, admin ko'rib tasdiqlaydi".
 *
 * Xodim chekdagi sana-vaqtni (va xohlasa chek rasmini) kiritadi, to'lov
 * /api/tolov-tasdiq ga "kutilmoqda" bo'lib tushadi. Balansga faqat admin
 * tasdiqlagach o'tadi (CRM da yoki Telegram'da). Administratorning o'zi
 * kiritsa — darhol balansga (u tasdiqlovchining o'zi).
 *
 * Vaqt (egasi, 2026-09-26: "kompda yaxshi lekin telefon qiyin"): datetime-local
 * o'rniga kun tugmalari (Bugun / Kecha / boshqa kun) va soat — raqam
 * klaviaturasida 4 ta raqam ("2206" → 22:06). Soat oldindan qo'yilmaydi:
 * xodim uni chekdan o'qib yozadi — takroriy chek shu vaqt bo'yicha topiladi.
 *
 * Moliya va o'quvchi kartasidagi to'lov oynalari shu bitta komponentdan
 * foydalanadi — ikkala joyda qoida bir xil.
 */

/** Shu usullar tasdiqdan o'tadi (server: KLIK_TASDIQ_TURLARI). */
export const TASDIQ_TURLARI = ['Klik'];

const p2 = (n: number) => String(n).padStart(2, '0');
const sanaStr = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Brauzer vaqti "YYYY-MM-DDTHH:mm". */
export function hozirgiVaqt(d = new Date()) {
    return `${sanaStr(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export const isAdminRole = (role?: string) => role === 'ADMIN' || role === 'SUPERADMIN';

const SOAT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Yozilgan raqamlardan "SS:DD": "2206" → "22:06", "930" → "09:30". */
function soatniYoz(raw: string) {
    let d = raw.replace(/\D/g, '');
    if (d.length && Number(d[0]) > 2) d = '0' + d;
    d = d.slice(0, 4);
    return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function KlikChekMaydonlari({ paidAt, setPaidAt, receipt, setReceipt, admin, labelCls, inputCls, schoolId, studentId, amount }: {
    paidAt: string;
    setPaidAt: (v: string) => void;
    receipt: string | null;
    setReceipt: (v: string | null) => void;
    admin: boolean;
    labelCls: string;
    inputCls: string;
    /** Takroriy chekni tekshirish uchun (o'quvchi tanlangach). */
    schoolId?: number | null;
    studentId?: number | null;
    amount?: number;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const bugun = sanaStr(new Date());
    const kecha = sanaStr(new Date(Date.now() - 86400000));

    // Sana va soat alohida turadi: soat to'liq yozilmaguncha ota komponent
    // bo'sh qiymat oladi (to'liq bo'lmagan vaqt yuborilmaydi).
    const [sana, setSana] = useState(paidAt ? paidAt.slice(0, 10) : bugun);
    const [soat, setSoat] = useState(paidAt ? paidAt.slice(11, 16) : '');
    const [boshqaKun, setBoshqaKun] = useState(!!paidAt && ![bugun, kecha].includes(paidAt.slice(0, 10)));
    const [takror, setTakror] = useState<string[]>([]);

    const kelajak = sana === bugun && SOAT_RE.test(soat) && soat > `${p2(new Date().getHours())}:${p2(new Date().getMinutes())}`;
    const togri = !!sana && sana <= bugun && SOAT_RE.test(soat) && !kelajak;

    useEffect(() => {
        const v = togri ? `${sana}T${soat}` : '';
        if (v !== paidAt) setPaidAt(v);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sana, soat, togri]);

    // Shu chek avval kiritilganmi — vaqt to'liq yozilishi bilan so'raladi.
    useEffect(() => {
        setTakror([]);
        if (!togri || !schoolId || !studentId) return;
        let off = false;
        const t = setTimeout(async () => {
            try {
                const q = new URLSearchParams({ schoolId: String(schoolId), studentId: String(studentId), paidAt: `${sana}T${soat}`, amount: String(amount || 0) });
                const r = await fetch(`/api/tolov-tasdiq/takror?${q}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                const j = r.ok ? await r.json() : null;
                if (!off && Array.isArray(j?.takror)) setTakror(j.takror);
            } catch { /* tekshiruv — ixtiyoriy */ }
        }, 350);
        return () => { off = true; clearTimeout(t); };
    }, [togri, sana, soat, schoolId, studentId, amount]);

    const rasmTanlandi = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        // Chekdagi yozuv o'qilishi kerak — profil suratidan kattaroq o'lcham.
        reader.onload = async () => setReceipt(await compressImage(String(reader.result), 1400, 1400, 0.82));
        reader.readAsDataURL(file);
    };

    const kunTugmasi = (faol: boolean) =>
        `flex-1 py-2.5 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${faol ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`;

    return (
        <div className="space-y-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 leading-relaxed flex gap-2">
                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                {admin
                    ? "Siz administratorsiz — to'lov darhol balansga tushadi. Chekdagi vaqt izohga yoziladi."
                    : "Klik to'lovi administrator tasdiqlagach balansga tushadi. Chekdagi to'langan kun va soatni kiriting."}
            </p>

            <div>
                <label className={labelCls}>Chekdagi kun {admin ? '' : '*'}</label>
                <div className="flex gap-2">
                    <button type="button" className={kunTugmasi(!boshqaKun && sana === bugun)} onClick={() => { setBoshqaKun(false); setSana(bugun); }}>Bugun</button>
                    <button type="button" className={kunTugmasi(!boshqaKun && sana === kecha)} onClick={() => { setBoshqaKun(false); setSana(kecha); }}>Kecha</button>
                    <button type="button" className={kunTugmasi(boshqaKun)} onClick={() => setBoshqaKun(true)}>Boshqa kun</button>
                </div>
                {boshqaKun && (
                    <input type="date" className={`${inputCls} mt-2`} value={sana} max={bugun}
                        onChange={e => setSana(e.target.value)} />
                )}
            </div>

            <div>
                <label className={labelCls}>Chekdagi soat {admin ? '' : '*'}</label>
                <input type="text" inputMode="numeric" autoComplete="off" enterKeyHint="done" maxLength={5}
                    placeholder="14:32" value={soat}
                    onChange={e => setSoat(soatniYoz(e.target.value))}
                    className={`${inputCls} text-center !text-lg tracking-widest num`} />
                <p className={`mt-1.5 text-[10.5px] font-bold ${kelajak || (soat.length === 5 && !SOAT_RE.test(soat)) ? 'text-rose-600' : 'text-matn-xira'}`}>
                    {kelajak ? 'Bu vaqt hali kelmagan — chekdagi vaqtni tekshiring'
                        : soat.length === 5 && !SOAT_RE.test(soat) ? "Soat noto'g'ri (00:00 – 23:59)"
                        : "4 ta raqam yozing: 2206 → 22:06"}
                </p>
            </div>

            {takror.length > 0 && (
                <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-black text-rose-700 dark:text-rose-300">
                        <AlertTriangle size={14} /> Diqqat — takror chek
                    </p>
                    {takror.map((t, i) => (
                        <p key={i} className="text-[11px] font-bold text-rose-700/90 dark:text-rose-300/90 leading-relaxed">• {t}</p>
                    ))}
                    <p className="text-[10.5px] font-bold text-rose-600/80 dark:text-rose-400/80">
                        {admin ? "Pul ikkinchi marta tushmasligi uchun bank ilovasini tekshiring." : "Yuborsangiz administrator bu haqda ogohlantiriladi."}
                    </p>
                </div>
            )}

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

/**
 * Yuborilgandan keyingi xabar: Telegram'ga ketdimi, takror bormi.
 * `data` — POST /api/tolov-tasdiq javobi.
 */
export function yuborishNatijasi(type: string, data: any): { matn: string; tur: 'success' | 'info' | 'error' } {
    const tg = data?.telegram;
    const takror = Array.isArray(data?.takror) && data.takror.length > 0;
    let matn = `${type} to'lovi administrator tasdig'iga yuborildi`;
    matn += tg?.yuborildi > 0 ? " — Telegram'da xabar bordi" : ` — tasdiqlangach balansga tushadi${tg?.sabab ? ` (Telegram: ${tg.sabab})` : ''}`;
    if (takror) matn += '. Diqqat: bu chek avval ham kiritilgan — administrator ogohlantirildi';
    return { matn, tur: takror ? 'error' : 'success' };
}

/** Chekdagi vaqt "24.09.2026 14:32" ko'rinishida. */
export const chekVaqti = (s?: string | null) =>
    s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}` : '';
