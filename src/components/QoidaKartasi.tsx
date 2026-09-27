import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

/**
 * Xabarlar → Avtomatik dagi bitta qoida kartasi. Oddiy qoidalar (tug'ilgan
 * kun, imtihon, …) ham, "darhol" qoidalar (to'lov, davomat) va qarz eslatmasi
 * ham bir xil ko'rinishda — egasi (2026-09-27): "nimaga alohida qilding,
 * trigger qo'shsang bo'lmasmidi?".
 *
 * Tahrirlash va o'chirish tugmalari doim ko'rinadi: telefonda hover yo'q.
 */
export interface QoidaMeta { k: string; v: React.ReactNode; keng?: boolean }

export function QoidaKartasi({
    icon, label, color, nom, meta, matn, holat, qoshimcha,
    yoqilgan, onToggle, onEdit, onDelete, tahrir, band = false,
}: {
    icon: string;
    label: string;
    color: string;
    nom: React.ReactNode;
    meta: QoidaMeta[];
    matn?: React.ReactNode;
    holat?: React.ReactNode;
    qoshimcha?: React.ReactNode;
    yoqilgan: boolean;
    onToggle?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    tahrir: boolean;
    band?: boolean;
}) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[11px] ${color}`}>{icon}</div>
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-55 dark:bg-slate-800 text-slate-500 dark:text-slate-450 border border-slate-100 dark:border-slate-700 truncate">
                            {label}
                        </span>
                    </div>
                    {tahrir && (onEdit || onDelete) && (
                        <div className="flex items-center gap-0.5 shrink-0">
                            {onEdit && (
                                <button type="button" aria-label="Tahrirlash" title="Tahrirlash" onClick={onEdit}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                    <Edit size={13} />
                                </button>
                            )}
                            {onDelete && (
                                <button type="button" aria-label="O'chirish" title="O'chirish" onClick={onDelete}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <h3 className="text-xs font-black text-slate-855 dark:text-white tracking-wide">{nom}</h3>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {meta.map((m, i) => (
                        <div key={i} className={m.keng ? 'col-span-2' : ''}>
                            {m.k}: <span className="font-bold text-slate-700 dark:text-slate-300">{m.v}</span>
                        </div>
                    ))}
                </div>

                {matn && (
                    <div className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed line-clamp-4">{matn}</div>
                )}
                {holat}
                {qoshimcha}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    Holati: {yoqilgan ? <span className="text-emerald-500">Faol</span> : <span className="text-slate-400">O'chirilgan</span>}
                </span>
                <button
                    type="button"
                    disabled={!tahrir || band || !onToggle}
                    onClick={onToggle}
                    aria-pressed={yoqilgan}
                    aria-label={yoqilgan ? "O'chirish" : 'Yoqish'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none disabled:cursor-default disabled:opacity-60 ${yoqilgan ? 'bg-brand-dark' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${yoqilgan ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </div>
        </div>
    );
}
