import { Fragment, ReactNode, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, CircleAlert, Loader2, RotateCcw, Zap } from 'lucide-react';
import ZukkoBelgi from './ZukkoBelgi';
import ZukkoBlok from './ZukkoBlok';
import { Amal, Qadam, Turn } from './zukkoApi';

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

function AmalKarta({ amal, onTasdiq, onBekor }: { amal: Amal; onTasdiq: () => void; onBekor: () => void }) {
    const holat = amal.holat || 'kutmoqda';
    const tugagan = holat === 'bajarildi' || holat === 'bekor';
    return (
        <div className={`rounded-xl border overflow-hidden zk-kirish ${tugagan ? 'border-chiziq bg-sirt' : 'border-brand/35 bg-brand/[0.04]'}`}>
            <div className="px-3 pt-2.5">
                <div className={`font-mono text-[9.5px] tracking-[0.08em] uppercase ${tugagan ? 'text-matn-xira' : 'text-brand'}`}>
                    {holat === 'bajarildi' ? 'bajarildi' : holat === 'bekor' ? 'bekor qilindi' : 'tasdiqlash kerak'}
                </div>
                <div className={`text-[13.5px] font-semibold mt-0.5 ${holat === 'bekor' ? 'text-matn-xira line-through' : 'text-matn'}`}>{amal.sarlavha}</div>
            </div>
            <dl className="px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                {amal.maydonlar.map((m, i) => (
                    <Fragment key={i}>
                        <dt className="text-matn-sokin">{m.nom}</dt>
                        <dd className="text-matn font-medium break-words whitespace-pre-line min-w-0">{m.qiymat}</dd>
                    </Fragment>
                ))}
            </dl>
            {!tugagan && amal.ogohlantirish.map((o, i) => (
                <div key={i} className="mx-3 mb-2 flex gap-1.5 rounded-lg bg-ogoh-fon px-2.5 py-1.5 text-[12px] text-ogoh">
                    <AlertTriangle size={13} className="mt-[2px] shrink-0" /> <span>{o}</span>
                </div>
            ))}
            <div className={`flex items-center gap-2 border-t px-3 py-2.5 ${tugagan ? 'border-chiziq-mayin' : 'border-brand/20'}`}>
                {holat === 'kutmoqda' && (
                    <>
                        <button onClick={onTasdiq} className="flex-1 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-brand-ust hover:opacity-90 transition-opacity">
                            {amal.tugma}
                        </button>
                        <button onClick={onBekor} className="rounded-lg border border-chiziq px-3 py-2 text-[12.5px] text-matn-2 hover:bg-ichki transition-colors">
                            Bekor
                        </button>
                    </>
                )}
                {holat === 'bajarilmoqda' && <span className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> Bajarilmoqda…</span>}
                {holat === 'bajarildi' && <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-yaxshi"><CheckCircle2 size={15} /> Saqlandi · jurnalga yozildi</span>}
                {holat === 'bekor' && <span className="text-[12px] text-matn-xira">Hech narsa o'zgarmadi</span>}
                {holat === 'xato' && (
                    <>
                        <span className="flex-1 text-[12px] text-xato break-words">{amal.xato || 'Bajarib bo\'lmadi'}</span>
                        <button onClick={onTasdiq} className="flex items-center gap-1 rounded-lg border border-chiziq px-2.5 py-1.5 text-[12px] text-matn-2 hover:bg-ichki"><RotateCcw size={12} /> Qayta</button>
                    </>
                )}
            </div>
        </div>
    );
}

// --- Bitta xabar -------------------------------------------------------------

const soat = (t: number) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function ZukkoXabar({ turn, onHavola, onTaklif, onAmal }: {
    turn: Turn;
    onHavola: (yol: string) => void;
    onTaklif: (savol: string) => void;
    onAmal: (indeks: number, tasdiq: boolean) => void;
}) {
    if (turn.rol === 'user') {
        return (
            <div className="flex justify-end zk-kirish">
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

                {(turn.bloklar || []).map((b, i) => <ZukkoBlok key={i} blok={b} vaqt={turn.vaqt} onHavola={onHavola} />)}

                {(turn.amallar || []).map((a, i) => (
                    <AmalKarta key={i} amal={a} onTasdiq={() => onAmal(i, true)} onBekor={() => onAmal(i, false)} />
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
