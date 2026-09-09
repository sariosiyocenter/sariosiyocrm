/**
 * Marshrut bekatlarini tartiblash.
 *
 * Masala: markazdan chiqib hamma uyni aylanib o'tish — har uyga bir marta.
 * Bekat 20 tadan oshmaydi, shuning uchun oddiy usul yetadi: avval "eng
 * yaqin keyingisi" bilan boshlang'ich yo'l, keyin 2-opt bilan chalkash
 * kesishmalar tekislanadi. Bu eng qisqa yo'lni kafolatlamaydi, lekin
 * amalda qo'lda terilganidan ancha qisqa chiqadi va bir zumda hisoblanadi.
 *
 * Yo'nalish:
 *  - QAYTISH (uyga tarqatish): markazdan boshlab yo'l — yaqinidan uzog'iga.
 *  - KETISH (yig'ib kelish): o'sha yo'lning teskarisi — uzoqdan boshlab
 *    markazga yaqinlashib keladi. Ertalab haydovchi eng chekkadan boshlaydi,
 *    hech kim uzoq kutib o'tirmaydi.
 *
 * Koordinatasi yo'q bekatlar oxiriga qo'yiladi — ularni admin qo'lda joylashi
 * kerak.
 *
 * Bu fayl sof: bazaga ham, brauzerga ham bog'liq emas. Server ham, sahifa ham
 * shu funksiyani chaqiradi.
 */

/** "38.47,67.95" → [38.47, 67.95]; noto'g'ri qiymat uchun null. */
export function parseLatLng(value) {
  if (!value || !String(value).includes(',')) return null;
  const [lat, lng] = String(value).split(',').map(Number);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return [lat, lng];
}

/** Ikki nuqta orasidagi masofa, km (haversine). */
export function distanceKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Yo'l uzunligi: boshlang'ich nuqtadan bekatlar bo'ylab. */
function yolUzunligi(bosh, yol) {
  let jami = 0;
  let joriy = bosh;
  for (const n of yol) { jami += distanceKm(joriy, n); joriy = n; }
  return jami;
}

/**
 * Markazdan boshlanadigan ochiq yo'l: eng yaqin keyingisi + 2-opt.
 * `nuqtalar` — [[lat,lng], ...]; qaytadi — indekslar tartibi.
 */
export function ochiqYol(markaz, nuqtalar) {
  const n = nuqtalar.length;
  if (n <= 1) return nuqtalar.map((_, i) => i);

  // 1) Eng yaqin keyingisi.
  const qolgan = new Set(nuqtalar.map((_, i) => i));
  const yol = [];
  let joriy = markaz;
  while (qolgan.size) {
    let eng = -1;
    let engMasofa = Infinity;
    for (const i of qolgan) {
      const d = distanceKm(joriy, nuqtalar[i]);
      if (d < engMasofa) { engMasofa = d; eng = i; }
    }
    yol.push(eng);
    qolgan.delete(eng);
    joriy = nuqtalar[eng];
  }

  // 2) 2-opt: ikki bo'lakni teskari qilib yo'l qisqarsa — qabul qilinadi.
  //    Boshlang'ich nuqta (markaz) qimirlamaydi, oxiri erkin.
  const koord = (i) => nuqtalar[yol[i]];
  let yaxshilandi = true;
  let aylanish = 0;
  while (yaxshilandi && aylanish < 50) {
    yaxshilandi = false;
    aylanish++;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const oldingi = i === 0 ? markaz : koord(i - 1);
        // Hozirgi: oldingi→i ... j→keyingi;  Yangi: oldingi→j ... i→keyingi
        const hozirgi = distanceKm(oldingi, koord(i)) + (j + 1 < n ? distanceKm(koord(j), koord(j + 1)) : 0);
        const yangi = distanceKm(oldingi, koord(j)) + (j + 1 < n ? distanceKm(koord(i), koord(j + 1)) : 0);
        if (yangi + 1e-9 < hozirgi) {
          // i..j bo'lagini teskari qilamiz
          const bolak = yol.slice(i, j + 1).reverse();
          yol.splice(i, bolak.length, ...bolak);
          yaxshilandi = true;
        }
      }
    }
  }
  return yol;
}

/**
 * Bekatlarni tartiblaydi.
 *
 * @param {{id:number, location?:string|null}[]} bekatlar — id va koordinata
 * @param {[number,number]} markaz
 * @param {'KETISH'|'QAYTISH'} direction
 * @returns {{ tartib: number[], km: number, nuqtasiz: number[] }}
 *   tartib — id lar ketma-ketligi (koordinatasizlar oxirida),
 *   km — markazdan hisoblangan yo'l uzunligi (koordinatalilar bo'yicha),
 *   nuqtasiz — koordinatasi yo'q id lar.
 */
export function bekatlarniTartiblash(bekatlar, markaz, direction = 'KETISH') {
  const nuqtali = [];
  const nuqtasiz = [];
  for (const b of bekatlar) {
    const k = parseLatLng(b.location);
    if (k) nuqtali.push({ id: b.id, k });
    else nuqtasiz.push(b.id);
  }

  const yol = ochiqYol(markaz, nuqtali.map(x => x.k));
  // Uyga tarqatish — markazdan; yig'ib kelish — teskarisi.
  const ketma = direction === 'QAYTISH' ? yol : [...yol].reverse();

  const koordlar = ketma.map(i => nuqtali[i].k);
  const km = direction === 'QAYTISH'
    ? yolUzunligi(markaz, koordlar)
    : yolUzunligi(koordlar[0] || markaz, [...koordlar.slice(1), markaz]);

  return {
    tartib: [...ketma.map(i => nuqtali[i].id), ...nuqtasiz],
    km,
    nuqtasiz,
  };
}
