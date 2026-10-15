import React, { useId, useMemo } from 'react';
import { bolinmaQadami, chizmaChegarasi, jismBolaklari, jismUchlari } from '../../../../lib/darsChizma.js';
import { ifodaniKompilyatsiya } from '../../../../lib/ifoda.js';
import type { ChizmaElementi } from './darsTurlari';

// Video yechim doskasidagi chizma (lib/darsChizma.js elementlari). Har element doskaga birinchi marta
// chiqqanda bo'r bilan chizilgandek "yoziladi" (SVG chiziq uzunligi bo'yicha ochiladi); avval
// chizilganlari joyida qoladi. Koordinatalar matematik — bu yerda pikselga o'giriladi, o'lcham
// butun dars elementlaridan olinadi: chizma qadamdan qadamga siljib ketmaydi. Matnlar React matni
// (innerHTML yo'q).

const KENGLIK = 400;
const BALANDLIK_MAX = 360;
const CHET = 26;
const RANG: Record<string, string> = { asosiy: 'var(--dars-bor)', urgu: 'var(--dars-urgu)', ikkinchi: '#f2c46b' };
const GRAFIK_NUQTALARI = 240;
const OQ_KECHIKISH = 0.6;
/** Juda yassi grafikda balandlik kenglikning kamida shuncha ulushi bo'ladi. */
const YASSI_ULUSH = 0.55;

export interface ChizmaKorinishi { kalit: string; e: ChizmaElementi }

/** π/2 ning karralisi → belgi: π/2, π, 3π/2, 2π, −π/2… */
function piBelgisi(v: number): string {
  const k = Math.round(v / (Math.PI / 2));
  const ishora = k < 0 ? '−' : '';
  const m = Math.abs(k);
  if (m % 2 === 0) return `${ishora}${m === 2 ? '' : m / 2}π`;
  return `${ishora}${m === 1 ? '' : m}π/2`;
}

type Px = (x: number, y: number) => [number, number];
const yol = (nuqtalar: [number, number][], yopiq = false) =>
  nuqtalar.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + (yopiq ? 'Z' : '');

/** Chiziq: oddiyi — "chizilib" chiqadi, uzug'i (punktir) — asta paydo bo'ladi. */
function Chiziq({ d, rang, uzuq, qalin = 2.2, kechikish = 0 }: { d: string; rang: string; uzuq?: boolean; qalin?: number; kechikish?: number }) {
  return uzuq
    ? <path d={d} fill="none" stroke={rang} strokeWidth={qalin * 0.8} strokeDasharray="6 5" strokeLinecap="round" className="dars-chiz-paydo" style={{ animationDelay: `${kechikish}s` }} />
    : <path d={d} fill="none" stroke={rang} strokeWidth={qalin} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="dars-chiz" style={{ animationDelay: `${kechikish}s` }} />;
}

function Belgi({ x, y, matn, rang, kechikish = 0.4, kattaroq }: { x: number; y: number; matn: string; rang: string; kechikish?: number; kattaroq?: boolean }) {
  return <text x={x} y={y} fill={rang} fontSize={kattaroq ? 15 : 13} fontWeight={600} textAnchor="middle" dominantBaseline="middle" className="dars-chiz-paydo" style={{ animationDelay: `${kechikish}s` }}>{matn}</text>;
}

function strelka(a: [number, number], b: [number, number]): string {
  const burchak = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const uz = 9;
  const p1: [number, number] = [b[0] - uz * Math.cos(burchak - 0.4), b[1] - uz * Math.sin(burchak - 0.4)];
  const p2: [number, number] = [b[0] - uz * Math.cos(burchak + 0.4), b[1] - uz * Math.sin(burchak + 0.4)];
  return yol([p1, b, p2]);
}

/** Ellips (yoki uning old/orqa yarmi) — piksel koordinatada. */
function ellipsYoli(cx: number, cy: number, rx: number, ry: number, yarim: 'old' | 'orqa' | null): string {
  if (yarim === 'old') return `M${cx - rx},${cy}A${rx},${ry} 0 0 0 ${cx + rx},${cy}`;
  if (yarim === 'orqa') return `M${cx - rx},${cy}A${rx},${ry} 0 0 1 ${cx + rx},${cy}`;
  return `M${cx - rx},${cy}A${rx},${ry} 0 1 0 ${cx + rx},${cy}A${rx},${ry} 0 1 0 ${cx - rx},${cy}`;
}

