import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ─── Stat Card ────────────────────────────────────────────────
interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    trend?: number; // positive = good, negative = bad
    icon: React.ReactNode;
    color?: string;
}
export function StatCard({ label, value, sub, trend, icon, color = 'sky' }: StatCardProps) {
    const colorMap: Record<string, string> = {
        sky: 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
        amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        violet: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
        gray: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
    };
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.sky}`}>
                    {icon}
                </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums leading-none">{value}</p>
            <div className="flex items-center gap-2">
                {trend !== undefined && (
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${trend >= 0 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30' : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30'}`}>
                        {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {Math.abs(trend)}%
                    </span>
                )}
                {sub && <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{sub}</span>}
            </div>
        </div>
    );
}

// ─── Bar Chart (SVG) ──────────────────────────────────────────
interface BarChartProps {
    data: { label: string; value: number; color?: string }[];
    height?: number;
    unit?: string;
    horizontal?: boolean;
}
export function BarChart({ data, height = 180, unit = '', horizontal = false }: BarChartProps) {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    if (horizontal) {
        return (
            <div className="space-y-3">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest w-28 shrink-0 truncate">{d.label}</span>
                        <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden">
                            <div
                                className="h-full rounded-xl transition-all duration-700"
                                style={{
                                    width: `${(d.value / maxVal) * 100}%`,
                                    background: d.color || 'linear-gradient(90deg,#0ea5e9,#6366f1)'
                                }}
                            />
                        </div>
                        <span className="text-[10px] font-extrabold text-gray-700 dark:text-gray-300 w-16 text-right tabular-nums shrink-0">
                            {d.value.toLocaleString()}{unit}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="flex items-end gap-3" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                    <div
                        className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                        {d.value.toLocaleString()}{unit}
                    </div>
                    <div
                        className="w-full rounded-2xl transition-all duration-700 hover:opacity-80 cursor-pointer"
                        style={{
                            height: `${(d.value / maxVal) * (height - 32)}px`,
                            background: d.color || 'linear-gradient(180deg,#0ea5e9,#6366f1)'
                        }}
                    />
                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest text-center leading-tight">{d.label}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Donut Chart (SVG) ────────────────────────────────────────
interface DonutSlice { label: string; value: number; color: string }
export function DonutChart({ slices, size = 160 }: { slices: DonutSlice[]; size?: number }) {
    const total = slices.reduce((s, d) => s + d.value, 0) || 1;
    const r = 56, cx = size / 2, cy = size / 2, strokeW = 18;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="flex items-center gap-6">
            <svg width={size} height={size} className="shrink-0">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={strokeW} className="text-gray-100 dark:text-gray-800" />
                {slices.map((s, i) => {
                    const pct = s.value / total;
                    const dashArray = `${circumference * pct} ${circumference * (1 - pct)}`;
                    const el = (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={strokeW}
                            strokeDasharray={dashArray}
                            strokeDashoffset={-circumference * offset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dasharray 0.7s ease' }}
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                    );
                    offset += pct;
                    return el;
                })}
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-gray-900 dark:fill-white text-sm font-extrabold" style={{ fontSize: 18, fontWeight: 800 }}>{total.toLocaleString()}</text>
                <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 8, fontWeight: 700, fill: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>JAMI</text>
            </svg>
            <div className="space-y-2">
                {slices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{s.label}</span>
                        <span className="text-[10px] font-extrabold text-gray-900 dark:text-white ml-1">{s.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Line Chart (SVG) ─────────────────────────────────────────
interface LineChartProps {
    data: { label: string; value: number }[];
    color?: string;
    height?: number;
    unit?: string;
}
export function LineChart({ data, color = '#0ea5e9', height = 140, unit = '' }: LineChartProps) {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const minVal = Math.min(...data.map(d => d.value), 0);
    const range = maxVal - minVal || 1;
    const w = 500, h = height - 32;
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((d.value - minVal) / range) * h;
        return `${x},${y}`;
    }).join(' ');
    const areaPoints = `0,${h} ${points} ${w},${h}`;
    return (
        <div>
            <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full overflow-visible" style={{ height }}>
                <defs>
                    <linearGradient id={`lg-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={areaPoints} fill={`url(#lg-${color})`} />
                <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {data.map((d, i) => {
                    const x = (i / (data.length - 1)) * w;
                    const y = h - ((d.value - minVal) / range) * h;
                    return <circle key={i} cx={x} cy={y} r={5} fill={color} stroke="white" strokeWidth={2} />;
                })}
            </svg>
            <div className="flex justify-between mt-2">
                {data.map((d, i) => (
                    <span key={i} className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest text-center" style={{ width: `${100 / data.length}%` }}>{d.label}</span>
                ))}
            </div>
        </div>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────
export function ProgressBar({ value, max, color = '#0ea5e9', label, sub }: { value: number; max: number; color?: string; label: string; sub?: string }) {
    const pct = Math.round((value / (max || 1)) * 100);
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between">
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">{label}</span>
                <span className="text-[10px] font-extrabold tabular-nums" style={{ color }}>{pct}%{sub ? ` · ${sub}` : ''}</span>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────
export function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-5">
            <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                {sub && <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{sub}</p>}
            </div>
            {action}
        </div>
    );
}

// ─── Report Card Wrapper ──────────────────────────────────────
export function ReportCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm ${className}`}>
            {children}
        </div>
    );
}

// ─── Empty State ──────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
            </div>
            <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{message}</p>
        </div>
    );
}

// ─── Data Table ───────────────────────────────────────────────
interface TableColumn<T> { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode }
export function DataTable<T extends Record<string, any>>({ columns, rows, maxRows = 10 }: { columns: TableColumn<T>[]; rows: T[]; maxRows?: number }) {
    const [page, setPage] = React.useState(0);
    const pageRows = rows.slice(page * maxRows, (page + 1) * maxRows);
    const totalPages = Math.ceil(rows.length / maxRows);
    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                            {columns.map(c => (
                                <th key={String(c.key)} className="py-3 px-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {pageRows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/10 transition-colors">
                                {columns.map(c => (
                                    <td key={String(c.key)} className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {c.render ? c.render(row) : String(row[c.key as keyof T] ?? '-')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {pageRows.length === 0 && (
                            <tr><td colSpan={columns.length} className="py-10 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hech qanday ma'lumot topilmadi</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-4">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{rows.length} ta yozuv</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Oldin</button>
                        <span className="px-3 py-1.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">{page + 1}/{totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Keyin</button>
                    </div>
                </div>
            )}
        </div>
    );
}
