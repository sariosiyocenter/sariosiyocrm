import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { QoidaKartasi } from './QoidaKartasi';

/**
 * Xabarlar → Avtomatik → Transport (2026-09-27). Haydovchi botda
 * "Qabul qildim" (bolalar mashinada) va "Yetkazdim" (uyiga yetkazildi)
 * bosganda ota-onaga darhol xabar — services/transportNotify.js.
 *
 * Egasi: "bu ham xabarlardagi avtomatika bo'lsin, lekin hozircha o'chiq
 * turadi — sinab ko'ramiz, keyin o'zim yoqaman". Sozlama o'zi —
 * Setting.transportNotify va transportChannel (filial bo'yicha); ilgari faqat
 * Sozlamalar → Transport xabarlari da edi, endi shu yerda ham.
 */

const KANAL: Record<string, string> = {
    TELEGRAM: 'Telegram (bepul)',
    BOTH: 'Telegram, ulanmagan bo\'lsa SMS',
    SMS: 'SMS',
};

const NAMUNA = "🚌 Elyorbek 18:12 da olib ketildi (Damas, Alijon aka)\n🏠 Elyorbek 18:47 da uyiga yetkazildi (Damas, Alijon aka)";

export function TransportQoidaKartasi({ onTahrir }: { onTahrir: () => void }) {
    const { settings, updateSettings, ozgartira, showNotification } = useCRM();
    const tahrir = ozgartira('sozlamalar.avto');
    const yoqilgan = !!settings?.transportNotify;
    const kanal = settings?.transportChannel || 'TELEGRAM';
    const [band, setBand] = useState(false);
    const almashtir = async () => {
        setBand(true);
        try {
            await updateSettings({ transportNotify: !yoqilgan } as any);
            showNotification(!yoqilgan ? 'Transport xabari yoqildi' : "Transport xabari o'chirildi", 'success');
        } catch (e: any) {
            showNotification(e.message || 'Saqlanmadi', 'error');
        } finally {
            setBand(false);
        }
    };
    return (
        <QoidaKartasi
            icon="🚌" label="Transport" color="bg-cyan-100 dark:bg-cyan-950/30 text-cyan-500"
            nom="Haydovchi «Qabul qildim» / «Yetkazdim» bosganda — ota-onaga"
            meta={[
                { k: 'Kanal', v: KANAL[kanal] || kanal },
                { k: 'Vaqt', v: 'darhol' },
                { k: 'Kimga', v: 'transportdagi bolaning ota-onasi', keng: true },
            ]}
            matn={NAMUNA}
            yoqilgan={yoqilgan} onToggle={almashtir} onEdit={onTahrir} tahrir={tahrir} band={band}
        />
    );
}

export function TransportQoidaFormasi({ onClose, onSaqlandi }: { onClose: () => void; onSaqlandi: () => void }) {
    const { settings, updateSettings, ozgartira, showNotification } = useCRM();
    const tahrir = ozgartira('sozlamalar.avto');
    const [yoqilgan, setYoqilgan] = useState(!!settings?.transportNotify);
    const [kanal, setKanal] = useState<string>(settings?.transportChannel || 'TELEGRAM');
    const [band, setBand] = useState(false);
    const saqla = async () => {
        setBand(true);
        try {
            await updateSettings({ transportNotify: yoqilgan, transportChannel: kanal } as any);
            showNotification('Saqlandi', 'success');
            onSaqlandi();
        } catch (e: any) {
            showNotification(e.message || 'Saqlanmadi', 'error');
        } finally {
            setBand(false);
        }
    };
    return (
        <div className="space-y-4">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Haydovchi bolalarni mashinaga olib botda «Qabul qildim» bosganda — «olib ketildi», uyiga yetkazib «Yetkazdim»
                bosganda — «uyiga yetkazildi» xabari ota-onaga darhol ketadi. Rejaga qo'shilgan bolaning ota-onasiga yo'l haqi
                ham shu sozlama bilan aytiladi.
            </p>
            <div className="text-[12px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                {NAMUNA}
            </div>
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer">
                <span className="text-[12px] font-extrabold text-slate-700 dark:text-slate-200">Ota-onaga yuborilsin</span>
                <input type="checkbox" checked={yoqilgan} disabled={!tahrir} onChange={e => setYoqilgan(e.target.checked)} className="w-5 h-5 accent-[#1b6b6b] cursor-pointer" />
            </label>
            <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Kanal</label>
                <select value={kanal} disabled={!tahrir} onChange={e => setKanal(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[12px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-brand">
                    <option value="TELEGRAM">Faqat Telegram (bepul)</option>
                    <option value="BOTH">Telegram, ulanmagan bo'lsa SMS</option>
                    <option value="SMS">Faqat SMS (pullik)</option>
                </select>
                <p className="mt-1.5 text-[10.5px] font-bold text-slate-400">SMS har xabar uchun pul yechadi — kuniga ikki marta, har bolaga.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-[11px] font-extrabold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Bekor qilish</button>
                {tahrir && (
                    <button type="button" onClick={saqla} disabled={band}
                        className="px-5 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-extrabold flex items-center gap-2 cursor-pointer">
                        {band && <Loader2 size={13} className="animate-spin" />} Saqlash
                    </button>
                )}
            </div>
        </div>
    );
}
