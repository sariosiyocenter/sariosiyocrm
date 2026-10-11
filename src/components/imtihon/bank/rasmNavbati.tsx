import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Square } from 'lucide-react';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma } from '../ui';
import VektorRasm from './VektorRasm';
import { rasmlarniChiz, rasmBelgisiBor, rasmBelgisiz, type RasmIshi, type RasmNatijasi, type RasmSorovi } from '../../../lib/svgRasm';

// Savol qo'shish oynalarida (Fayldan, AI tuzadi, o'xshash savollar) savol chizmasini AI vektor qilib
// chizadi (egasi, 2026-10-10: «savollar rasmli bo'ladi yoki o'xshash savol tuzganda — vector qilib rasm
// tuzsin»). Chizmaning o'zi — VektorRasm.tsx va lib/svgRasm.ts; bu yerda oynalar uchun umumiy qism:
//   - savoldagi chizma holati (RasmliSavol) va uni qo'yish / olib tashlash;
//   - ko'p savolni NAVBAT bilan chizdirish (bir vaqtda 2 ta, to'xtatsa bo'ladi) va uning ko'rinishi;
//   - kartadagi chizma bloki (SavolRasmi).
// AI rasm o'rniga matnda «[rasm]» belgisini qoldiradi: chizma qo'yilsa belgi matndan olinadi, chizilmasa
// belgi qoladi va savol qoralama bo'lib tushadi (kitobchaga «[rasm]» so'zi chiqib ketmasin).

/** Savolning chizma holati (ko'rib chiqish kartasida). */
export interface RasmHolati {
  /** Navbatda yoki chizilmoqda. */
  band?: boolean;
  /** Navbatdagi chizish xatosi (limit, internet…). */
  xato?: string | null;
  /** AI bu savolga chizma kerak emas deb topdi. */
  kerakEmas?: boolean;
  /** Chizmaning avtomatik tekshiruvda topilgan kamchiliklari. */
  ogohlar?: string[];
}

/** Chizmali bo'lishi mumkin bo'lgan savol (yoki guruhli savolning umumiy sharti). */
export interface RasmliSavol {
  text: string;
  imageUrl?: string | null;
  /** Chizma qo'yilishidan oldingi matn («[rasm]» belgisi yoki ichki rasmi bilan) — chizma olib tashlansa qaytadi. */
  aslMatn?: string;
  rasm?: RasmHolati;
}

const RASM_TEGI = /<img\b[^>]*>/gi;
const RASM_BOR = /<img\b/i;
/** Matndagi YAGONA ichki rasm (Word shablonidan kelgan savol): manzili; yo'q yoki bir nechta bo'lsa — null. */
export function ichkiRasm(html: string | null | undefined): string | null {
  const teglar = String(html || '').match(RASM_TEGI);
  return teglar?.length === 1 ? /\bsrc="([^"]+)"/i.exec(teglar[0])?.[1] || null : null;
}
/** Matndagi hamma ichki rasm manzillari (asl masalaning chizmasi — o'xshashlarini chizishda namuna). */
export const ichkiRasmlar = (html: string | null | undefined): string[] =>
  (String(html || '').match(RASM_TEGI) || []).map(t => /\bsrc="([^"]+)"/i.exec(t)?.[1] || '').filter(Boolean);

/** Chizma qo'yilganda matndan olinadigani: «[rasm]» belgisi; `ichki` — yagona ichki rasm ham (o'rnini chizma egallaydi). */
const chizmasizMatn = (html: string, ichki: boolean) => {
  const t = rasmBelgisiz(html);
  return ichki && ichkiRasm(t) ? t.replace(RASM_TEGI, '').replace(/<p>\s*<\/p>/g, '') : t;
};

