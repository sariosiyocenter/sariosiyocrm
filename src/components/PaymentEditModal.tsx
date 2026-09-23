import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import type { Payment } from '../types';

/**
 * To'lovni tahrirlash oynasi.
 *
 * Egasi (2026-09-22): "resepshnga to'lovni tahrirlash imkoni faqat to'lov
 * qilingandan keyin 10 minut iloji bo'lsin — to'lov usuli yoki umuman
 * summani o'zgartirishi. Adminda har doim bo'lsin."
 *
 * Shuning uchun tugma ham, server ham bitta qoidaga tayanadi: yozuv bazaga
 * tushgan vaqt (`Payment.createdAt`) dan 10 daqiqa. Tizim yozgan oylik
 * hisob, chegirma, qaytarish va Payme orqali kelgan pul tahrirlanmaydi —
 * ular boshqa joydagi hisobga bog'langan.
 */

const OYNA_MS = 10 * 60 * 1000;

/** Kassa usullari — faqat shular orasida almashtiriladi. */
export const TOLOV_USULLARI = ['Naqd', 'Karta', "O'tkazma", 'Klik'];

export function canEditPayment(p: Payment, role?: string): boolean {
    if (!TOLOV_USULLARI.includes(p.type)) return false;
    if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
    if (role !== 'MANAGER' && role !== 'RECEPTIONIST') return false;
    if (!p.createdAt) return false;
    return Date.now() - new Date(p.createdAt).getTime() < OYNA_MS;
}

/** Tahrirlashga qancha daqiqa qolgani (admin uchun null — cheklov yo'q). */
export function editMinutesLeft(p: Payment, role?: string): number | null {
    if (role === 'ADMIN' || role === 'SUPERADMIN') return null;
    if (!p.createdAt) return 0;
    return Math.max(0, Math.ceil((OYNA_MS - (Date.now() - new Date(p.createdAt).getTime())) / 60000));
}

export default function PaymentEditModal({ payment, onClose, onSaved }: {
    payment: Payment;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { showNotification, user } = useCRM();
    const [amount, setAmount] = useState(String(payment.amount));
    const [type, setType] = useState(TOLOV_USULLARI.includes(payment.type) ? payment.type : 'Naqd');
    const [date, setDate] = useState(payment.date);
    const [saving, setSaving] = useState(false);

    const qolgan = editMinutesLeft(payment, user?.role);

    const saqlash = async () => {
        if (saving) return;
        const son = Number(amount);
        if (!Number.isFinite(son) || son <= 0) {
            showNotification("Summa noto'g'ri", 'error');
            return;
        }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/payments/${payment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ schoolId: payment.schoolId, amount: son, type, date }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { showNotification(data.error || "To'lov saqlanmadi", 'error'); return; }
            showNotification("To'lov tahrirlandi", 'success');
            onSaved();
            onClose();
        } catch {
            showNotification('Aloqa xatosi', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-chiziq">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                    <div>
                        <h3 className="text-sm font-black text-matn tracking-tight">To'lovni tahrirlash</h3>
                        <p className="num text-[11px] font-bold text-brand mt-0.5">
                            #{payment.id} · {payment.date} · {payment.amount.toLocaleString('ru-RU')} so'm
                        </p>
                    </div>
                    <button aria-label="Yopish" onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">Summa (UZS)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                            className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">To'lov usuli</label>
                        <div className="grid grid-cols-2 gap-2">
                            {TOLOV_USULLARI.map(tur => (
                                <button key={tur} type="button" onClick={() => setType(tur as Payment['type'])}
                                    className={`py-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                        type === tur ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira hover:text-brand'
                                    }`}>
                                    {tur}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">Sana</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all" />
                    </div>

                    <p className="text-[10px] font-bold text-matn-xira leading-relaxed">
                        {qolgan === null
                            ? "Administrator to'lovni har doim tahrirlay oladi. O'zgartirish amallar jurnaliga yoziladi."
                            : `Tahrirlashga ${qolgan} daqiqa qoldi — to'lov kiritilgandan keyin 10 daqiqa.`}
                    </p>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            Bekor
                        </button>
                        <button type="button" onClick={saqlash} disabled={saving}
                            className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