type Uchlar = ReturnType<typeof jismUchlari>;

// memo: pleer soati sekundiga ~15 marta yangilanadi — o'zgarmagan element (va grafik nuqtalari) qayta hisoblanmaydi.
const Element = React.memo(function Element({ e, px, s, ch, kesim, uchlar }: { e: ChizmaElementi; px: Px; s: number; ch: ReturnType<typeof chizmaChegarasi>; kesim: string; uchlar: Uchlar }) {
  const rang = RANG[e.rang || 'asosiy'] || RANG.asosiy;
  switch (e.tur) {
    case 'oqlar': {
      // Avval X o'qi, keyin Y o'qi; so'ng bo'linmalar va raqamlar.
      // O'qlar o'z oralig'ida kesishadi: 0 oraliqdan tashqarida bo'lsa — o'sha oraliqning chetida.
      const y0 = Math.min(e.ygacha, Math.max(e.ydan, 0));
      const x0 = Math.min(e.xgacha, Math.max(e.xdan, 0));
      const xa = px(e.xdan, y0), xb = px(e.xgacha, y0), ya = px(x0, e.ydan), yb = px(x0, e.ygacha);
      const oqRang = 'rgb(255 255 255 / 0.7)';
      // π birlikda: bo'linma π/2 (keng oraliqda — π), belgisi π/2, π, 3π/2… ko'rinishida.
      const piBirlik = e.birlik === 'pi';
      const qx = piBirlik ? ((e.xgacha - e.xdan) / (Math.PI / 2) <= 10 ? Math.PI / 2 : Math.PI) : bolinmaQadami(e.xgacha - e.xdan), qy = bolinmaQadami(e.ygacha - e.ydan);
      const bolinmalar: React.ReactNode[] = [];
      for (let v = Math.ceil(e.xdan / qx) * qx; v <= e.xgacha - qx / 2; v += qx) {
        if (Math.abs(v) < 1e-9) continue;
        const [x, y] = px(v, y0);
        bolinmalar.push(<g key={`x${v}`} className="dars-chiz-paydo" style={{ animationDelay: `${OQ_KECHIKISH * 2}s` }}><path d={`M${x},${y - 3}L${x},${y + 3}`} stroke={oqRang} strokeWidth={1.2} /><text x={x} y={y + 14} fill="rgb(255 255 255 / 0.55)" fontSize={10} textAnchor="middle">{piBirlik ? piBelgisi(v) : +v.toFixed(4)}</text></g>);
      }
      for (let v = Math.ceil(e.ydan / qy) * qy; v <= e.ygacha - qy / 2; v += qy) {
        if (Math.abs(v) < 1e-9) continue;
        const [x, y] = px(x0, v);
        bolinmalar.push(<g key={`y${v}`} className="dars-chiz-paydo" style={{ animationDelay: `${OQ_KECHIKISH * 2}s` }}><path d={`M${x - 3},${y}L${x + 3},${y}`} stroke={oqRang} strokeWidth={1.2} /><text x={x - 7} y={y} fill="rgb(255 255 255 / 0.55)" fontSize={10} textAnchor="end" dominantBaseline="middle">{+v.toFixed(4)}</text></g>);
      }
      return (
        <g>
          <Chiziq d={yol([xa, xb]) + strelka(xa, xb)} rang={oqRang} qalin={1.6} />
          <Chiziq d={yol([ya, yb]) + strelka(ya, yb)} rang={oqRang} qalin={1.6} kechikish={OQ_KECHIKISH} />
          <Belgi x={xb[0] - 4} y={xb[1] - 12} matn="x" rang={oqRang} kechikish={OQ_KECHIKISH} />
          <Belgi x={yb[0] + 12} y={yb[1] + 4} matn="y" rang={oqRang} kechikish={OQ_KECHIKISH * 2} />
          {e.xdan <= 0 && e.xgacha >= 0 && e.ydan <= 0 && e.ygacha >= 0 && <Belgi x={px(0, 0)[0] - 9} y={px(0, 0)[1] + 11} matn="O" rang="rgb(255 255 255 / 0.55)" kechikish={OQ_KECHIKISH * 2} />}
          {bolinmalar}
        </g>
      );
    }
    case 'nuqta': {
      const [x, y] = px(e.x, e.y);
      return (
        <g>
          <circle cx={x} cy={y} r={4} fill={rang} className="dars-chiz-paydo" />
          {e.nom && <Belgi x={x + 11} y={y - 11} matn={e.nom} rang={rang} kechikish={0.2} />}
        </g>
      );
    }
    case 'kesma': {
      // Jism uchlari bilan berilgan kesma (diagonal): uchlar doskadagi jismdan olinadi; topilmasa — chizilmaydi.
      const u1 = e.uch1 ? uchlar.top(e.uch1) : [e.x1 ?? 0, e.y1 ?? 0];
      const u2 = e.uch2 ? uchlar.top(e.uch2) : [e.x2 ?? 0, e.y2 ?? 0];
      if (!u1 || !u2) return null;
      const a = px(u1[0], u1[1]), b = px(u2[0], u2[1]);
      const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const uz = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      // Belgi kesmaning yonida (perpendikulyar tomonga), ustiga tushmaydi.
      const [nx, ny] = [-(b[1] - a[1]) / uz, (b[0] - a[0]) / uz];
      return (
        <g>
          <Chiziq d={yol([a, b]) + (e.strelka ? strelka(a, b) : '')} rang={rang} uzuq={e.uzuq} />
          {e.nom && <Belgi x={mx + nx * 13} y={my + ny * 13} matn={e.nom} rang={rang} kechikish={0.7} />}
        </g>
      );
    }
    case 'aylana': {
      const [x, y] = px(e.x, e.y);
      const r = e.r * s;
      return (
        <g>
          <Chiziq d={`M${x + r},${y}A${r},${r} 0 1 0 ${x - r},${y}A${r},${r} 0 1 0 ${x + r},${y}`} rang={rang} uzuq={e.uzuq} />
          {e.nom && <Belgi x={x + r * 0.78} y={y - r * 0.78 - 10} matn={e.nom} rang={rang} kechikish={0.8} />}
        </g>
      );
    }
    case 'yoy': {
      const [x, y] = px(e.x, e.y);
      const r = e.r * s;
      const a1 = (e.dan * Math.PI) / 180, a2 = (e.gacha * Math.PI) / 180;
      const p1 = [x + r * Math.cos(a1), y - r * Math.sin(a1)], p2 = [x + r * Math.cos(a2), y - r * Math.sin(a2)];
      // 360° va undan katta yoy — to'liq aylana (boshi va oxiri bir nuqtaga tushib, chizilmay qolardi).
      if (Math.abs(e.gacha - e.dan) >= 360) return <Chiziq d={`M${x + r},${y}A${r},${r} 0 1 0 ${x - r},${y}A${r},${r} 0 1 0 ${x + r},${y}`} rang={rang} qalin={1.8} />;
      const katta = Math.abs(e.gacha - e.dan) > 180 ? 1 : 0;
      const orta = (a1 + a2) / 2;
      return (
        <g>
          <Chiziq d={`M${p1[0]},${p1[1]}A${r},${r} 0 ${katta} ${e.gacha > e.dan ? 0 : 1} ${p2[0]},${p2[1]}`} rang={rang} qalin={1.8} />
          {e.nom && <Belgi x={x + (r + 13) * Math.cos(orta)} y={y - (r + 13) * Math.sin(orta)} matn={e.nom} rang={rang} kechikish={0.7} />}
        </g>
      );
    }
    case 'burchak': {
      // Uchidan ikki tomonga qarab — piksel fazosida (Y cho'zilgan chizmada ham burchak to'g'ri ko'rinadi).
      const [vx, vy] = px(e.x ?? 0, e.y ?? 0);
      const [ax, ay] = px(e.x1 ?? 0, e.y1 ?? 0);
      const [bx, by] = px(e.x2 ?? 0, e.y2 ?? 0);
      const ua = Math.hypot(ax - vx, ay - vy), ub = Math.hypot(bx - vx, by - vy);
      if (!ua || !ub) return null;
      const [u1, u2] = [(ax - vx) / ua, (ay - vy) / ua];
      const [w1, w2] = [(bx - vx) / ub, (by - vy) / ub];
      const [bis1, bis2] = [u1 + w1, u2 + w2];
      const bisUz = Math.hypot(bis1, bis2) || 1;
      if (e.togri) {
        const k = 12;
        const d = yol([[vx + u1 * k, vy + u2 * k], [vx + (u1 + w1) * k, vy + (u2 + w2) * k], [vx + w1 * k, vy + w2 * k]]);
        return <g><Chiziq d={d} rang={rang} qalin={1.6} />{e.nom && <Belgi x={vx + (bis1 / bisUz) * 30} y={vy + (bis2 / bisUz) * 30} matn={e.nom} rang={rang} kechikish={0.6} />}</g>;
      }
      const r = 20;
      // Kichik burchak tomonga: yoy yo'nalishi vektorlar ko'paytmasi ishorasidan.
      const supurish = u1 * w2 - u2 * w1 > 0 ? 1 : 0;
      const d = `M${vx + u1 * r},${vy + u2 * r}A${r},${r} 0 0 ${supurish} ${vx + w1 * r},${vy + w2 * r}`;
      return <g><Chiziq d={d} rang={rang} qalin={1.8} />{e.nom && <Belgi x={vx + (bis1 / bisUz) * (r + 13)} y={vy + (bis2 / bisUz) * (r + 13)} matn={e.nom} rang={rang} kechikish={0.6} />}</g>;
    }
    case 'kopburchak': {
      const nuqtalar = e.nuqtalar.map(n => px(n.x, n.y));
      const [mx, my] = nuqtalar.reduce(([a, b], [x, y]) => [a + x / nuqtalar.length, b + y / nuqtalar.length], [0, 0]);
      return (
        <g>
          <Chiziq d={yol(nuqtalar, e.yopiq !== false)} rang={rang} uzuq={e.uzuq} />
          {e.nuqtalar.map((n, i) => {
            if (!n.nom) return null;
            const [x, y] = nuqtalar[i];
            const uz = Math.hypot(x - mx, y - my) || 1;
            return <Belgi key={i} x={x + ((x - mx) / uz) * 14} y={y + ((y - my) / uz) * 14} matn={n.nom} rang={rang} kechikish={0.5 + i * 0.12} />;
          })}
        </g>
      );
    }
    case 'grafik': {
      const f = ifodaniKompilyatsiya(e.ifoda);
      if (!f) return null;
      const dan = e.dan ?? ch.xdan, gacha = e.gacha ?? ch.xgacha;
      const yChegara = (ch.ygacha - ch.ydan) * 1.5;
      // Uzilishlar (1/x, tan x) va doskadan juda chiqib ketgan joylarda chiziq bo'linadi.
      const bolaklar: [number, number][][] = [[]];
      for (let i = 0; i <= GRAFIK_NUQTALARI; i++) {
        const x = dan + ((gacha - dan) * i) / GRAFIK_NUQTALARI;
        const y = f(x);
        const yaxshi = Number.isFinite(y) && y > ch.ydan - yChegara && y < ch.ygacha + yChegara;
        if (yaxshi) bolaklar[bolaklar.length - 1].push(px(x, y));
        else if (bolaklar[bolaklar.length - 1].length) bolaklar.push([]);
      }
      const d = bolaklar.filter(b => b.length > 1).map(b => yol(b)).join('');
      if (!d) return null;
      return (
        <g>
          <g clipPath={`url(#${kesim})`}><Chiziq d={d} rang={rang} qalin={2.4} uzuq={e.uzuq} /></g>
        </g>
      );
    }
    case 'matn': {
      const [x, y] = px(e.x, e.y);
      return <Belgi x={x} y={y} matn={e.matn} rang={rang} kechikish={0} kattaroq />;
    }
    case 'jism': {
      const { chiziqlar, ellipslar, belgilar } = jismBolaklari(e);
      const [mx, my] = belgilar.length
        ? belgilar.reduce(([a, b], bl) => { const [x, y] = px(bl.p[0], bl.p[1]); return [a + x / belgilar.length, b + y / belgilar.length]; }, [0, 0])
        : px(e.x, e.y);
      return (
        <g>
          {chiziqlar.map((c, i) => <Chiziq key={`c${i}`} d={yol([px(c.a[0], c.a[1]), px(c.b[0], c.b[1])])} rang={rang} uzuq={c.yashirin} kechikish={i * 0.08} />)}
          {ellipslar.map((el, i) => {
            const [cx, cy] = px(el.c[0], el.c[1]);
            return <Chiziq key={`e${i}`} d={ellipsYoli(cx, cy, el.rx * s, el.ry * s, el.yarim)} rang={rang} uzuq={el.yashirin} kechikish={0.2 + i * 0.15} />;
          })}
          {belgilar.map((bl, i) => {
            const [x, y] = px(bl.p[0], bl.p[1]);
            const uz = Math.hypot(x - mx, y - my) || 1;
            return <Belgi key={`b${i}`} x={x + ((x - mx) / uz) * 13} y={y + ((y - my) / uz) * 13} matn={bl.matn} rang={rang} kechikish={0.8 + i * 0.06} />;
          })}
          {e.nom && <Belgi x={px(e.x, e.y)[0]} y={px(e.x, e.y)[1] + 22} matn={e.nom} rang={rang} kechikish={1} />}
        </g>
      );
    }
    default:
      return null;
  }
});