/** Savolga chizma kerakmi (blok ko'rinadi): matnda belgi bor, chizma qo'yilgan yoki chizish urinilgan. */
export const rasmKerakmi = (q: RasmliSavol): boolean => rasmBelgisiBor(q.text) || !!q.imageUrl || !!q.rasm;
/** Chizmasi hali yo'q (belgi matnda qolgan) — bunday savol faol bo'lmaydi. */
export const rasmYetishmaydi = (q: RasmliSavol): boolean => rasmBelgisiBor(q.text);

/** Matn oxiriga qo'shimcha (belgi yoki rasm tegi): oxirgi xatboshi ichiga, xatboshi bo'lmasa — matn ketidan. */
const oxirigaQosh = (html: string, qoshimcha: string, alohida: boolean) =>
  (alohida ? `${html}<p>${qoshimcha}</p>` : /<\/p>\s*$/i.test(html) ? html.replace(/<\/p>\s*$/i, ` ${qoshimcha}</p>`) : `${html} ${qoshimcha}`);

/**
 * Chizma olib tashlanganda matn. O'zgarmagan bo'lsa — asl holi (belgisi yoki ichki rasmi bilan). Ustoz
 * tahrirlagan bo'lsa — uning matni qoladi, lekin chizma joyi yo'qolmaydi: belgi (ichki rasm) qayta qo'yiladi.
 * Aks holda chizmaga tayangan masala rasmsiz, belgisiz qolib, faol bo'lib ketardi.
 */
function chizmasizdanAsliga(q: RasmliSavol, ichki: boolean): string {
  if (q.aslMatn === undefined) return q.text;
  if (chizmasizMatn(q.aslMatn, ichki) === q.text) return q.aslMatn;
  if (rasmBelgisiBor(q.aslMatn) && !rasmBelgisiBor(q.text)) return oxirigaQosh(q.text, '[rasm]', false);
  const asliTegi = ichki && ichkiRasm(q.aslMatn) ? q.aslMatn.match(RASM_TEGI)![0] : null;
  return asliTegi && !RASM_BOR.test(q.text) ? oxirigaQosh(q.text, asliTegi, true) : q.text;
}

/**
 * Chizma qo'yildi (`url`) yoki olib tashlandi (null). Qo'yilganda belgi (va `ichki` bo'lsa — asl ichki
 * rasm) matndan olinadi; olib tashlanganda matn asl holiga qaytadi (chizmasizdanAsliga).
 */
export function rasmniQoy<T extends RasmliSavol>(q: T, url: string | null, o: { ogohlar?: string[]; ichki?: boolean } = {}): T {
  if (url) {
    const birinchi = q.aslMatn === undefined;
    return { ...q, imageUrl: url, aslMatn: birinchi ? q.text : q.aslMatn, text: birinchi ? chizmasizMatn(q.text, !!o.ichki) : q.text, rasm: o.ogohlar?.length ? { ogohlar: o.ogohlar } : undefined };
  }
  return { ...q, imageUrl: null, text: chizmasizdanAsliga(q, !!o.ichki), aslMatn: undefined, rasm: undefined };
}

/**
 * Chizma shu matn bo'yicha chiziladi: matn o'zgarmagan bo'lsa — asl holi (belgi chizma joyini ko'rsatadi);
 * ustoz tahrirlagan bo'lsa — uning matni (eski sonlar bilan chizilmasin).
 */
export const chizmaMatni = (q: RasmliSavol, ichki = false): string =>
  (q.aslMatn !== undefined && chizmasizMatn(q.aslMatn, ichki) === q.text ? q.aslMatn : q.text);

/** Navbatdan kelgan natija savolga qo'yiladi: chizma yoki xato (kartada «qayta urinish» qoladi). */
export function rasmNatijasiniQoy<T extends RasmliSavol>(q: T, n: RasmNatijasi, o: { ichki?: boolean } = {}): T {
  if (n.rasm) return rasmniQoy(q, n.rasm.url, { ogohlar: n.rasm.ogohlar, ichki: o.ichki });
  const { xato, kerakEmas } = xatoQismi(n);
  return { ...q, rasm: xato || kerakEmas ? { xato: kerakEmas ? null : xato, kerakEmas } : undefined };
}
/** Natijaning xato tomoni (loyihada strictNullChecks yo'q — birlashma turi o'zi torayib bermaydi). */
const xatoQismi = (n: RasmNatijasi): { xato: string; kerakEmas: boolean } => {
  const x = n as { xato?: string; kerakEmas?: boolean };
  return { xato: x.xato || '', kerakEmas: !!x.kerakEmas };
};

