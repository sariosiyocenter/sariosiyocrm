import { useEffect, useRef, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { Olchagich, type OlchovXulosasi } from '../../lib/olchagich';

/** keepalive so'rovi tanasi 64 KB dan oshmasin (brauzer chegarasi) — oshsa eski yozuvlar qisqartiriladi. */
const MAKS_TANA = 60_000;

function qisqart(m: any): string {
  let tana = JSON.stringify(m);
  for (const n of [100, 40, 10]) {
    if (tana.length <= MAKS_TANA) break;
    tana = JSON.stringify({ ...m, bosqichlar: m.bosqichlar.slice(-n), qotishlar: m.qotishlar.slice(-n), hodisalar: m.hodisalar.slice(-n) });
  }
  return tana;
}

export interface OlchagichQoli {
  bosqich: (nom: string | null) => void;
  belgi: (nom: string, tafsil?: Record<string, unknown>) => void;
  qosh: (k: Record<string, unknown>) => void;
}

/**
 * Oyna ochiq turganda ishlaydigan o'lchagich (src/lib/olchagich.ts). Effekt ichida yaratiladi va
 * to'xtatiladi (StrictMode ikki marta ochib-yopsa ham bitta jonli nusxa qoladi). Yozuvlar serverga
 * keepalive bilan ketadi — sahifa yopilayotganda ham yetib boradi. `xulosa` — ekranda (2 s da bir yangilanadi).
 */
export function useOlchagich(joy: string): OlchagichQoli & { xulosa: OlchovXulosasi | null } {
  const { token } = useCRM();
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const ol = useRef<Olchagich | null>(null);
  const [xulosa, setXulosa] = useState<OlchovXulosasi | null>(null);
  useEffect(() => {
    let kutadi: number | null = null;
    const o = new Olchagich(joy, (malumot) => {
      if (!tokenRef.current) return;
      void fetch('/api/olchov', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: qisqart(malumot),
      }).catch(() => undefined);
    }, () => {
      // Har bosqichda butun oynani qayta chizmaslik uchun — 2 soniyada bir.
      if (kutadi === null) kutadi = window.setTimeout(() => { kutadi = null; setXulosa(o.xulosa()); }, 2000);
    });
    ol.current = o;
    return () => {
      if (kutadi !== null) window.clearTimeout(kutadi);
      o.toxtat();
      if (ol.current === o) ol.current = null;
    };
  }, [joy]);
  const [qol] = useState<OlchagichQoli>(() => ({
    bosqich: (nom) => ol.current?.bosqich(nom),
    belgi: (nom, tafsil) => ol.current?.belgi(nom, tafsil),
    qosh: (k) => ol.current?.qosh(k),
  }));
  return { ...qol, xulosa };
}
