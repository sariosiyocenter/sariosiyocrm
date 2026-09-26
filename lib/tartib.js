/**
 * Marshrut bekatlarini tartiblash.
 *
 * Masala: markazdan chiqib hamma uyni aylanib o'tish — har uyga bir marta.
 * Bekat 10 tagacha bo'lsa eng qisqa yo'l aniq hisoblanadi (hamma
 * variantni dinamik dasturlash bilan ko'rib chiqib). Ko'p bo'lsa: "eng yaqin
 * keyingisi" va "eng uzoqni qo'shish" bilan ikki xil boshlang'ich yo'l, keyin
 * 2-opt (chalkash kesishmalarni yechish) va or-opt (1–3 uyni boshqa joyga
 * ko'chirish); qaysi biri qisqa chiqsa — o'sha. Bir zumda hisoblanadi.
 *
 * Masofa: `olchagich` berilsa — yo'l bo'yicha vaqt (lib/yolMasofa.js,
 * OSRM), berilmasa — to'g'ri chiziq (eski hisob, server va sinovlar uchun).
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

/** Shu songacha bekat — aniq (eng qisqa) yo'l; 2^12 × 12 holat, bir necha millisekund. */
const ANIQ_CHEGARA = 12;

/** Ochiq yo'l narxi: 0 (boshlanish) dan `tartib` bo'yicha. `M` — (n+1)×(n+1) jadval. */
function narx(M, w, tartib) {
  let s = 0;
  let oldin = 0;
  for (const i of tartib) { s += M[oldin * w + i]; oldin = i; }
  return s;
}

/** Aniq yechim (Held–Karp): 0 dan chiqib 1..n hammasini o'tadigan eng arzon ochiq yo'l. */
function aniqTartib(M, n) {
  const w = n + 1;
  const toliq = (1 << n) - 1;
  const dp = new Float64Array((toliq + 1) * n).fill(Infinity);
  const ota = new Int8Array((toliq + 1) * n).fill(-1);
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = M[j + 1];
  for (let mask = 1; mask <= toliq; mask++) {
    for (let j = 0; j < n; j++) {
      const v = dp[mask * n + j];
      if (v === Infinity || !(mask & (1 << j))) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const m2 = mask | (1 << k);
        const x = v + M[(j + 1) * w + k + 1];
        if (x < dp[m2 * n + k]) { dp[m2 * n + k] = x; ota[m2 * n + k] = j; }
      }
    }
  }
  let oxiri = 0;
  for (let j = 1; j < n; j++) if (dp[toliq * n + j] < dp[toliq * n + oxiri]) oxiri = j;
  const yol = [];
  let mask = toliq;
  let j = oxiri;
  while (j >= 0) {
    yol.push(j + 1);
    const o = ota[mask * n + j];
    mask &= ~(1 << j);
    j = o;
  }
  return yol.reverse();
}

/**
 * 2-opt: bo'lakni teskari qilish yo'lni qisqartirsa — qabul. Narx farqi O(1):
 * oldinga va orqaga yurish yig'indilari oldindan hisoblanadi (yo'l ikki
 * tomonga biroz farq qilishi mumkin — bir tomonlama ko'chalar).
 */
function ikkiOpt(M, w, yol) {
  const n = yol.length;
  let yaxshilandi = false;
  const Fp = new Float64Array(n);
  const Bp = new Float64Array(n);
  const yigindi = () => {
    for (let k = 1; k < n; k++) {
      Fp[k] = Fp[k - 1] + M[yol[k - 1] * w + yol[k]];
      Bp[k] = Bp[k - 1] + M[yol[k] * w + yol[k - 1]];
    }
  };
  yigindi();
  for (let aylanish = 0; aylanish < 50; aylanish++) {
    let bu = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = i === 0 ? 0 : yol[i - 1];
        const b = j + 1 < n ? yol[j + 1] : -1;
        const eski = M[a * w + yol[i]] + (b >= 0 ? M[yol[j] * w + b] : 0) + (Fp[j] - Fp[i]);
        const yangi = M[a * w + yol[j]] + (b >= 0 ? M[yol[i] * w + b] : 0) + (Bp[j] - Bp[i]);
        if (yangi + 1e-9 < eski) {
          const bolak = yol.slice(i, j + 1).reverse();
          for (let k = 0; k < bolak.length; k++) yol[i + k] = bolak[k];
          yigindi();
          bu = true;
        }
      }
    }
    if (!bu) break;
    yaxshilandi = true;
  }
  return yaxshilandi;
}

