import React from 'react';

/**
 * Xodim qaysi filiallarda ishlaydi — galochkalar. HR ro'yxatidagi tahrirlash
 * oynasida ham, xodim profilidagi "Tahrirlash"da ham bir xil ko'rinadi.
 *
 * Asosiy filial: joriysi (hali belgilangan bo'lsa) yoki birinchi belgilangani —
 * server ham shunday tanlaydi. Oylik va davomat o'sha filialda yuritiladi.
 */
export default function BranchCheckboxes({ branches, value, currentPrimaryId, role, onChange, labelClassName }: {
    branches: { id: number; name: string }[];
    value: number[];
    currentPrimaryId?: number | null;
    role?: string;
    onChange: (ids: number[]) => void;
    labelClassName: string;
}) {
    const asosiyId = currentPrimaryId && value.includes(currentPrimaryId) ? currentPrimaryId : value[0];
    const nomi = (id: number) => branches.find(b => b.id === id)?.name || '';
    const toggle = (id: number) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

    return (
        <div>
            <label className={labelClassName}>Qaysi filiallarda ishlaydi? *</label>
            <div className="flex flex-wrap gap-2">
                {branches.map(b => {
                    const checked = value.includes(b.id);
                    return (
                        <label key={b.id}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none ${checked
                                ? 'bg-brand/10 border-brand text-brand'
                                : 'bg-ichki border-chiziq text-matn-sokin hover:border-brand'}`}>
                            <input type="checkbox" className="w-4 h-4 accent-[#1b6b6b] cursor-pointer"
                                checked={checked} onChange={() => toggle(b.id)} />
                            {b.name}
                            {checked && value.length > 1 && asosiyId === b.id && (
                                <span className="text-[10px] font-semibold text-matn-xira">(asosiy)</span>
                            )}
                        </label>
                    );
                })}
            </div>
            <p className={`text-[11px] mt-1.5 ${value.length ? 'text-matn-xira' : 'text-rose-500 font-bold'}`}>
                {!value.length
                    ? 'Kamida bitta filialni belgilang'
                    : role === 'ADMIN'
                        ? "Administrator barcha filiallarni ko'radi."
                        : value.length > 1
                            ? `Xodim tizimga kirganda tepada filial tanlagichi chiqadi. Oylik va davomat asosiy filialda (${nomi(asosiyId)}) yuritiladi.`
                            : "Xodim faqat shu filial ma'lumotlarini ko'radi."}
            </p>
        </div>
    );
}
