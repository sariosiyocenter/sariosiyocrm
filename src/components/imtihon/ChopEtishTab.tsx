import React, { useMemo, useState } from 'react';
import { BookOpen, FileText, DoorOpen, ClipboardList, Printer, Info } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Almashtirgich, Yuklanmoqda, BoshHolat } from './ui';
import { useOrinlar } from './QatnashchilarTab';
import { chopEt } from '../../lib/chopEtish';
import { varaqSahifalari } from '../../lib/omr/layout';
import { varaqSvg, VARAQ_CSS } from '../../lib/omr/render';
import { kitobchaHtml, KITOBCHA_CSS, katexCss, eshikRoyxatiHtml, vedomostHtml, ROYXAT_CSS } from './chop';
import type { KitobchaMalumoti } from './chop';
import { varaqTuzilmasi } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from '../ExamDetail';

// 3-bo'lim: kitobchalar (variant bo'yicha, ksero qilinadi), shaxsiy javob
// varaqalari (xona → qator → o'rin tartibida — dasta xonaga shu tartibda
// kiradi), universal varaqlar (kechikkan yoki ro'yxatda yo'qlar uchun),
// eshik ro'yxati va nazoratchi vedomosti.

export default function ChopEtishTab({ exam }: { exam: ImtihonTafsil }) {
  const { settings, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const { data } = useOrinlar(exam.id);
  const s = exam.settings;
  const [smena, setSmena] = useState(s.sessions[0]?.id || 1);
  const [xona, setXona] = useState<number | 0>(0);
  const [rasmli, setRasmli] = useState(true);
  const [universalSoni, setUniversalSoni] = useState(10);
  const [band, setBand] = useState<string | null>(null);
  const markaz = settings?.orgName || '';

  const orinlar = useMemo(() => (data?.seats || []).filter(o => o.session === smena && o.roomId && (!xona || o.roomId === xona))
    .sort((a, b) => (a.roomName || '').localeCompare(b.roomName || '') || (a.roomId! - b.roomId!) || (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0)), [data, smena, xona]);
  const xonalar = useMemo(() => [...new Map((data?.seats || []).filter(o => o.session === smena && o.roomId).map(o => [o.roomId!, o.roomName])).entries()], [data, smena]);
  const sahifalar = useMemo(() => varaqSahifalari({
    tuzilma: varaqTuzilmasi(exam.blocks, exam.scoring) as any,
    optionCount: s.optionCount, variantCount: s.variantCount, variantBubble: s.variantBubble,
  }), [exam, s]);
  const smenaNomi = (id: number) => { const x = s.sessions.find(y => y.id === id); return x ? `${x.name}${x.time ? ` (${x.time})` : ''}` : `${id}-smena`; };
  const umumiy = { markaz, imtihon: exam.name, sana: exam.date, examId: exam.id, session: smena, smena: smenaNomi(smena) };

  // Kitobcha nusxalari: har variantga nechta (5% zaxira bilan).
  const nusxalar = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of data?.seats || []) if (o.session === smena && o.variant) m.set(o.variant, (m.get(o.variant) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, smena]);

  const ish = async (nom: string, f: () => Promise<void>) => {
    setBand(nom);
    try { await f(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };

  const kitobcha = (kodlar: string[]) => ish(`kitobcha-${kodlar.join('')}`, async () => {
    const d = await soro<KitobchaMalumoti>('GET', `exams/${exam.id}/booklets?session=${smena}`);
    const body = kitobchaHtml(exam, markaz, d, kodlar.map(code => ({ session: smena, code })));
    await chopEt({ sarlavha: `${exam.name} — kitobcha ${kodlar.join(', ')}`, css: katexCss() + KITOBCHA_CSS, body });
  });

  const varaqlar = () => ish('varaq', async () => {
    if (!orinlar.length) throw new Error("Bu smenada o'rinlashtirilgan qatnashchi yo'q");
    const body = orinlar.map(o => sahifalar.map(sh => `<div class="varaq">${varaqSvg(sh, umumiy, {
      ism: o.name, kurs: o.groupName, xona: o.roomName, qator: o.row != null ? o.row + 1 : null, orin: o.col != null ? o.col + 1 : null,
      variant: o.variant, sheetCode: o.sheetCode, rasm: rasmli ? o.photo : null, mehmon: o.mehmon,
    })}</div>`).join('')).join('');
    await chopEt({ sarlavha: `${exam.name} — javob varaqalari`, css: VARAQ_CSS, body, kutish: 45000 });
  });

  const universal = () => ish('universal', async () => {
    const n = Math.max(1, Math.min(500, universalSoni));
    const bitta = sahifalar.map(sh => `<div class="varaq">${varaqSvg(sh, umumiy, null)}</div>`).join('');
    await chopEt({ sarlavha: `${exam.name} — universal varaqlar`, css: VARAQ_CSS, body: bitta.repeat(n) });
  });

  const royxat = (turi: 'eshik' | 'vedomost') => ish(turi, async () => {
    if (!orinlar.length) throw new Error("Bu smenada o'rinlashtirilgan qatnashchi yo'q");
    const guruh = new Map<number, typeof orinlar>();
    for (const o of orinlar) { if (!guruh.has(o.roomId!)) guruh.set(o.roomId!, []); guruh.get(o.roomId!)!.push(o); }
    const body = [...guruh.values()].map(l => (turi === 'eshik' ? eshikRoyxatiHtml : vedomostHtml)({ exam, smena: smenaNomi(smena), xona: l[0].roomName, orinlar: l })).join('');
    await chopEt({ sarlavha: `${exam.name} — ${turi === 'eshik' ? 'eshik ro\'yxati' : 'vedomost'}`, css: ROYXAT_CSS, body });
  });

  if (!exam.lockedAt) {
    return <Karta><BoshHolat ikonka={<Printer size={20} />} sarlavha="Avval savollarni qulflang" izoh="Kitobcha va varaqlar variantlar tayyor bo'lgach chiqadi (1-bo'lim: Tuzilma)." /></Karta>;
  }
  if (!data) return <Yuklanmoqda />;

  const variantlar = exam.variantlar.filter(v => v.session === smena).map(v => v.code);

  return (
    <div className="space-y-4">
      <Karta>
        <div className="flex flex-wrap items-end gap-3">
          {s.sessions.length > 1 && (
            <Maydon nom="Smena" className="w-48">
              <select className={SELECT} value={smena} onChange={e => { setSmena(Number(e.target.value)); setXona(0); }}>
                {s.sessions.map(x => <option key={x.id} value={x.id}>{smenaNomi(x.id)}</option>)}
              </select>
            </Maydon>
          )}
          <Maydon nom="Xona" className="w-56">
            <select className={SELECT} value={xona} onChange={e => setXona(Number(e.target.value))}>
              <option value={0}>Hamma xona ({(data.seats || []).filter(o => o.session === smena && o.roomId).length} kishi)</option>
              {xonalar.map(([id, nom]) => <option key={id} value={id}>{nom} ({data.seats.filter(o => o.session === smena && o.roomId === id).length})</option>)}
            </select>
          </Maydon>
          <p className="pb-2.5 text-[12px] text-matn-xira flex items-center gap-1.5"><Info size={13} /> Chop etish oynasida «Masshtab: 100%» (Actual size) va «Chetlar: yo'q» tanlang.</p>
        </div>
      </Karta>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Karta sarlavha="Kitobchalar" izoh="Har variantdan bittadan chop eting va ksero qiling">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {variantlar.map(code => (
                <Tugma key={code} kichik ikonka={<BookOpen size={13} />} yuklanmoqda={band === `kitobcha-${code}`} onClick={() => kitobcha([code])}>Variant {code}</Tugma>
              ))}
              {variantlar.length > 1 && <Tugma kichik turi="asosiy" yuklanmoqda={band === `kitobcha-${variantlar.join('')}`} onClick={() => kitobcha(variantlar)}>Hammasi</Tugma>}
            </div>
            {nusxalar.length > 0 && (
              <div className="rounded-xl bg-ichki border border-chiziq p-3">
                <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Kerakli nusxalar ({smenaNomi(smena)}, 5% zaxira bilan)</p>
                <div className="flex flex-wrap gap-2">
                  {nusxalar.map(([v, n]) => <span key={v} className="px-2.5 py-1 rounded-lg bg-sirt border border-chiziq text-[12.5px]"><b className="text-brand">{v}</b> — {Math.ceil(n * 1.05)} ta</span>)}
                </div>
              </div>
            )}
          </div>
        </Karta>

        <Karta sarlavha="Javob varaqalari" izoh="Har qatnashchiga shaxsiy: ism, rasm, o'rin, varaq kodi (QR)">
          <div className="space-y-3">
            <Almashtirgich yoqilgan={rasmli} onChange={setRasmli} nom="O'quvchi rasmi bilan" izoh="Kirishda shaxsni tekshirish uchun; rasmsiz chop etish tezroq" />
            <Tugma turi="asosiy" ikonka={<FileText size={14} />} yuklanmoqda={band === 'varaq'} disabled={!orinlar.length} onClick={varaqlar}>
              {orinlar.length} ta varaq{sahifalar.length > 1 ? ` × ${sahifalar.length} sahifa` : ''} — chop etish
            </Tugma>
            <p className="text-[11.5px] text-matn-xira">Tartib: xona → qator → o'rin. Dastani xonaga olib kirib, o'rinma-o'rin tarqating.</p>
          </div>
        </Karta>

        <Karta sarlavha="Universal varaqlar" izoh="Ro'yxatda yo'q yoki varag'i buzilganlar uchun: o'quvchi ID raqamini o'zi bo'yaydi">
          <div className="flex flex-wrap items-end gap-3">
            <Maydon nom="Nechta" className="w-28"><input type="number" min={1} max={500} className={INPUT} value={universalSoni} onChange={e => setUniversalSoni(Number(e.target.value))} /></Maydon>
            <Tugma ikonka={<Printer size={14} />} yuklanmoqda={band === 'universal'} onClick={universal}>Chop etish</Tugma>
          </div>
          <p className="text-[11.5px] text-matn-xira mt-2">ID raqam nazoratchi vedomostida bor (varag'i buzilgan o'quvchiga). Skaner uni doirachalardan o'qiydi; ro'yxatda yo'q qatnashchini skanerda qo'lda tanlaysiz.</p>
        </Karta>

        <Karta sarlavha="Ro'yxatlar" izoh="Har xona alohida sahifa">
          <div className="flex flex-wrap gap-2">
            <Tugma ikonka={<DoorOpen size={14} />} yuklanmoqda={band === 'eshik'} disabled={!orinlar.length} onClick={() => royxat('eshik')}>Eshik ro'yxati (alifbo)</Tugma>
            <Tugma ikonka={<ClipboardList size={14} />} yuklanmoqda={band === 'vedomost'} disabled={!orinlar.length} onClick={() => royxat('vedomost')}>Nazoratchi vedomosti</Tugma>
          </div>
        </Karta>
      </div>
    </div>
  );
}
