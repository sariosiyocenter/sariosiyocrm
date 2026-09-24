import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Megaphone, Send, KeyRound, AlertTriangle, CheckCircle2, RefreshCw, Square } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi, ApiXato } from './useImtihonApi';
import { Karta, Tugma, Tanlov, Yorliq, SELECT, Yuklanmoqda, BoshHolat } from './ui';
import StatTile from '../ui/StatTile';
import KalitOynasi from './KalitOynasi';
import { oddiyMatn, formulaliHtml, SAVOL_MATNI } from '../../lib/matn';
import type { ImtihonTafsil } from '../ExamDetail';

// 6-bo'lim: natijalar, savol va mavzu tahlili, e'lon. E'londan oldin savollar
// tahliliga qarash kerak: kuchli o'quvchilar xato qilgan savol — ko'pincha
// kalit xatosi. E'londan keyin xabar bir marta ketadi (qayta yuborilmaydi).

interface Natija {
  id: number; name: string; groupId: number | null; groupName: string; schoolId: number; session: number | null; variantCode: string | null;
  score: number; percentage: number; blockScores: { subject: string; earned: number; max: number }[] | null;
  reviewStatus: string; shubhalar: number; rank: number | null; rankGroup: number | null; notifiedAt: string | null; notifyStatus: string | null; sheetCode: string | null;
}
interface SavolTahlil { q: number; t: string; b: number; jami: number; togri: number; bosh: number; tanlov: Record<string, number> | null; foiz: number; farq: number; shubhali: boolean; subject: string; topic: string; text: string; togriJavob: string | null; bekor: string | null }
interface Tahlil { savollar: SavolTahlil[]; mavzular: { fan: string; mavzu: string; jami: number; togri: number; foiz: number; kurslar: Record<string, { jami: number; togri: number }> }[]; natijaSoni: number }
interface Xulosa { qatnashchi: number; skanerlangan: number; kelmagan: number; skanerlanmagan: number; shubhali: number; baholanmagan: number; nolBall: number; yuborilgan: number; yuborilmagan: number; published: boolean; publishedAt: string | null }

const foizRangi = (f: number) => (f >= 0.7 ? 'bg-yaxshi-fon text-yaxshi' : f >= 0.4 ? 'bg-ogoh-fon text-ogoh' : 'bg-xato-fon text-xato');