/** Chizma: `elementlar` — hozir doskada turganlari; `hammasi` — darsning barcha elementlari (o'lcham uchun). */
export default function Chizma({ elementlar, hammasi }: { elementlar: ChizmaKorinishi[]; hammasi: ChizmaElementi[] }) {
  const uchlar = useMemo(() => jismUchlari(hammasi), [hammasi]);
  const { ch, s, balandlik, px } = useMemo(() => {
    const ch = chizmaChegarasi(hammasi);
    const dx = ch.xgacha - ch.xdan, dy = ch.ygacha - ch.ydan;
    const s = Math.min((KENGLIK - 2 * CHET) / dx, (BALANDLIK_MAX - 2 * CHET) / dy);
    // Faqat grafik/kesma bo'lgan juda yassi chizmada (sinusoida −2π…2π) Y o'qi cho'ziladi — darslikdagidek;
    // aylana, yoy va jism bo'lsa masshtab bir xil qoladi (aks holda aylana ellips bo'lib ketardi).
    const shaklBor = hammasi.some(e => e.tur === 'aylana' || e.tur === 'yoy' || e.tur === 'jism' || e.tur === 'kopburchak');
    const sy = shaklBor ? s : Math.max(s, Math.min((KENGLIK * YASSI_ULUSH - 2 * CHET) / dy, (BALANDLIK_MAX - 2 * CHET) / dy));
    const balandlik = dy * sy + 2 * CHET;
    const ox = (KENGLIK - dx * s) / 2;
    const px: Px = (x, y) => [ox + (x - ch.xdan) * s, CHET + (ch.ygacha - y) * sy];
    return { ch, s, balandlik, px };
  }, [hammasi]);
  // Grafiklar nomi — chap yuqori burchakdagi izohda (grafik oxiriga yozilsa, ikki grafik nomi ustma-ust tushardi).
  const izoh = elementlar.filter(({ e }) => e.tur === 'grafik' && e.nom);
  // Grafik chizma ramkasidan tashqariga chiqmaydi (cheksizga ketadigan shoxlar shu yerda kesiladi).
  const kesim = `dars-kesim-${useId().replace(/:/g, '')}`;
  const [x1, y1] = px(ch.xdan, ch.ygacha);
  const [x2, y2] = px(ch.xgacha, ch.ydan);
  const ramka = [x1 - 6, y1 - 6, x2 - x1 + 12, y2 - y1 + 12];

  return (
    <svg viewBox={`0 0 ${KENGLIK} ${balandlik.toFixed(1)}`} className="block h-full w-full" role="img" aria-label="Doskadagi chizma" style={{ maxHeight: '100%' }}>
      <defs><clipPath id={kesim}><rect x={ramka[0]} y={ramka[1]} width={ramka[2]} height={ramka[3]} /></clipPath></defs>
      {elementlar.map(({ kalit, e }) => <Element key={kalit} e={e} px={px} s={s} ch={ch} kesim={kesim} uchlar={uchlar} />)}
      {izoh.map(({ kalit, e }, i) => {
        const rang = RANG[e.rang || 'asosiy'] || RANG.asosiy;
        const y = 12 + i * 17;
        return (
          <g key={`izoh-${kalit}`} className="dars-chiz-paydo" style={{ animationDelay: '0.8s' }}>
            <rect x={4} y={y - 8} width={Math.min(KENGLIK - 8, 34 + (e.nom || '').length * 7)} height={16} rx={4} fill="rgb(0 0 0 / 0.35)" />
            <path d={`M10,${y}L26,${y}`} stroke={rang} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={e.uzuq ? '4 3' : undefined} />
            <text x={31} y={y} fill={rang} fontSize={12} fontWeight={600} dominantBaseline="middle">{e.nom}</text>
          </g>
        );
      })}
    </svg>
  );
}
