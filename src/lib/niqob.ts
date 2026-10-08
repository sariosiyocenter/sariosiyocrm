/**
 * Fonni tozalash niqobini (alfa kanal) asl rasmga qo'yish va tartibga keltirish.
 *
 * Model qaytargan niqob xom: fon o'rnida xira "tuman" qoladi, odamdan uzoqda
 * mayda dog'lar uchib yuradi, soch chetida esa eski fonning rangi (yashil,
 * sariq hoshiya) ko'rinib turadi. Bu yerda uchalasi tuzatiladi:
 *
 *   1. daraja  — deyarli ko'rinmas alfa nolga, deyarli to'liq alfa 255 ga
 *                tortiladi (ingichka soch tolalari saqlanadigan darajada yumshoq);
 *   2. dog'lar — asosiy shakldan ajralgan mayda bo'laklar o'chiriladi;
 *   3. rang    — chet piksellaridan eski fon rangi olib tashlanadi: ular
 *                yaqin atrofdagi "ichki" odam rangiga yaqinlashtiriladi.
 *
 * Sinab ko'rilib rad etilgan: niqob chetini asl rasmga "yopishtirish" (guided
 * filter) — uchib turgan ingichka tolalarni yo'qotib, chetni dag'allashtirdi.
 *
 * Sof hisob — DOM yo'q; `data` joyida o'zgartiriladi (RGBA, canvas ImageData).
 */

/** Shundan past alfa — fon (tuman), 0 ga tushadi. */
const PAST = 6;
/** Shundan yuqori alfa — odam, 255 ga chiqadi. */
const YUQORI = 249;
/** Eng katta bo'lakning shu ulushidan kichik ajralgan bo'lak — dog'. */
const DOG_ULUSHI = 0.03;
/** Chet rangini tuzatish kuchi (0 — tegilmaydi, 1 — to'liq ichki rang). */
const RANG_KUCHI = 0.85;

/** Kvadrat oyna bo'yicha o'rtacha (ikki yo'nalishda yuguruvchi yig'indi). */
function ortacha(src: Float32Array, w: number, h: number, r: number, vaqtincha: Float32Array, chiq: Float32Array): Float32Array {
    for (let y = 0; y < h; y++) {
        const q = y * w;
        let yig = 0;
        for (let x = 0; x <= Math.min(r, w - 1); x++) yig += src[q + x];
        for (let x = 0; x < w; x++) {
            const chap = Math.max(0, x - r), ong = Math.min(w - 1, x + r);
            vaqtincha[q + x] = yig / (ong - chap + 1);
            if (x + r + 1 < w) yig += src[q + x + r + 1];
            if (x - r >= 0) yig -= src[q + x - r];
        }
    }
    for (let x = 0; x < w; x++) {
        let yig = 0;
        for (let y = 0; y <= Math.min(r, h - 1); y++) yig += vaqtincha[y * w + x];
        for (let y = 0; y < h; y++) {
            const ust = Math.max(0, y - r), ost = Math.min(h - 1, y + r);
            chiq[y * w + x] = yig / (ost - ust + 1);
            if (y + r + 1 < h) yig += vaqtincha[(y + r + 1) * w + x];
            if (y - r >= 0) yig -= vaqtincha[(y - r) * w + x];
        }
    }
    return chiq;
}

/** Asosiy shakldan ajralgan mayda bo'laklarni o'chiradi (4 qo'shnilik). */
function dogniOchir(a: Float32Array, w: number, h: number): void {
    const n = w * h;
    const belgi = new Int32Array(n);
    const navbat = new Int32Array(n);
    const maydon: number[] = [0];
    let soni = 0;
    for (let i = 0; i < n; i++) {
        if (a[i] <= 0 || belgi[i]) continue;
        soni++;
        let bosh = 0, oxir = 0, m = 0;
        navbat[oxir++] = i; belgi[i] = soni;
        while (bosh < oxir) {
            const p = navbat[bosh++]; m++;
            const x = p % w;
            if (x > 0 && !belgi[p - 1] && a[p - 1] > 0) { belgi[p - 1] = soni; navbat[oxir++] = p - 1; }
            if (x < w - 1 && !belgi[p + 1] && a[p + 1] > 0) { belgi[p + 1] = soni; navbat[oxir++] = p + 1; }
            if (p >= w && !belgi[p - w] && a[p - w] > 0) { belgi[p - w] = soni; navbat[oxir++] = p - w; }
            if (p < n - w && !belgi[p + w] && a[p + w] > 0) { belgi[p + w] = soni; navbat[oxir++] = p + w; }
        }
        maydon.push(m);
    }
    if (soni < 2) return;
    let engKatta = 0;
    for (const m of maydon) if (m > engKatta) engKatta = m;
    const chegara = engKatta * DOG_ULUSHI;
    for (let i = 0; i < n; i++) if (belgi[i] && maydon[belgi[i]] < chegara) a[i] = 0;
}

/**
 * @param data  asl rasm piksellari (RGBA); alfa va chet ranglari shu yerga yoziladi
 * @param alfa  modeldan kelgan niqob — RGBA massiv (faqat alfa bayti o'qiladi)
 */
export function niqobniQoy(data: Uint8ClampedArray, alfa: Uint8ClampedArray, w: number, h: number): void {
    const n = w * h;
    const a = new Float32Array(n);

    // 1. Daraja
    const oraliq = YUQORI - PAST;
    for (let i = 0; i < n; i++) {
        const v = (alfa[i * 4 + 3] - PAST) / oraliq;
        a[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
    }

    // 2. Dog'lar
    dogniOchir(a, w, h);

    // 3. Chet rangi. "Ichki" piksel — atrofi (r) to'liq odam bo'lgan joy; chetdagi
    //    har piksel shu ichki ranglarning yaqin o'rtachasiga tortiladi. Kuch chetga
    //    yaqinlashgan sari ortadi: ichkarida 0, yarim shaffof tolada deyarli to'liq.
    const r = Math.max(2, Math.round(Math.max(w, h) / 300));
    const t1 = new Float32Array(n);
    const atrof = ortacha(a, w, h, r, t1, new Float32Array(n));
    const ichki = new Float32Array(n);
    for (let i = 0; i < n; i++) ichki[i] = atrof[i] >= 0.995 ? 1 : 0;
    const r2 = r * 3;
    const ichkiUlush = ortacha(ichki, w, h, r2, t1, new Float32Array(n));
    const kanal = new Float32Array(n);
    const kanalOrt = new Float32Array(n);
    for (let c = 0; c < 3; c++) {
        for (let i = 0; i < n; i++) kanal[i] = ichki[i] ? data[i * 4 + c] : 0;
        ortacha(kanal, w, h, r2, t1, kanalOrt);
        for (let i = 0; i < n; i++) {
            if (a[i] <= 0 || ichki[i] || ichkiUlush[i] < 0.03) continue;
            const odamRangi = kanalOrt[i] / ichkiUlush[i];
            // Chetga yaqinlik: atrofdagi o'rtacha alfa qancha past bo'lsa, shuncha chet.
            const chet = Math.min(1, (1 - atrof[i]) * 2);
            const shaffof = 1 - a[i];
            const kuch = RANG_KUCHI * Math.max(chet * 0.6, shaffof);
            data[i * 4 + c] = data[i * 4 + c] + (odamRangi - data[i * 4 + c]) * Math.min(1, kuch);
        }
    }

    for (let i = 0; i < n; i++) data[i * 4 + 3] = Math.round(a[i] * 255);
}