export default function NatijalarTab({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => Promise<any> }) {
  const { schools, kora, ozgartira, showNotification } = useCRM();
  const kalitKorinadi = kora('imtihonlar.kalit');
  const elonQiladi = ozgartira('imtihonlar.elon');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [bolim, setBolim] = useState<'reyting' | 'savollar' | 'mavzular' | 'elon'>('reyting');
  const [natijalar, setNatijalar] = useState<Natija[] | null>(null);
  const [tahlil, setTahlil] = useState<Tahlil | null>(null);
  const [xulosa, setXulosa] = useState<Xulosa | null>(null);
  const [kurs, setKurs] = useState<number | 0>(0);
  const [kalitSavol, setKalitSavol] = useState<number | null | undefined>(undefined);
  const [band, setBand] = useState<string | null>(null);
  const [yuborish, setYuborish] = useState<{ yuborildi: number; xato: number; qoldi: number } | null>(null);
  const toxtaRef = useRef(false);
  const s = exam.settings;

  const yukla = useCallback(async () => {
    try {
      const [r, t, x] = await Promise.all([
        soro<Natija[]>('GET', `exams/${exam.id}/results`),
        soro<Tahlil>('GET', `exams/${exam.id}/analysis`),
        soro<Xulosa>('GET', `exams/${exam.id}/publish-summary`),
      ]);
      setNatijalar(r); setTahlil(t); setXulosa(x);
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  }, [exam.id, soro, showNotification]);
  useEffect(() => { yukla(); }, [yukla]);

  const kurslar = useMemo(() => [...new Map((natijalar || []).filter(r => r.groupId).map(r => [r.groupId!, r.groupName])).entries()], [natijalar]);
  const korinadigan = useMemo(() => (natijalar || []).filter(r => !kurs || r.groupId === kurs).sort((a, b) => b.score - a.score), [natijalar, kurs]);
  const filialNomi = (id: number) => schools.find(x => x.id === id)?.name || '';
  const kopFilial = (exam.branchIds || []).length > 0;

  const stat = useMemo(() => {
    const l = korinadigan;
    if (!l.length) return null;
    const ortacha = l.reduce((a, r) => a + r.score, 0) / l.length;
    return { soni: l.length, ortacha: Math.round(ortacha * 10) / 10, engYuqori: Math.max(...l.map(r => r.score)), ortachaFoiz: Math.round(l.reduce((a, r) => a + r.percentage, 0) / l.length) };
  }, [korinadigan]);

  const excel = () => {
    const qatorlar = korinadigan.map((r, i) => {
      const o: Record<string, any> = { "O'rin": r.rank ?? i + 1, 'Familiya va ism': r.name, Kurs: r.groupName };
      if (kopFilial) o.Filial = filialNomi(r.schoolId);
      o.Variant = r.variantCode || '';
      for (const b of r.blockScores || []) o[b.subject] = b.earned;
      o.Ball = r.score; o['Foiz (%)'] = r.percentage; o.Holat = r.reviewStatus === 'shubhali' ? 'tekshirilmagan' : 'tayyor';
      return o;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qatorlar), 'Natijalar');
    if (tahlil?.savollar.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tahlil.savollar.map(sv => ({
        Fan: sv.subject, Mavzu: sv.topic, Savol: oddiyMatn(sv.text).slice(0, 200), "To'g'ri topdi (%)": Math.round(sv.foiz * 100), Javob_berdi: sv.jami, Shubhali: sv.shubhali ? 'ha' : '',
      }))), 'Savollar');
    }
    XLSX.writeFile(wb, `${exam.name}-natijalar.xlsx`);
  };

  const elon = async () => {
    setBand('elon');
    try {
      const r = await soro<{ xulosa: Xulosa }>('POST', `exams/${exam.id}/publish`, {});
      setXulosa(r.xulosa);
      showNotification("Natijalar e'lon qilindi, reyting hisoblandi", 'success');
      await Promise.all([yukla(), yangila()]);
    } catch (e: any) {
      if (e instanceof ApiXato && e.status === 409 && e.malumot?.xulosa) {
        if (await confirm(`${e.message}. Shunday bo'lsa ham e'lon qilinsinmi? (Tekshirilmagan javoblar skaner taklifi bilan hisoblanadi, yozma savol — 0 ball.)`)) {
          try {
            const r = await soro<{ xulosa: Xulosa }>('POST', `exams/${exam.id}/publish`, { force: true });
            setXulosa(r.xulosa);
            await Promise.all([yukla(), yangila()]);
          } catch (e2: any) { showNotification(e2.message, 'error'); }
        }
      } else showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const xabarlar = async () => {
    if (s.notify.channel === 'NONE') return;
    const kanal = { BOTH: 'Telegram (bo\'lmasa SMS)', TELEGRAM: 'Telegram', SMS: 'SMS' }[s.notify.channel];
    if (!(await confirm(`${xulosa?.yuborilmagan ?? ''} ta natija ${kanal} orqali yuboriladi. SMS pullik. Yuborilgan xabarni qaytarib bo'lmaydi. Davom etilsinmi?`))) return;
    toxtaRef.current = false;
    setBand('xabar');
    let jami = { yuborildi: 0, xato: 0, qoldi: xulosa?.yuborilmagan ?? 0 };
    setYuborish(jami);
    try {
      while (!toxtaRef.current) {
        const r = await soro<{ yuborildi: number; xato: number; qoldi: number }>('POST', `exams/${exam.id}/notify`, { limit: 8 });
        jami = { yuborildi: jami.yuborildi + r.yuborildi, xato: jami.xato + r.xato, qoldi: r.qoldi };
        setYuborish({ ...jami });
        if (!r.qoldi || (!r.yuborildi && !r.xato)) break;
      }
      showNotification(`${jami.yuborildi} ta xabar yuborildi${jami.xato ? `, ${jami.xato} tasiga yetmadi` : ''}`, jami.xato ? 'info' : 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
      yukla();
    }
  };

  if (!natijalar || !xulosa) return <Yuklanmoqda />;
  if (!natijalar.length) return <Karta><BoshHolat sarlavha="Hali natija yo'q" izoh="Varaqlarni «Skaner» bo'limida o'qiting." /></Karta>;

  const savollar = tahlil?.savollar || [];
  const shubhaliSavollar = savollar.filter(x => x.shubhali && !x.bekor);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Natija" value={xulosa.skanerlangan} unit={`/ ${xulosa.qatnashchi}`} subValue={xulosa.skanerlanmagan ? `${xulosa.skanerlanmagan} ta skanerlanmagan` : 'hammasi skanerlangan'} subTone={xulosa.skanerlanmagan ? 'warn' : undefined} />
        <StatTile label="O'rtacha ball" value={stat?.ortacha ?? '—'} unit={`/ ${exam.maxScore}`} subValue={`${stat?.ortachaFoiz ?? 0}%`} />
        <StatTile label="Eng yuqori" value={stat?.engYuqori ?? '—'} unit="ball" />
        <StatTile label="Tekshirilmagan" value={xulosa.shubhali} tone={xulosa.shubhali ? 'warn' : 'good'} subValue={shubhaliSavollar.length ? `${shubhaliSavollar.length} ta shubhali savol` : 'savollar joyida'} subTone={shubhaliSavollar.length ? 'bad' : undefined} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tanlov qiymat={bolim} onChange={setBolim} variantlar={[
          { v: 'reyting', nom: 'Reyting' },
          { v: 'savollar', nom: <>Savollar tahlili{shubhaliSavollar.length > 0 && <span className="ml-1 text-xato">({shubhaliSavollar.length})</span>}</> },
          { v: 'mavzular', nom: 'Mavzular' },
          { v: 'elon', nom: <>E'lon{xulosa.published && <CheckCircle2 size={13} className="inline ml-1 text-yaxshi" />}</> },
        ]} />
        <div className="flex gap-2">
          <Tugma kichik turi="oddiy" ikonka={<RefreshCw size={13} />} onClick={yukla}>Yangilash</Tugma>
          <Tugma kichik ikonka={<Download size={13} />} onClick={excel}>Excel</Tugma>
        </div>
      </div>

      {bolim === 'reyting' && (
        <Karta ichki="p-0" sarlavha={xulosa.published ? "Reyting (e'lon qilingan)" : "Dastlabki reyting — e'lon qilinmagan"}
          amallar={kurslar.length > 1 && (
            <select className={`${SELECT} py-1.5 w-52`} value={kurs} onChange={e => setKurs(Number(e.target.value))}>
              <option value={0}>Hamma kurs</option>
              {kurslar.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
            </select>
          )}>
          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead className="bg-ichki text-matn-sokin">
                <tr>
                  <th className="px-3 py-2 text-center font-semibold w-12">O'rin</th>
                  <th className="px-3 py-2 text-left font-semibold">Qatnashchi</th>
                  <th className="px-3 py-2 text-left font-semibold">Kurs</th>
                  <th className="px-3 py-2 text-center font-semibold">Var.</th>
                  {exam.blocks.length > 1 && exam.blocks.map((b, i) => <th key={i} className="px-2 py-2 text-center font-semibold whitespace-nowrap">{b.subject}</th>)}
                  <th className="px-3 py-2 text-right font-semibold">Ball</th>
                  <th className="px-3 py-2 text-right font-semibold">%</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-chiziq">
                {korinadigan.map((r, i) => (
                  <tr key={r.id} className="hover:bg-ichki/50">
                    <td className="px-3 py-2 text-center font-bold text-matn raqam">{kurs ? (r.rankGroup ?? i + 1) : (r.rank ?? i + 1)}</td>
                    <td className="px-3 py-2 text-matn">{r.name}{kopFilial && <span className="text-matn-xira"> · {filialNomi(r.schoolId)}</span>}</td>
                    <td className="px-3 py-2 text-matn-sokin">{r.groupName || '—'}</td>
                    <td className="px-3 py-2 text-center text-matn-sokin">{r.variantCode || '—'}</td>
                    {exam.blocks.length > 1 && exam.blocks.map((_, bi) => { const b = r.blockScores?.[bi]; return <td key={bi} className="px-2 py-2 text-center text-matn-sokin raqam">{b ? `${b.earned}` : '—'}</td>; })}
                    <td className="px-3 py-2 text-right font-bold text-matn raqam">{r.score}</td>
                    <td className="px-3 py-2 text-right text-matn-sokin raqam">{r.percentage}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.reviewStatus === 'shubhali' && <Yorliq rang="ogoh">tekshirilmagan</Yorliq>}
                      {r.notifyStatus === 'yuborildi' && <Yorliq rang="yaxshi">xabar ketdi</Yorliq>}
                      {r.notifyStatus && r.notifyStatus !== 'yuborildi' && <Yorliq rang="xato">{r.notifyStatus === 'aloqa yoq' ? "aloqa yo'q" : 'yetmadi'}</Yorliq>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Karta>
      )}

      {bolim === 'savollar' && (
        <Karta ichki="p-0" sarlavha="Savollar tahlili" izoh="Eng qiyinidan boshlab. «Shubhali» — kuchli o'quvchilar kuchsizlardan ko'p xato qilgan yoki deyarli hech kim topmagan savol: kalitni tekshiring."
          amallar={kalitKorinadi && <Tugma kichik ikonka={<KeyRound size={13} />} onClick={() => setKalitSavol(null)}>Kalit</Tugma>}>
          <ul className="divide-y divide-chiziq mt-3">
            {[...savollar].sort((a, b) => Number(b.shubhali) - Number(a.shubhali) || a.foiz - b.foiz).map(sv => {
              const jamiTanlov = sv.tanlov ? Object.values(sv.tanlov).reduce((a, x) => a + x, 0) : 0;
              return (
                <li key={sv.q} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Yorliq>{sv.subject}</Yorliq><Yorliq>{sv.topic}</Yorliq>
                        {sv.shubhali && !sv.bekor && <Yorliq rang="xato"><AlertTriangle size={11} /> Kalitni tekshiring</Yorliq>}
                        {sv.bekor && <Yorliq rang="ogoh">Bekor qilingan</Yorliq>}
                      </div>
                      <div className={`${SAVOL_MATNI} text-[13px] text-matn line-clamp-3`} dangerouslySetInnerHTML={{ __html: formulaliHtml(sv.text) }} />
                      {sv.tanlov && sv.t === 'yopiq' && jamiTanlov > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(sv.tanlov).sort().map(([h, n]) => (
                            <span key={h} className={`px-2 py-0.5 rounded-md border text-[11.5px] raqam ${sv.togriJavob?.split(', ').includes(h) ? 'border-yaxshi/40 bg-yaxshi-fon text-yaxshi font-semibold' : 'border-chiziq text-matn-sokin'}`}>{h}: {Math.round((n / jamiTanlov) * 100)}%</span>
                          ))}
                          {sv.bosh > 0 && <span className="px-2 py-0.5 rounded-md border border-chiziq text-[11.5px] text-matn-xira">bo'sh: {sv.bosh}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-[12.5px] font-bold raqam ${foizRangi(sv.foiz)}`}>{Math.round(sv.foiz * 100)}%</span>
                      {kalitKorinadi && sv.t !== 'yozma' && <Tugma kichik turi="oddiy" onClick={() => setKalitSavol(sv.q)}>Kalit</Tugma>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Karta>
      )}

      {bolim === 'mavzular' && (
        <Karta ichki="p-0" sarlavha="Mavzular bo'yicha" izoh="To'g'ri javoblar ulushi — ustoz qaysi mavzuni qayta o'tishini shundan ko'radi">
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[12.5px]">
              <thead className="bg-ichki text-matn-sokin">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Mavzu</th>
                  <th className="px-3 py-2 text-center font-semibold">Hammasi</th>
                  {kurslar.map(([id, nom]) => <th key={id} className="px-2 py-2 text-center font-semibold whitespace-nowrap">{nom}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-chiziq">
                {(tahlil?.mavzular || []).map(m => (
                  <tr key={`${m.fan}|${m.mavzu}`}>
                    <td className="px-3 py-2"><span className="text-matn">{m.mavzu}</span> <span className="text-matn-xira">· {m.fan}</span></td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-md font-bold raqam ${foizRangi(m.foiz / 100)}`}>{m.foiz}%</span></td>
                    {kurslar.map(([id]) => {
                      const k = m.kurslar[String(id)];
                      if (!k?.jami) return <td key={id} className="px-2 py-2 text-center text-matn-xira">—</td>;
                      const f = k.togri / k.jami;
                      return <td key={id} className="px-2 py-2 text-center"><span className={`px-2 py-0.5 rounded-md raqam ${foizRangi(f)}`}>{Math.round(f * 100)}%</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Karta>
      )}

      {bolim === 'elon' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Karta sarlavha="E'londan oldin">
            <ul className="space-y-2 text-[13px]">
              <Band ok={!xulosa.skanerlanmagan} matn={xulosa.skanerlanmagan ? `${xulosa.skanerlanmagan} ta qatnashchining varag'i skanerlanmagan (kelmaganlar «kelmadi» deb belgilansin)` : 'Hamma varaq skanerlangan'} />
              <Band ok={!xulosa.shubhali} matn={xulosa.shubhali ? `${xulosa.shubhali} ta varaq tekshirilmagan` : 'Hamma shubhali javob tekshirilgan'} />
              {xulosa.baholanmagan > 0 && <Band ok={false} matn={`${xulosa.baholanmagan} ta varaqda yozma savol baholanmagan`} />}
              <Band ok={!shubhaliSavollar.length} matn={shubhaliSavollar.length ? `${shubhaliSavollar.length} ta savolning kaliti shubhali — «Savollar tahlili»ga qarang` : 'Savollar tahlilida shubha yo\'q'} />
              {xulosa.nolBall > 0 && <Band ok={false} matn={`${xulosa.nolBall} ta natija 0 ball — varaq to'g'ri skanerlanganini tekshiring`} />}
            </ul>
            {elonQiladi && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Tugma turi="asosiy" ikonka={<Megaphone size={14} />} yuklanmoqda={band === 'elon'} onClick={elon}>{xulosa.published ? "Reytingni yangilash" : "Natijalarni e'lon qilish"}</Tugma>
              </div>
            )}
            {xulosa.published && <p className="text-[12px] text-matn-xira mt-2">E'lon qilingan: {new Date(xulosa.publishedAt!).toLocaleString('uz')}. Kalit tuzatilsa — reytingni yangilang.</p>}
          </Karta>
          <Karta sarlavha="Xabarlar" izoh={s.notify.channel === 'NONE' ? 'Imtihon sozlamasida xabar yuborish o\'chirilgan' : `${{ BOTH: 'Telegram, bo\'lmasa SMS', TELEGRAM: 'Faqat Telegram', SMS: 'Faqat SMS' }[s.notify.channel]} · ${{ PARENT: 'ota-onaga', STUDENT: "o'quvchiga", ALL: 'ota-ona va o\'quvchiga' }[s.notify.to]}`}>
            <div className="space-y-3 text-[13px]">
              <p className="text-matn-sokin">Yuborilgan: <b className="text-matn">{xulosa.yuborilgan}</b> · qolgan: <b className="text-matn">{xulosa.yuborilmagan}</b></p>
              {yuborish && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-ichki overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${Math.round(((yuborish.yuborildi + yuborish.xato) / Math.max(1, yuborish.yuborildi + yuborish.xato + yuborish.qoldi)) * 100)}%` }} /></div>
                  <p className="text-[12px] text-matn-sokin">{yuborish.yuborildi} yuborildi · {yuborish.xato} yetmadi · {yuborish.qoldi} qoldi</p>
                </div>
              )}
              {elonQiladi && s.notify.channel !== 'NONE' && (
                band === 'xabar'
                  ? <Tugma ikonka={<Square size={13} />} onClick={() => { toxtaRef.current = true; }}>To'xtatish</Tugma>
                  : <Tugma turi="asosiy" ikonka={<Send size={14} />} disabled={!xulosa.published || !xulosa.yuborilmagan} onClick={xabarlar}>Xabarlarni yuborish</Tugma>
              )}
              {!xulosa.published && <p className="text-[12px] text-matn-xira">Xabar faqat e'londan keyin yuboriladi.</p>}
            </div>
          </Karta>
        </div>
      )}
      {kalitSavol !== undefined && <KalitOynasi examId={exam.id} boshSavol={kalitSavol ?? undefined} onYop={ozgardi => { setKalitSavol(undefined); if (ozgardi) { yukla(); yangila(); } }} />}
    </div>
  );
}

function Band({ ok, matn }: { ok: boolean; matn: string }) {
  return <li className="flex items-start gap-2">{ok ? <CheckCircle2 size={16} className="text-yaxshi shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-ogoh shrink-0 mt-0.5" />}<span className="text-matn">{matn}</span></li>;
}