/** Or-opt: 1–3 ta ketma-ket uyni boshqa joyga ko'chirish (to'g'ri yoki teskari). */
function orOpt(M, w, yol) {
  const n = yol.length;
  let joriy = narx(M, w, yol);
  let yaxshilandi = false;
  for (let L = 1; L <= 3 && L < n; L++) {
    for (let i = 0; i + L <= n; i++) {
      const bolak = yol.slice(i, i + L);
      const qolgan = [...yol.slice(0, i), ...yol.slice(i + L)];
      const variantlar = L > 1 ? [bolak, [...bolak].reverse()] : [bolak];
      let topildi = null;
      for (let p = 0; p <= qolgan.length && !topildi; p++) {
        if (p === i) continue;
        for (const b of variantlar) {
          const sinov = [...qolgan.slice(0, p), ...b, ...qolgan.slice(p)];
          const x = narx(M, w, sinov);
          if (x + 1e-9 < joriy) { topildi = sinov; joriy = x; break; }
        }
      }
      if (topildi) {
        for (let k = 0; k < n; k++) yol[k] = topildi[k];
        yaxshilandi = true;
      }
    }
  }
  return yaxshilandi;
}

/**
 * 2-opt va or-opt navbat bilan — yo'l qisqarmay qolguncha. `boshi` — tugun
 * raqamlari (0 — boshlanish, `M` ning kengligi `w`). Taqsimlash ham shuni
 * ishlatadi (lib/yolReja.js).
 */
export function yolniTekisla(M, w, boshi) {
  return tekisla(M, w, boshi);
}

function tekisla(M, w, boshi) {
  const yol = [...boshi];
  for (let aylanish = 0; aylanish < 30; aylanish++) {
    const a = ikkiOpt(M, w, yol);
    const b = orOpt(M, w, yol);
    if (!a && !b) break;
  }
  return { yol, joriy: narx(M, w, yol) };
}

/**
 * Eng arzon ochiq yo'l tartibi. `M` — (n+1)×(n+1) narx jadvali (0 — boshlanish,
 * 1..n — bekatlar). Qaytadi: 1..n ning tartibi.
 *
 * Deterministik: bir xil jadval — doim bir xil javob (sahifa har qayta
 * chizilganda ham, serverda ham tartib sakramaydi).
 */
export function engArzonTartib(M, n) {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const w = n + 1;
  if (n <= ANIQ_CHEGARA) return aniqTartib(M, n);

  // 1) Eng yaqin keyingisi.
  const yaqin = [];
  const qolgan = new Set(Array.from({ length: n }, (_, i) => i + 1));
  let joriy = 0;
  while (qolgan.size) {
    let eng = -1;
    let engM = Infinity;
    for (const i of qolgan) { const d = M[joriy * w + i]; if (d < engM) { engM = d; eng = i; } }
    yaqin.push(eng);
    qolgan.delete(eng);
    joriy = eng;
  }
  // 2) Eng uzoqni qo'shish: avval eng chekka uylar skeleti, qolganlari eng arzon joyga.
  const uzoq = [];
  const qol2 = new Set(Array.from({ length: n }, (_, i) => i + 1));
  while (qol2.size) {
    let tanlov = -1;
    let tanlovM = -1;
    for (const k of qol2) {
      let eng = Infinity;
      for (let p = 0; p <= uzoq.length; p++) {
        const a = p === 0 ? 0 : uzoq[p - 1];
        const b = uzoq[p];
        const d = M[a * w + k] + (b === undefined ? 0 : M[k * w + b] - M[a * w + b]);
        if (d < eng) eng = d;
      }
      if (eng > tanlovM) { tanlovM = eng; tanlov = k; }
    }
    let engP = 0;
    let engD = Infinity;
    for (let p = 0; p <= uzoq.length; p++) {
      const a = p === 0 ? 0 : uzoq[p - 1];
      const b = uzoq[p];
      const d = M[a * w + tanlov] + (b === undefined ? 0 : M[tanlov * w + b] - M[a * w + b]);
      if (d < engD) { engD = d; engP = p; }
    }
    uzoq.splice(engP, 0, tanlov);
    qol2.delete(tanlov);
  }
  const a = tekisla(M, w, yaqin);
  const b = tekisla(M, w, uzoq);
  let eng = b.joriy + 1e-9 < a.joriy ? b : a;

  // 3) Silkitish: yo'lni to'rt bo'lakka bo'lib o'rnini almashtirib (double-bridge)
  //    yana tekislash — mahalliy "chuqurchadan" chiqish uchun. Tasodif
  //    urug'i n dan: natija har safar bir xil.
  let urug = n * 7919 + 17;
  const tasodif = (k) => { urug = (urug * 1103515245 + 12345) & 0x7fffffff; return urug % k; };
  const silkitish = n > 30 ? 3 : 12;
  for (let s = 0; s < silkitish; s++) {
    const q = [1 + tasodif(n - 3)];
    q.push(q[0] + 1 + tasodif(n - q[0] - 2));
    q.push(q[1] + 1 + tasodif(n - q[1] - 1));
    const y = eng.yol;
    const sinov = tekisla(M, w, [...y.slice(0, q[0]), ...y.slice(q[2]), ...y.slice(q[1], q[2]), ...y.slice(q[0], q[1])]);
    if (sinov.joriy + 1e-9 < eng.joriy) eng = sinov;
  }
  return eng.yol;
}

