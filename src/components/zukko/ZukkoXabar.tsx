import { Fragment, ReactNode, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleAlert, Loader2, Paperclip, RotateCcw, Zap } from 'lucide-react';
import ZukkoBelgi from './ZukkoBelgi';
import ZukkoBlok from './ZukkoBlok';
import { AMAL_MUDDATI_MS, Amal, Qadam, Turn } from './zukkoApi';

// --- Javob matni: qalin, ro'yxat va ajratilgan raqamlar ---------------------

const RAQAM = /(\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(\s?(?:so['ʻ‘’]m|mlrd|mln|ming|%))?/g;

function raqamlar(s: string): ReactNode[] {
    const out: ReactNode[] = [];
    let oxirgi = 0;
    for (const m of s.matchAll(RAQAM)) {
        const i = m.index ?? 0;
        if (i > oxirgi) out.push(s.slice(oxirgi, i));
        const pul = !!m[2];
        out.push(<span key={i} className={`raqam font-semibold ${pul ? 'text-brand' : 'text-matn'}`}>{m[0]}</span>);
        oxirgi = i + m[0].length;
    }
    if (oxirgi < s.length) out.push(s.slice(oxirgi));
    return out;
}

function qator(s: string): ReactNode[] {
    return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4
            ? <strong key={i} className="font-semibold text-matn">{raqamlar(p.slice(2, -2))}</strong>
            : <Fragment key={i}>{raqamlar(p)}</Fragment>);
}

const ROYXAT = /^\s*(?:[-•*]|\d+[.)])\s+/;

export function JavobMatni({ matn }: { matn: string }) {
    const bloklar = matn.replace(/\r/g, '').split(/\n{2,}/).filter(b => b.trim());
    return (
        <div className="space-y-2 text-[13.5px] leading-[1.62] text-matn-2 break-words">
            {bloklar.map((b, bi) => {
                const qatorlar = b.split('\n').filter(l => l.trim());
                const royxatmi = qatorlar.filter(l => ROYXAT.test(l)).length;
                if (royxatmi && royxatmi >= qatorlar.length - 1) {
                    return (
                        <div key={bi} className="space-y-1">
                            {qatorlar.map((l, li) => ROYXAT.test(l) ? (
                                <div key={li} className="flex gap-2">
                                    <span className="mt-[9px] h-[5px] w-[5px] rounded-full bg-brand/70 shrink-0" />
                                    <span className="min-w-0">{qator(l.replace(ROYXAT, ''))}</span>
                                </div>
                            ) : <p key={li}>{qator(l)}</p>)}
                        </div>
                    );
                }
                return <p key={bi}>{qatorlar.map((l, li) => <Fragment key={li}>{qator(l)}{li < qatorlar.length - 1 && <br />}</Fragment>)}</p>;
            })}
        </div>
    );
}

// --- AI qadamlari (iz) ------------------------------------------------------

function Iz({ qadamlar, kutmoqda }: { qadamlar: Qadam[]; kutmoqda?: boolean }) {
    const [ochiq, setOchiq] = useState(false);
    if (!qadamlar.length) return null;
    if (!kutmoqda && !ochiq) {
        const xatolar = qadamlar.filter(q => q.holat === 'xato').length;
        return (
            <button onClick={() => setOchiq(true)} className="flex items-center gap-1.5 font-mono text-[10.5px] text-matn-xira hover:text-matn-sokin transition-colors">
                <Check size={11} className="text-yaxshi" />
                {qadamlar.length} ta manba o'qildi{xatolar ? ` · ${xatolar} tasida xato` : ''}
                <ChevronDown size={11} />
            </button>
        );
    }
    return (
        <div className="space-y-1 border-l-2 border-brand/25 pl-2.5">
            {qadamlar.map(q => (
                <div key={q.id} className="flex items-start gap-1.5 font-mono text-[10.5px] leading-[1.5]">
                    {q.holat === 'ish'
                        ? <Loader2 size={11} className="animate-spin text-brand mt-[2px] shrink-0" />
                        : q.holat === 'xato'
                            ? <CircleAlert size={11} className="text-xato mt-[2px] shrink-0" />
                            : <Check size={11} className="text-yaxshi mt-[2px] shrink-0" />}
                    <span className={q.holat === 'ish' ? 'zk-shimmer' : 'text-matn-sokin'}>
                        {q.matn}{q.izoh ? <span className={q.holat === 'xato' ? 'text-xato' : 'text-matn-xira'}> — {q.izoh}</span> : null}
                    </span>
                </div>
            ))}
        </div>
    );
}

// --- Amal kartochkasi -------------------------------------------------------

function AmalKarta({ amal, onTasdiq, onBekor, onHavola }: { amal: Amal; onTasdiq: () => void; onBekor: () => void; onHavola: (yol: string) => void }) {
    const eskirgan = !!amal.yaratildi && Date.now() - amal.yaratildi > AMAL_MUDDATI_MS;
    const holat = amal.holat || 'kutmoqda';
    const tugagan = holat === 'bajarildi' || holat === 'bekor';
    const [ochiq, setOchiq] = useState<Record<number, boolean>>({});
    const xavfli = !!amal.xavfli && !tugagan;
    const chegara = tugagan ? 'border-chiziq bg-sirt' : xavfli ? 'border-xato/40 bg-xato-fon/40' : 'border-brand/35 bg-brand/[0.04]';
    const yozuv = holat === 'bajarildi' ? 'bajarildi' : holat === 'bekor' ? 'bekor qilindi' : holat === 'qisman' ? 'qisman bajarildi'
        : eskirgan && holat === 'kutmoqda' ? 'taklif eskirdi' : xavfli ? 'diqqat — tasdiqlash kerak' : 'tasdiqlash kerak';
    return (
        <div className={`rounded-xl border overflow-hidden zk-kirish ${chegara}`}>
            <div className="px-3 pt-2.5">
                <div className={`font-mono text-[9.5px] tracking-[0.08em] uppercase ${tugagan ? 'text-matn-xira' : xavfli ? 'text-xato' : 'text-brand'}`}>{yozuv}</div>
                <div className={`text-[13.5px] font-semibold mt-0.5 ${holat === 'bekor' ? 'text-matn-xira line-through' : 'text-matn'}`}>{amal.sarlavha}</div>
            </div>
            <dl className="px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                {amal.maydonlar.map((m, i) => (
                    <Fragment key={i}>
                        <dt className="text-matn-sokin">{m.nom}</dt>
                        <dd className="text-matn font-medium break-words whitespace-pre-line min-w-0">
                            {m.eski !== undefined && (
                                <><span className="text-matn-xira line-through decoration-matn-xira/60">{m.eski}</span><span className="text-matn-xira mx-1.5">→</span></>
                            )}
                            {m.qiymat}
                        </dd>
                    </Fragment>
                ))}
            </dl>
            {(amal.royxat || []).map((r, ri) => {
                const hammasi = ochiq[ri] || r.qatorlar.length <= 6;
                const qatorlar = hammasi ? r.qatorlar : r.qatorlar.slice(0, 5);
                return (
                    <div key={ri} className="mx-3 mb-2 rounded-lg bg-sirt/70 border border-chiziq-mayin px-2.5 py-2">
                        <div className="text-[11px] font-semibold text-matn-sokin mb-1">{r.sarlavha}</div>
                        <ul className="space-y-0.5">
                            {qatorlar.map((q, qi) => <li key={qi} className="text-[12px] text-matn-2 break-words">{q}</li>)}
                        </ul>
                        {!hammasi && (
                            <button onClick={() => setOchiq(o => ({ ...o, [ri]: true }))} className="mt-1 text-[11.5px] text-brand flex items-center gap-1">
                                <ChevronDown size={12} /> Yana {r.qatorlar.length - 5} ta
                            </button>
                        )}
                        {hammasi && !!r.yana && <div className="mt-1 text-[11px] text-matn-xira">… va yana {r.yana} ta</div>}
                    </div>
                );
            })}
            {!tugagan && amal.ogohlantirish.map((o, i) => (
                <div key={i} className="mx-3 mb-2 flex gap-1.5 rounded-lg bg-ogoh-fon px-2.5 py-1.5 text-[12px] text-ogoh">
                    <AlertTriangle size={13} className="mt-[2px] shrink-0" /> <span>{o}</span>
                </div>
            ))}
            {amal.izoh && (holat === 'bajarildi' || holat === 'qisman') && (
                <div className="mx-3 mb-2 rounded-lg bg-ichki px-2.5 py-1.5 text-[12px] text-matn-2">{amal.izoh}</div>
            )}
            <div className={`flex flex-wrap items-center gap-2 border-t px-3 py-2.5 ${tugagan ? 'border-chiziq-mayin' : xavfli ? 'border-xato/25' : 'border-brand/20'}`}>
                {holat === 'kutmoqda' && !eskirgan && (
                    <>
                        <button onClick={onTasdiq} className={`flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold hover:opacity-90 transition-opacity ${xavfli ? 'bg-xato text-white' : 'bg-brand text-brand-ust'}`}>
                            {amal.tugma}
                        </button>
                        <button onClick={onBekor} className="rounded-lg border border-chiziq px-3 py-2 text-[12.5px] text-matn-2 hover:bg-ichki transition-colors">
                            Bekor
                        </button>
                    </>
                )}
                {holat === 'kutmoqda' && eskirgan && <span className="text-[12px] text-matn-xira">15 daqiqadan oshdi — ma'lumot o'zgargan bo'lishi mumkin, qaytadan so'rang</span>}
                {holat === 'bajarilmoqda' && <span className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {amal.maxsus ? "«Savol qo'shish» oynasida — natijani ko'rib, saqlang" : 'Bajarilmoqda…'}</span>}
                {holat === 'bajarildi' && <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-yaxshi"><CheckCircle2 size={15} /> {amal.natija || 'Bajarildi'} · jurnalga yozildi</span>}
                {holat === 'bekor' && <span className="text-[12px] text-matn-xira">Hech narsa o'zgarmadi</span>}
                {(holat === 'xato' || holat === 'qisman') && (
                    <>
                        <span className="flex-1 text-[12px] text-xato break-words">{amal.xato || "Bajarib bo'lmadi"}</span>
                        {holat === 'xato' && !eskirgan && (
                            <button onClick={onTasdiq} className="flex items-center gap-1 rounded-lg border border-chiziq px-2.5 py-1.5 text-[12px] text-matn-2 hover:bg-ichki"><RotateCcw size={12} /> Qayta</button>
                        )}
                    </>
                )}
                {(holat === 'bajarildi' || holat === 'qisman') && amal.havola && (
                    <button onClick={() => onHavola(amal.havola!)} className="ml-auto flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
                        Ochish <ArrowUpRight size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}

// --- Bitta xabar -------------------------------------------------------------

const soat = (t: number) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function ZukkoXabar({ turn, onHavola, onTaklif, onYoz, onAmal }: {
    turn: Turn;
    onHavola: (yol: string) => void;
    onTaklif: (savol: string) => void;
    /** Misolni yozish maydoniga qo'yish (yubormasdan). */
    onYoz: (matn: string) => void;
    onAmal: (indeks: number, tasdiq: boolean) => void;
}) {
    if (turn.rol === 'user') {
        return (
            <div className="flex flex-col items-end gap-1 zk-kirish">
                {!!turn.fayllar?.length && (
                    <div className="flex max-w-[86%] flex-wrap justify-end gap-1">
                        {turn.fayllar.map((f, i) => (
                            <span key={i} title={f.nom} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-chiziq bg-sirt px-2 py-1 text-[11.5px] text-matn-2">
                                <Paperclip size={11} className="shrink-0 text-brand" /><span className="truncate">{f.nom}</span>
                            </span>
                        ))}
                    </div>
                )}
                <div className="max-w-[86%] rounded-2xl rounded-br-md border border-brand/15 bg-brand/[0.09] px-3.5 py-2 text-[13.5px] leading-relaxed text-matn whitespace-pre-wrap break-words">
                    {turn.matn}
                </div>
            </div>
        );
    }

    const joriyQadam = [...(turn.qadamlar || [])].reverse().find(q => q.holat === 'ish');
    return (
        <div className="flex gap-2.5 zk-kirish" aria-live={turn.kutmoqda ? 'polite' : undefined}>
            <ZukkoBelgi size={24} fikrlaydi={turn.kutmoqda} className="mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] text-matn-xira h-6">
                    <span className="font-semibold text-matn-2">Zukko</span>
                    {turn.tezkor && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-ichki px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-[0.06em] text-matn-sokin" title="AI siz — to'g'ridan-to'g'ri bazadan">
                            <Zap size={9} /> tezkor
                        </span>
                    )}
                    <span>· {soat(turn.vaqt)}</span>
                    {!turn.kutmoqda && turn.davomiylik ? <span>· {(turn.davomiylik / 1000).toFixed(1).replace('.', ',')} s</span> : null}
                </div>

                {!turn.tezkor && <Iz qadamlar={turn.qadamlar || []} kutmoqda={turn.kutmoqda} />}

                {turn.kutmoqda && !turn.matn && !joriyQadam && (
                    <div className="zk-shimmer text-[12.5px] font-medium">{turn.tezkor ? 'Bazadan olinmoqda…' : "O'ylayapman…"}</div>
                )}

                {turn.matn && <JavobMatni matn={turn.matn} />}

                {(turn.bloklar || []).map((b, i) => <ZukkoBlok key={i} blok={b} vaqt={turn.vaqt} onHavola={onHavola} onSavol={onYoz} />)}

                {(turn.amallar || []).map((a, i) => (
                    <AmalKarta key={i} amal={a} onTasdiq={() => onAmal(i, true)} onBekor={() => onAmal(i, false)} onHavola={onHavola} />
                ))}

                {turn.xato && (
                    <div className="flex gap-2 rounded-xl border border-xato-chiziq bg-xato-fon px-3 py-2.5 text-[12.5px] text-xato">
                        <CircleAlert size={15} className="mt-[1px] shrink-0" />
                        <span className="break-words">{turn.xato}</span>
                    </div>
                )}

                {!turn.kutmoqda && !!turn.takliflar?.length && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {turn.takliflar.map(t => (
                            <button key={t} onClick={() => onTaklif(t)}
                                className="rounded-full border border-chiziq bg-sirt px-2.5 py-1 text-[11.5px] text-matn-2 hover:border-brand/40 hover:text-brand transition-colors">
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
