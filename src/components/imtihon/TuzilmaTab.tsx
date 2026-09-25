import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, ArrowRight, BookOpen, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi, ApiXato } from './useImtihonApi';
import { Karta, Tugma, Yorliq, Yuklanmoqda } from './ui';
import KalitOynasi from './KalitOynasi';
import KalitMuharriri from './KalitMuharriri';
import type { ImtihonTafsil, TabId } from './turlar';

// 1-bo'lim: tuzilma, bank yetarliligi, savollarni qulflash (variantlar
// serverda yasaladi) va kalit.

interface Qoida {
  mavzu: string; tur: string; qiyinlik: number; kerak: number; bor: number; yetadi: boolean;
  sabab?: { qoralama?: number; xatoli?: number; boshqaQiyinlik?: number; boshqaTil?: number; fandaJami?: number };
}
interface KalitHolat { kalit: string; session: number; code: string; jami: number; toldirilgan: number; tayyor: boolean }
const TUR: Record<string, string> = { yopiq: 'yopiq', raqamli: 'raqamli', yozma: 'yozma' };

export default function TuzilmaTab({ exam, yangila, otish }: { exam: ImtihonTafsil; yangila: () => Promise<any>; otish: (tab: TabId) => void }) {
  const { ozgartira, kora, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.imtihon');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [bank, setBank] = useState<{ blok: string; qoidalar: Qoida[] }[] | null>(null);
  const [kalitlar, setKalitlar] = useState<KalitHolat[] | null>(null);
  const [kamchilik, setKamchilik] = useState<{ blok: string; mavzu: string; tur: string; kerak: number; bor: number }[] | null>(null);
  const [ogohlar, setOgohlar] = useState<string[]>([]);
  const [band, setBand] = useState(false);
  const [kalit, setKalit] = useState(false);
  const s = exam.settings;

  const kalitRejimi = s.source === 'kalit';
  const tekshir = useCallback(() => soro<{ bloklar: any[]; kalitlar?: KalitHolat[] }>('GET', `exams/${exam.id}/check`).then(r => { setBank(r.bloklar); setKalitlar(r.kalitlar || null); }).catch(e => showNotification(e.message, 'error')), [exam.id, soro, showNotification]);
  useEffect(() => { if (!exam.lockedAt) tekshir(); }, [exam.lockedAt, tekshir]);

  const qulfla = async () => {
    const savol = kalitRejimi
      ? "Kiritilgan kalitdan variantlar yasaladi. Shundan keyin imtihon tuzilmasi o'zgarmaydi (natija kiritilmaguncha qulfni ochish mumkin; kalitni esa keyin ham tuzatsa bo'ladi). Davom etilsinmi?"
      : "Savollar bankdan tanlanib, variantlar yasaladi. Shundan keyin imtihon tuzilmasi o'zgarmaydi (natija kiritilmaguncha qulfni ochish mumkin). Davom etilsinmi?";
    if (!(await confirm(savol))) return;
    setBand(true);
    setKamchilik(null);
    try {
      const r = await soro<{ ogohlantirishlar: string[]; variantlar: number }>('POST', `exams/${exam.id}/lock`);
      setOgohlar(r.ogohlantirishlar || []);
      showNotification(`${r.variantlar} ta variant tayyor`, 'success');
      await yangila();
    } catch (e: any) {
      if (e instanceof ApiXato && e.malumot?.kamchiliklar) setKamchilik(e.malumot.kamchiliklar);
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const qulfniOch = async () => {
    if (!(await confirm("Variantlar o'chiriladi, tuzilmani yana o'zgartirish mumkin bo'ladi. Chop etilgan kitobchalar yaroqsiz bo'lib qoladi. Davom etilsinmi?"))) return;
    setBand(true);
    try {
      await soro('POST', `exams/${exam.id}/unlock`);
      setOgohlar([]);
      await yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const hammasiYetadi = kalitRejimi ? !!kalitlar?.length && kalitlar.every(k => k.tayyor) : bank?.every(b => b.qoidalar.every(q => q.yetadi));
  const smenalar = [...new Set(exam.variantlar.map(v => v.session))];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {!exam.lockedAt && kalitRejimi ? (
          <Karta sarlavha="Kitobcha kaliti" izoh={`O'z kitobchangiz: har variantning (${s.variantCount > 1 ? 'A, B, …' : 'A'}) to'g'ri javoblari. Varaqdagi savol raqamlari kitobchadagi bilan bir xil bo'lishi kerak.`}>
            <KalitMuharriri exam={exam} onSaqlandi={() => { tekshir(); yangila(); }} />
          </Karta>
        ) : !exam.lockedAt ? (
          <Karta sarlavha="Savollar banki yetadimi" izoh={s.sessionQuestions === 'alohida' && s.sessions.length > 1 ? `Har smenaga alohida savol: kerakli son ${s.sessions.length} barobar` : 'Faqat faol va to\'liq to\'ldirilgan savollar hisoblanadi'}
            amallar={<Tugma kichik turi="oddiy" ikonka={<RefreshCw size={13} />} onClick={tekshir}>Qayta tekshirish</Tugma>}>
            {!bank ? <Yuklanmoqda /> : (
              <div className="space-y-3">
                {bank.map((b, i) => (
                  <div key={i}>
                    <p className="text-[12.5px] font-semibold text-matn mb-1.5">{b.blok}</p>
                    <div className="rounded-xl border border-chiziq divide-y divide-chiziq">
                      {b.qoidalar.map((q, j) => (
                        <div key={j} className="px-3 py-2 text-[12.5px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-matn">{q.mavzu || 'Istalgan mavzu'} <span className="text-matn-xira">· {TUR[q.tur]}{q.qiyinlik ? ` · qiyinlik ${q.qiyinlik}` : ''}</span></span>
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${q.yetadi ? 'text-yaxshi' : 'text-xato'}`}>
                              {q.yetadi ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                              bankda {q.bor} · kerak {q.kerak}
                            </span>
                          </div>
                          {!q.yetadi && <Sabab q={q} fan={b.blok} />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!hammasiYetadi && (
                  <div className="space-y-2 rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2.5 text-[12.5px] text-matn">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle size={15} className="text-ogoh" /> Bank yetmaydi — savol qo'shing yoki qoidani kamaytiring.
                      <Tugma kichik turi="oddiy" ikonka={<BookOpen size={13} />} onClick={() => navigate(`/exams?tab=savollar&imtihon=${exam.id}`)}>Savollar banki</Tugma>
                    </div>
                    {tahrir && <p className="text-[12px] text-matn-sokin">O'z test kitobchangiz bo'lsa — imtihon sozlamasida manbani «Faqat kalit» qiling: savollarsiz, faqat javob kaliti bilan tekshiriladi.</p>}
                  </div>
                )}
              </div>
            )}
          </Karta>
        ) : (
          <Karta sarlavha={kalitRejimi ? 'Variantlar kalitdan yasaldi' : 'Variantlar tayyor'} izoh={`Qulflangan: ${new Date(exam.lockedAt).toLocaleString('uz')}`}
            amallar={kora('imtihonlar.kalit') && <Tugma kichik ikonka={<KeyRound size={14} />} onClick={() => setKalit(true)}>Kalit</Tugma>}>
            <div className="space-y-2">
              {smenalar.map(sm => (
                <div key={sm} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] text-matn-sokin w-28">{s.sessions.find(x => x.id === sm)?.name || `${sm}-smena`}</span>
                  {exam.variantlar.filter(v => v.session === sm).map(v => <span key={v.code} className="w-8 h-8 rounded-lg bg-brand-fon border border-brand/25 text-brand-dark dark:bg-brand/20 dark:text-brand-accent flex items-center justify-center text-[13px] font-bold">{v.code}</span>)}
                </div>
              ))}
              <p className="text-[12px] text-matn-xira">Variant o'rinlashtirishda har o'ringa (2·qator + o'rin) bo'yicha beriladi — qo'shnilarda har xil.</p>
            </div>
          </Karta>
        )}

        {kamchilik && (
          <Karta sarlavha="Bank yetmadi — variantlar yasalmadi" className="border-xato-chiziq">
            <ul className="text-[12.5px] space-y-1">
              {kamchilik.map((k, i) => <li key={i}><b>{k.blok}</b> · {k.mavzu || 'istalgan mavzu'} · {TUR[k.tur]}: kerak {k.kerak}, bankda {k.bor}</li>)}
            </ul>
          </Karta>
        )}
        {ogohlar.length > 0 && (
          <Karta sarlavha="Ogohlantirishlar">
            <ul className="text-[12.5px] text-matn space-y-1 list-disc pl-5">{ogohlar.map((o, i) => <li key={i}>{o}</li>)}</ul>
          </Karta>
        )}

        <Karta sarlavha="Tuzilma">
          <div className="space-y-2">
            {exam.blocks.map((b, i) => (
              <div key={i} className="rounded-xl border border-chiziq p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-matn">{b.subject}</p>
                  {exam.scoring === 'blok' && <Yorliq rang="brand">{b.pointsPerQuestion} ball/savol</Yorliq>}
                </div>
                <ul className="mt-1.5 text-[12.5px] text-matn-sokin space-y-0.5">
                  {b.topicRules.map((r, j) => (
                    <li key={j}>
                      {kalitRejimi ? `${r.count} ta ${TUR[r.type || 'yopiq']}` : `${r.topic || 'Istalgan mavzu'} — ${r.count} ta ${TUR[r.type || 'yopiq']}`}
                      {!kalitRejimi && r.difficulty ? `, qiyinlik ${r.difficulty}` : ''}
                      {r.points != null ? `, har biri ${r.points} ball` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Karta>
      </div>

      <div className="space-y-4">
        <Karta sarlavha="Keyingi qadam">
          {!exam.lockedAt ? (
            <div className="space-y-3">
              <p className="text-[12.5px] text-matn-sokin">{kalitRejimi
                ? "Hamma kitobcha variantining kaliti kiritilgach — qulflang. Javob varaqalari shundan keyin chop etiladi."
                : "Savollar tayyor bo'lgach — qulflang. Variantlar serverda yasaladi, kalit faqat ruxsati borlarga ko'rinadi."}</p>
              {tahrir && <Tugma turi="asosiy" className="w-full" ikonka={<Lock size={14} />} yuklanmoqda={band} disabled={kalitRejimi ? !hammasiYetadi : bank !== null && !hammasiYetadi} onClick={qulfla}>Savollarni qulflash</Tugma>}
              {kalitRejimi && kalitlar && !hammasiYetadi && (
                <p className="text-[12px] text-matn-xira">Kalit to'liq emas: {kalitlar.map(k => `${k.code} ${k.toldirilgan}/${k.jami}`).join(', ')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <KeyingiQadam exam={exam} otish={otish} />
              {tahrir && exam._count.results === 0 && <Tugma className="w-full" turi="oddiy" ikonka={<Unlock size={14} />} yuklanmoqda={band} onClick={qulfniOch}>Qulfni ochish</Tugma>}
            </div>
          )}
        </Karta>
        <Karta sarlavha="Sozlamalar">
          <dl className="text-[12.5px] space-y-1.5">
            <Qator k="Savollar" v={kalitRejimi ? "O'z kitobchasi (faqat kalit)" : 'Savollar bankidan'} />
            <Qator k="Ball tizimi" v={exam.scoring === 'blok' ? 'Blok bali' : 'Foiz'} />
            <Qator k="Smenalar" v={s.sessions.map(x => `${x.name}${x.time ? ` (${x.time})` : ''}`).join(', ')} />
            {s.sessions.length > 1 && <Qator k="Smenalarga savol" v={s.sessionQuestions === 'alohida' ? 'Har biriga boshqa' : 'Bir xil'} />}
            <Qator k="Variantlar" v={`${s.variantCount} ta`} />
            {!kalitRejimi && <Qator k="Aralashtirish" v={[s.shuffleQuestions && 'savollar', s.shuffleOptions && 'javoblar'].filter(Boolean).join(', ') || "yo'q"} />}
            {kalitRejimi && <Qator k="Javob variantlari" v={`${s.optionCount} ta (${HARF_ROYXAT.slice(0, s.optionCount).join(', ')})`} />}
            <Qator k="O'rinlar" v={s.seatMode === 'shaxmat' ? 'Shaxmat' : "Har o'rin"} />
            <Qator k="Reyting" v={s.ranking === 'hammasi' ? "Hammaga o'rni" : s.ranking === 'top' ? `Top ${s.topN}` : "Yo'q"} />
            <Qator k="Xabar" v={{ BOTH: 'Telegram / SMS', TELEGRAM: 'Telegram', SMS: 'SMS', NONE: 'Yuborilmaydi' }[s.notify.channel]} />
          </dl>
        </Karta>
      </div>
      {kalit && !kalitRejimi && <KalitOynasi examId={exam.id} onYop={ozgardi => { setKalit(false); if (ozgardi) yangila(); }} />}
      {kalit && kalitRejimi && <KalitMuharririOynasi exam={exam} onYop={() => { setKalit(false); yangila(); }} />}
    </div>
  );
}

const HARF_ROYXAT = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Qulflangan imtihon qaysi bosqichda — shu bosqichga qarab keyingi ish va tugma. */
function KeyingiQadam({ exam, otish }: { exam: ImtihonTafsil; otish: (tab: TabId) => void }) {
  const h = exam.holat;
  const [matn, tugmalar]: [string, [TabId, string][]] =
    exam.publishedAt ? ["Natijalar e'lon qilingan. Tahlil, reyting va xabarlar holati — «Natijalar» tabida.", [['natija', 'Natijalar']]]
      : !h.orinlar && !h.natijalar ? ["Endi qatnashchilarni o'rinlashtiring — har o'ringa variant beriladi. Keyin javob varaqalarini chop etasiz.", [['orin', "O'rinlashtirish"]]]
        : !h.natijalar ? [`${h.orinlar} ta qatnashchi o'rinlashgan. Javob varaqalarini chop eting; imtihondan keyin to'ldirilgan varaqlar skanerlanadi.`, [['chop', 'Chop etish'], ['skaner', 'Skaner']]]
          : h.skanerlanmagan || h.shubhali ? [`Skanerlangan: ${h.natijalar}. ${h.skanerlanmagan ? `Varag'i yo'q: ${h.skanerlanmagan}. ` : ''}${h.shubhali ? `Tekshirilmagan: ${h.shubhali}.` : ''}`, [['skaner', 'Skaner'], ['natija', 'Natijalar']]]
            : [`Hamma varaq skanerlangan va tekshirilgan (${h.natijalar} ta). Savollar tahlilini ko'rib, natijani e'lon qiling.`, [['natija', "Natijalar va e'lon"]]];
  return (
    <>
      <p className="text-[12.5px] text-matn-sokin">{matn}</p>
      {tugmalar.map(([tab, nom], i) => (
        <Tugma key={tab} turi={i === 0 ? 'asosiy' : 'ikkinchi'} className="w-full" onClick={() => otish(tab)}>{nom} <ArrowRight size={14} /></Tugma>
      ))}
    </>
  );
}

/** Nega bankda yetmayapti — mos savollar boshqa holatda, qiyinlikda yoki tilda. */
function Sabab({ q, fan }: { q: Qoida; fan: string }) {
  const s = q.sabab || {};
  const qatorlar: string[] = [];
  if (!s.fandaJami) qatorlar.push(`Bankda «${fan}» fanidan savol yo'q — savollardagi fan nomi imtihondagi bilan bir xil yozilganini tekshiring.`);
  if (s.boshqaQiyinlik) qatorlar.push(`Qiyinlik ${q.qiyinlik} tanlangan — boshqa qiyinlikdagi ${s.boshqaQiyinlik} ta savol hisobga olinmadi («Har qanday qiyinlik» qiling).`);
  if (s.qoralama) qatorlar.push(`${s.qoralama} ta mos savol qoralamada — bankda «Faol» qiling.`);
  if (s.xatoli) qatorlar.push(`${s.xatoli} ta mos savol chala (kalit yoki variant yo'q).`);
  if (s.boshqaTil) qatorlar.push(`${s.boshqaTil} ta mos savol boshqa tilda (imtihon sozlamasidagi «Savollar tili»).`);
  if (!qatorlar.length) return null;
  return <ul className="mt-1 space-y-0.5 text-[11.5px] text-matn-sokin list-disc pl-5">{qatorlar.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

/** Qulflangan "faqat kalit" imtihonida kalitni tuzatish oynasi. */
function KalitMuharririOynasi({ exam, onYop }: { exam: ImtihonTafsil; onYop: () => void }) {
  return (
    <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-5xl border border-chiziq my-4">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn">Kitobcha kaliti</h3>
            <p className="text-[12px] text-matn-xira">Kalitni tuzatsangiz — hamma natija qayta hisoblanadi</p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5"><KalitMuharriri exam={exam} /></div>
      </div>
    </div>
  );
}

function Qator({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-matn-xira">{k}</dt><dd className="text-matn text-right font-medium">{v}</dd></div>;
}