/** Nuqtalardan narx jadvali: 0 — markaz, 1..n — nuqtalar. */
function jadval(markaz, nuqtalar, olchagich) {
  const hammasi = [markaz, ...nuqtalar];
  const w = hammasi.length;
  const M = new Float64Array(w * w);
  const f = olchagich ? olchagich.daqiqa : distanceKm;
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) M[i * w + j] = i === j ? 0 : f(hammasi[i], hammasi[j]);
  return M;
}

/** Yo'l uzunligi (km): boshlang'ich nuqtadan bekatlar bo'ylab. */
function yolUzunligi(bosh, yol, olchagich) {
  const f = olchagich ? olchagich.km : distanceKm;
  let jami = 0;
  let joriy = bosh;
  for (const n of yol) { jami += f(joriy, n); joriy = n; }
  return jami;
}

/**
 * Markazdan boshlanadigan ochiq yo'l.
 * `nuqtalar` — [[lat,lng], ...]; qaytadi — indekslar tartibi (0 dan).
 */
export function ochiqYol(markaz, nuqtalar, olchagich = null) {
  const n = nuqtalar.length;
  if (n <= 1) return nuqtalar.map((_, i) => i);
  return engArzonTartib(jadval(markaz, nuqtalar, olchagich), n).map(i => i - 1);
}

/**
 * Bekatlarni tartiblaydi.
 *
 * @param {{id:number, location?:string|null}[]} bekatlar — id va koordinata
 * @param {[number,number]} markaz
 * @param {'KETISH'|'QAYTISH'} direction
 * @param {{km:Function, daqiqa:Function}|null} olchagich — yo'l o'lchagichi (bo'lmasa to'g'ri chiziq)
 * @returns {{ tartib: number[], km: number, nuqtasiz: number[] }}
 *   tartib — id lar ketma-ketligi (koordinatasizlar oxirida),
 *   km — markazdan hisoblangan yo'l uzunligi (koordinatalilar bo'yicha),
 *   nuqtasiz — koordinatasi yo'q id lar.
 */
export function bekatlarniTartiblash(bekatlar, markaz, direction = 'KETISH', olchagich = null) {
  const nuqtali = [];
  const nuqtasiz = [];
  for (const b of bekatlar) {
    const k = parseLatLng(b.location);
    if (k) nuqtali.push({ id: b.id, k });
    else nuqtasiz.push(b.id);
  }

  const yol = ochiqYol(markaz, nuqtali.map(x => x.k), olchagich);
  // Uyga tarqatish — markazdan; yig'ib kelish — teskarisi.
  const ketma = direction === 'QAYTISH' ? yol : [...yol].reverse();

  const koordlar = ketma.map(i => nuqtali[i].k);
  const km = direction === 'QAYTISH'
    ? yolUzunligi(markaz, koordlar, olchagich)
    : yolUzunligi(koordlar[0] || markaz, [...koordlar.slice(1), markaz], olchagich);

  return {
    tartib: [...ketma.map(i => nuqtali[i].id), ...nuqtasiz],
    km,
    nuqtasiz,
  };
}