/** Navbat uchun ish: savolning (belgili) matni va qolgan ma'lumot. */
export const rasmIshi = (kalit: number, q: RasmliSavol, sorov: Omit<RasmSorovi, 'matn'>): RasmIshi<number> =>
  ({ kalit, sorov: { ...sorov, matn: chizmaMatni(q) } });

export interface NavbatHolati { tugadi: number; jami: number; toxtamoqda: boolean }

/**
 * Ko'p savolning chizmasini navbat bilan chizdiradi: bir vaqtda 2 ta (har chizma — AI ga 1–2 so'rov,
 * markazning o'z kaliti bilan). Xodim to'xtatishi mumkin; oyna yopilsa o'zi to'xtaydi. Limit tugasa
 * navbat to'xtaydi va xato kartalarda ko'rinadi — qayta urinish faqat xodim bosganda.
 */
export function useRasmNavbati() {
  const { soro } = useImtihonApi();
  const [holat, setHolat] = useState<NavbatHolati | null>(null);
  // Har navbatning o'z «to'xta» belgisi: to'xtatilgan navbatning kechikkan natijalari yangisiga aralashmaydi.
  const joriy = useRef<{ toxta: boolean } | null>(null);
  const tirik = useRef(true);
  useEffect(() => {
    tirik.current = true;
    return () => { tirik.current = false; if (joriy.current) joriy.current.toxta = true; };
  }, []);

  const chiz = useCallback(async (ishlar: RasmIshi<number>[], onNatija: (kalit: number, natija: RasmNatijasi) => void) => {
    const hisobot = { chizildi: 0, chizilmadi: 0, xato: '', toxtatildi: false };
    // Oyna yopilgan (uzoq tahlil tugaguncha xodim chiqib ketgan) — natijasi hech kimga kerak emas, AI so'ralmaydi.
    if (!ishlar.length || !tirik.current) return hisobot;
    if (joriy.current) joriy.current.toxta = true;
    const navbat = { toxta: false };
    joriy.current = navbat;
    let tugadi = 0;
    setHolat({ tugadi: 0, jami: ishlar.length, toxtamoqda: false });
    await rasmlarniChiz(soro, ishlar, {
      birVaqtda: 2,
      toxta: () => navbat.toxta,
      onNatija: (kalit, n) => {
        if (!tirik.current) return;
        tugadi++;
        // To'xtatilgandan keyin chizilmay qolganlari — xato emas: kartada oddiy «chizish» tugmasi qoladi.
        const natija: RasmNatijasi = !n.rasm && navbat.toxta ? { xato: '' } : n;
        const x = xatoQismi(natija);
        if (natija.rasm) hisobot.chizildi++;
        else if (!x.kerakEmas && x.xato) { hisobot.chizilmadi++; hisobot.xato ||= x.xato; }
        onNatija(kalit, natija);
        if (joriy.current === navbat) setHolat(h => h && { ...h, tugadi });
      },
    });
    hisobot.toxtatildi = navbat.toxta;
    if (tirik.current && joriy.current === navbat) { joriy.current = null; setHolat(null); }
    return hisobot;
  }, [soro]);

  const toxtat = useCallback(() => {
    if (!joriy.current) return;
    joriy.current.toxta = true;
    setHolat(h => h && { ...h, toxtamoqda: true });
  }, []);

  // `band` — chizish ketmoqda (saqlash kutadi). To'xtatish bosilgach saqlash ochiladi: boshlangan chizma
  // uzoq cho'zilishi mumkin (limit kutilyapti), kechikkan natijasi yopilgan oynaga yozilmaydi.
  return { holat, band: !!holat && !holat.toxtamoqda, chiz, toxtat };
}

