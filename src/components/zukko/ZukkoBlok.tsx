import { useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, Copy, CornerDownLeft, DoorOpen, Phone, Receipt, Sparkles, Target, Wallet } from 'lucide-react';
import { Blok, Qator, Ton, blokMatni } from './zukkoApi';

// Zukko javobining manbasi: vosita bazadan o'qigan ma'lumot kartochkasi.
// AI aytgan har bir raqam shu yerda tekshiriladi, qatorlar bosilsa tegishli
// sahifa ochiladi.

export const tonRangi = (t: Ton) =>
    t === 'xato' ? 'text-xato' : t === 'ogoh' ? 'text-ogoh' : t === 'yaxshi' ? 'text-yaxshi' : t === 'brand' ? 'text-brand' : t === 'sokin' ? 'text-matn-xira' : 'text-matn';

const OYLAR = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const somFmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

function nuqtaNomi(x: string) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(x);
    if (!m) return x;
    return m[3] ? `${Number(m[3])}-${OYLAR[Number(m[2]) - 1]}` : `${OYLAR[Number(m[2]) - 1]} ${m[1]}`;
}

function MiniGrafik({ nuqtalar }: { nuqtalar: { x: string; y: number }[] }) {
    const max = Math.max(...nuqtalar.map(n => n.y), 1);
    const oxirgi = (() => { for (let i = nuqtalar.length - 1; i >= 0; i--) if (nuqtalar[i].y > 0) return i; return nuqtalar.length - 1; })();
    const [faol, setFaol] = useState<number | null>(null);
    const i = faol ?? oxirgi;
    return (
        <div className="px-3 pt-2.5 pb-3 border-b border-chiziq-mayin">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-matn-sokin">{nuqtaNomi(nuqtalar[i].x)}</span>
                <span className="num font-semibold text-matn">{somFmt(nuqtalar[i].y)}</span>
            </div>
            <div className="mt-1.5 flex items-end gap-[2px] h-14" onMouseLeave={() => setFaol(null)}>
                {nuqtalar.map((n, j) => (
                    <div
                        key={n.x}
                        onMouseEnter={() => setFaol(j)}
                        onClick={() => setFaol(j)}
                        title={`${nuqtaNomi(n.x)}: ${somFmt(n.y)}`}
                        className="flex-1 min-w-0 rounded-t-[2px] zk-ustun cursor-pointer"
                        style={{
                            height: `${Math.max(4, (n.y / max) * 100)}%`,
                            background: j === i ? 'var(--color-brand)' : n.y > 0 ? 'color-mix(in srgb, var(--color-brand) 32%, transparent)' : 'var(--color-chiziq)',
                            animationDelay: `${Math.min(j * 10, 400)}ms`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function QatorBelgisi({ q }: { q: Qator }) {
    const quti = 'w-7 h-7 rounded-lg flex items-center justify-center shrink-0';
    if (q.tur === 'oquvchi') {
        const harflar = q.nom.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
        return <span className={`${quti} rounded-full bg-brand/10 text-brand text-[10.5px] font-semibold`}>{harflar || '?'}</span>;
    }
    if (q.tur === 'kurs') return <span className={`${quti} bg-brand-accent/12 text-brand-accent`}><BookOpen size={14} /></span>;
    if (q.tur === 'lid') return <span className={`${quti} bg-ogoh-fon text-ogoh`}><Target size={14} /></span>;
    if (q.tur === 'tolov') return <span className={`${quti} bg-yaxshi-fon text-yaxshi`}><Wallet size={14} /></span>;
    if (q.tur === 'xarajat') return <span className={`${quti} bg-xato-fon text-xato`}><Receipt size={14} /></span>;
    if (q.tur === 'xona') return <span className={`${quti} bg-ichki text-matn-sokin`}><DoorOpen size={14} /></span>;
    if (q.tur === 'misol') return <span className={`${quti} bg-brand/10 text-brand`}><Sparkles size={13} /></span>;
    return <span className={`${quti} bg-ichki`} />;
}

const KORINADI = 6;

export default function ZukkoBlok({ blok, vaqt, onHavola, onSavol }: { blok: Blok; vaqt?: number; onHavola: (yol: string) => void; onSavol?: (matn: string) => void }) {
    const [nusxa, setNusxa] = useState(false);
    const [ochiq, setOchiq] = useState<Record<number, boolean>>({});
    const soat = vaqt ? new Date(vaqt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;

    const nusxala = async () => {
        try {
            await navigator.clipboard.writeText(blokMatni(blok));
            setNusxa(true);
            setTimeout(() => setNusxa(false), 1500);
        } catch { /* brauzer ruxsat bermadi */ }
    };

    const karta = blok.tur === 'karta';
    const harflar = karta ? blok.sarlavha.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() : '';

    return (
        <div className="rounded-xl border border-chiziq bg-sirt overflow-hidden zk-kirish">
            <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-2">
                {karta && (
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-accent text-brand-ust text-[12px] font-semibold flex items-center justify-center shrink-0">{harflar}</span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="font-mono text-[9.5px] tracking-[0.08em] uppercase text-matn-xira">{blok.belgi || 'manba · baza'}{soat && !blok.belgi ? ` · ${soat}` : ''}</div>
                    <div className="text-[13.5px] font-semibold text-matn leading-snug break-words">{blok.sarlavha}</div>
                    {blok.izoh && <div className="text-[11.5px] text-matn-sokin mt-0.5 break-words">{blok.izoh}</div>}
                </div>
                <button
                    onClick={nusxala}
                    title="Matn qilib nusxalash (Telegramga yuborish uchun)"
                    aria-label="Nusxalash"
                    className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-matn-xira hover:text-brand hover:bg-ichki transition-colors shrink-0"
                >
                    {nusxa ? <Check size={14} className="text-yaxshi" /> : <Copy size={13} />}
                </button>
            </div>

            {!!blok.maydonlar?.length && (
                <div className="grid grid-cols-2 gap-px bg-chiziq-mayin border-y border-chiziq-mayin">
                    {blok.maydonlar.map((m, i) => (
                        <div key={i} className={`bg-sirt px-3 py-2 min-w-0 ${blok.maydonlar!.length % 2 === 1 && i === blok.maydonlar!.length - 1 ? 'col-span-2' : ''}`}>
                            <div className="text-[10.5px] text-matn-sokin truncate">{m.nom}</div>
                            {m.tel ? (
                                <a href={`tel:${m.qiymat.replace(/[^\d+]/g, '')}`} className="num text-[13px] font-semibold text-brand inline-flex items-center gap-1 mt-0.5">
                                    <Phone size={11} />{m.qiymat}
                                </a>
                            ) : (
                                <div className={`raqam text-[15px] font-semibold leading-tight mt-0.5 truncate ${tonRangi(m.ton)}`} title={m.qiymat}>{m.qiymat}</div>
                            )}
                            {m.ulush !== undefined && (
                                <div className="mt-1.5 h-[3px] rounded-full bg-chiziq overflow-hidden">
                                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, m.ulush))}%` }} />
                                </div>
                            )}
                            {m.izoh && <div className="text-[10.5px] text-matn-xira mt-0.5 truncate" title={m.izoh}>{m.izoh}</div>}
                        </div>
                    ))}
                </div>
            )}

            {blok.grafik && blok.grafik.length > 1 && <MiniGrafik nuqtalar={blok.grafik} />}

            {blok.eslatma && (
                <div className="mx-3 mt-2.5 rounded-lg bg-ichki px-2.5 py-2 text-[12px] text-matn-2 whitespace-pre-line break-words max-h-28 overflow-y-auto">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-matn-xira block mb-0.5">izoh</span>
                    {blok.eslatma}
                </div>
            )}

            {(blok.bolimlar || []).map((bo, bi) => {
                if (!bo.qatorlar.length) return null;
                const hammasi = ochiq[bi] || bo.qatorlar.length <= KORINADI + 1;
                const qatorlar = hammasi ? bo.qatorlar : bo.qatorlar.slice(0, KORINADI);
                return (
                    <div key={bi} className="pt-1">
                        {bo.sarlavha && <div className="px-3 pt-1.5 pb-0.5 text-[11px] font-semibold text-matn-sokin">{bo.sarlavha}</div>}
                        <ul>
                            {qatorlar.map((q, qi) => {
                                const Ichi = (
                                    <>
                                        <QatorBelgisi q={q} />
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-[12.5px] font-medium text-matn ${q.tur === 'misol' ? 'break-words' : 'truncate'}`}>{q.nom}</div>
                                            {q.izoh && <div className={`text-[11px] text-matn-xira ${q.tur === 'misol' ? 'break-words' : 'truncate'}`} title={q.izoh}>{q.izoh}</div>}
                                            {q.ulush !== undefined && (
                                                <div className="mt-1 h-[3px] rounded-full bg-chiziq overflow-hidden">
                                                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.max(2, Math.min(100, q.ulush))}%` }} />
                                                </div>
                                            )}
                                        </div>
                                        {q.qiymat && <span className={`${/^[−+-]?\d/.test(q.qiymat) ? 'num' : ''} text-[12px] font-semibold shrink-0 ${tonRangi(q.ton)}`}>{q.qiymat}</span>}
                                        {q.havola && <ChevronRight size={14} className="text-matn-xira shrink-0 -mr-1" />}
                                        {q.savol && onSavol && <CornerDownLeft size={13} className="text-matn-xira shrink-0 -mr-1" />}
                                    </>
                                );
                                return (
                                    <li key={`${q.tur}-${q.id ?? qi}-${qi}`}>
                                        {q.savol && onSavol ? (
                                            <button onClick={() => onSavol(q.savol!)} title="Yozish maydoniga qo'yish" className="w-full flex items-center gap-2.5 px-3 py-[7px] text-left hover:bg-ichki transition-colors">
                                                {Ichi}
                                            </button>
                                        ) : q.havola ? (
                                            <button onClick={() => onHavola(q.havola!)} className="w-full flex items-center gap-2.5 px-3 py-[7px] text-left hover:bg-ichki transition-colors">
                                                {Ichi}
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2.5 px-3 py-[7px]">{Ichi}</div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {!hammasi && (
                            <button onClick={() => setOchiq(o => ({ ...o, [bi]: true }))} className="w-full px-3 py-1.5 text-[11.5px] text-brand hover:bg-ichki flex items-center gap-1">
                                <ChevronDown size={13} /> Yana {bo.qatorlar.length - KORINADI} tasini ko'rsatish
                            </button>
                        )}
                        {hammasi && !!bo.yana && (
                            <div className="px-3 py-1.5 text-[11px] text-matn-xira">… va yana {bo.yana} ta{blok.havola ? ' — hammasi sahifada' : ''}</div>
                        )}
                    </div>
                );
            })}

            {blok.bosh && <div className="px-3 py-3 text-[12px] text-matn-sokin">{blok.bosh}</div>}

            {blok.havola && (
                <button
                    onClick={() => onHavola(blok.havola!)}
                    className="w-full mt-1 border-t border-chiziq-mayin px-3 py-2 text-[12px] font-medium text-brand hover:bg-ichki flex items-center justify-between transition-colors"
                >
                    {blok.havolaMatni || 'Ochish'} <ArrowUpRight size={14} />
                </button>
            )}
        </div>
    );
}
