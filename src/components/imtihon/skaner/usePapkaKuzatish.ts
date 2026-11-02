import { useCallback, useEffect, useRef, useState } from 'react';

// Addmen «Read Sheet» papkasi: skaner (yoki bir nechta skaner) varaqlarni tarmoqdagi/kompyuterdagi
// papkaga saqlaydi, bu yerda esa papkaga tushgan yangi fayllar o'zi o'qiladi. Brauzerning File System
// Access API si (Chrome, Edge); faqat o'qish ruxsati — fayllar ko'chirilmaydi va o'chirilmaydi.
// O'qilgan fayllar (nomi, o'lchami, vaqti) shu kompyuterda eslab qolinadi: qayta ochilganda takror o'qilmaydi.

const FAYL = /\.(pdf|jpe?g|png|webp|bmp|gif)$/i;
const TEKSHIRUV_MS = 3000;
/** Skaner faylni hali yozayotgan bo'lishi mumkin: shuncha vaqt o'zgarmagan fayl olinadi. */
const TINCH_MS = 1500;
const ESLASH_CHEGARASI = 5000;

type Papka = { name: string; values: () => AsyncIterable<{ kind: string; name: string; getFile?: () => Promise<File> }> };

const kalit = (examId: number, papka: string) => `imt_papka_${examId}_${papka}`;

function eslanganlar(examId: number, papka: string): Set<string> {
  try {
    const l = JSON.parse(localStorage.getItem(kalit(examId, papka)) || '[]');
    return new Set(Array.isArray(l) ? l.map(String) : []);
  } catch {
    return new Set();
  }
}

function eslab(examId: number, papka: string, s: Set<string>) {
  try {
    localStorage.setItem(kalit(examId, papka), JSON.stringify([...s].slice(-ESLASH_CHEGARASI)));
  } catch { /* xotira to'la yoki yopiq — shu ochilishda eslab turiladi */ }
}

export const papkaQollanadi = (): boolean => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export function usePapkaKuzatish(examId: number, oqi: (fayllar: File[]) => Promise<void>) {
  const [papka, setPapka] = useState<Papka | null>(null);
  const [holat, setHolat] = useState<{ oqildi: number; oxirgi: string | null; xato: string | null }>({ oqildi: 0, oxirgi: null, xato: null });
  const oqiRef = useRef(oqi);
  useEffect(() => { oqiRef.current = oqi; }, [oqi]);

  const tanla = useCallback(async () => {
    try {
      const h = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<Papka> }).showDirectoryPicker({ id: `imtihon-skaner`, mode: 'read' });
      setHolat({ oqildi: 0, oxirgi: null, xato: null });
      setPapka(h);
    } catch (e: unknown) {
      // Oynani yopish (AbortError) — xato emas.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setHolat(h => ({ ...h, xato: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  const toxtat = useCallback(() => setPapka(null), []);

  useEffect(() => {
    if (!papka) return;
    let tirik = true;
    let band = false;
    const korilgan = eslanganlar(examId, papka.name);
    const olchamlar = new Map<string, number>();
    const tekshir = async () => {
      if (band || !tirik) return;
      band = true;
      try {
        const yangi: { f: File; k: string }[] = [];
        for await (const h of papka.values()) {
          if (h.kind !== 'file' || !FAYL.test(h.name) || !h.getFile) continue;
          const f = await h.getFile();
          const k = `${f.name}|${f.size}|${f.lastModified}`;
          if (korilgan.has(k)) continue;
          const oldin = olchamlar.get(f.name);
          olchamlar.set(f.name, f.size);
          if (oldin !== f.size || Date.now() - f.lastModified < TINCH_MS) continue;
          yangi.push({ f, k });
        }
        if (!yangi.length || !tirik) return;
        yangi.sort((a, b) => a.f.lastModified - b.f.lastModified || a.f.name.localeCompare(b.f.name));
        // Avval eslab qolinadi: o'qish uzoq cho'zilsa, keyingi tekshiruv ularni qayta olmaydi.
        for (const y of yangi) korilgan.add(y.k);
        eslab(examId, papka.name, korilgan);
        await oqiRef.current(yangi.map(y => y.f));
        if (tirik) setHolat(h => ({ oqildi: h.oqildi + yangi.length, oxirgi: yangi[yangi.length - 1].f.name, xato: null }));
      } catch (e: unknown) {
        if (tirik) setHolat(h => ({ ...h, xato: `Papkani o'qib bo'lmadi: ${e instanceof Error ? e.message : String(e)}` }));
      } finally {
        band = false;
      }
    };
    tekshir();
    const t = setInterval(tekshir, TEKSHIRUV_MS);
    return () => { tirik = false; clearInterval(t); };
  }, [papka, examId]);

  return { papka: papka?.name ?? null, holat, tanla, toxtat };
}