/** Navbat ko'rinishi: «Rasmlar chizilmoqda 3/7» va «To'xtatish». */
export function RasmJarayoni({ holat, onToxtat }: { holat: NavbatHolati | null; onToxtat: () => void }) {
  if (!holat) return null;
  return (
    <div className="space-y-1.5" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[12.5px] text-matn-sokin">
          <Loader2 size={14} className="animate-spin" />
          {holat.toxtamoqda ? "To'xtatilmoqda — boshlangan chizma tugashi kutilmoqda…" : `Rasmlar chizilmoqda ${holat.tugadi}/${holat.jami}`}
        </p>
        {!holat.toxtamoqda && <Tugma kichik turi="oddiy" ikonka={<Square size={11} />} onClick={onToxtat}>To'xtatish</Tugma>}
      </div>
      <div className="h-1.5 rounded-full bg-ichki overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${Math.round((holat.tugadi / holat.jami) * 100)}%` }} /></div>
    </div>
  );
}

/**
 * Kartadagi chizma bloki: VektorRasm (chizish, ko'rsatma bilan qayta chizish, olib tashlash) va navbatdan
 * kelgan xato. `sorov` — chizma so'rovining matndan boshqa qismi (variantlar, javob, fan, raqam, asl rasm
 * yoki namuna). `ichki` — savolning asl rasmi matn ichida (Word shablon): chizma uning o'rnini oladi.
 */
export function SavolRasmi<T extends RasmliSavol>({ q, sorov, ichki, band, onOzgar }: {
  q: T;
  sorov: Omit<RasmSorovi, 'matn' | 'avvalgiSvg' | 'korsatma'>;
  ichki?: boolean;
  band?: boolean;
  /**
   * O'zgarish — FUNKSIYA bo'lib beriladi va host uni savolning HOZIRGI holatiga qo'llaydi: chizma 10–40
   * soniyada keladi, shu orada ustoz belgilagan javob, daraja yoki mavzu eski nusxa bilan bosilib ketmasin.
   */
  onOzgar: (ozgartir: (hozirgi: T) => T) => void;
}) {
  const kutmoqda = !!q.rasm?.band;
  return (
    <div className="space-y-1.5">
      <VektorRasm
        matn={chizmaMatni(q, ichki)} shart={sorov.shart} variantlar={sorov.variantlar} javob={sorov.javob} fan={sorov.fan} raqam={sorov.raqam}
        aslRasm={sorov.aslRasm} namuna={sorov.namuna} qiymat={q.imageUrl ?? null} band={band || kutmoqda} ogohlar={q.rasm?.ogohlar}
        onChange={url => onOzgar(hozirgi => rasmniQoy(hozirgi, url, { ichki }))}
      />
      {!q.imageUrl && !kutmoqda && q.rasm?.xato && (
        <p role="alert" className="flex items-start gap-1.5 text-[12px] text-xato">
          <AlertTriangle size={13} className="shrink-0 mt-px" /><span>Chizma chizilmadi: {q.rasm.xato}. «Vektor qilib chizish» ni bosib qayta urinib ko'ring.</span>
        </p>
      )}
      {!q.imageUrl && !kutmoqda && rasmBelgisiBor(q.text) && (
        <p className="text-[11.5px] text-matn-xira">
          {q.rasm?.kerakEmas ? 'AI bu savolga chizma kerak emas deb topdi. ' : "Chizmasiz savol qoralama bo'lib tushadi. "}
          <button type="button" disabled={band} onClick={() => onOzgar(hozirgi => ({ ...hozirgi, text: rasmBelgisiz(hozirgi.text), rasm: undefined }))}
            className="font-semibold text-brand hover:underline cursor-pointer disabled:opacity-50">Chizma kerak emas — «[rasm]» belgisini olib tashlash</button>
        </p>
      )}
    </div>
  );
}
