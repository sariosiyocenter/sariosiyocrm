// API yo'lining kanonik (yagona) ko'rinishini talab qiladigan erta himoya.
//
// Muammo: Express yo'lni erkin moslaydi — "/API/students/42", "/api/Students/42",
// "/api/students/042", "/api/students/%34%32", "/api/students/42;x=1",
// "/api//students/42", "/api/students/42/../42" — hammasi "/api/students/42" bilan
// bitta handlerga keladi. Himoyalar (middleware/auth.js recordAccessError va
// ruxsatXatosi, lib/ruxsatApi.js soroqTalablari, lib/audit.js auditMiddleware) esa
// yo'lning faqat ANIQ, kichik harfli kanonik ko'rinishini taniydi. Noaniq shaklda
// kelgan so'rov handlerga yetib, filial/yozuv egasi, lavozim ruxsati va jurnalni
// chetlab o'tardi.
//
// Yechim (ikki qatlam):
//   1) app.set('case sensitive routing', true) — katta harfli statik bo'lak
//      ("/api/Students") endi marshrutga umuman tushmaydi va "/api" 404'iga boradi.
//   2) Bu middleware — har API so'rovi uchun XOM yo'lni (so'rov qatoridan oldingi
//      qismini) tekshiradi va kanonik bo'lmasa, autentifikatsiya va handlergacha
//      404 qaytaradi: foiz-kodlangan belgilar (shu jumladan kodlangan '/'),
//      nuqta-bo'laklar (./..), ikkilangan slash, ';' matritsa parametrlari,
//      teskari slash, boshqaruv belgilari va aynan "api" bo'lmagan birinchi bo'lak
//      ("/API"). Qolgan raqamli shakllar ("042", "42abc") handlerga tushsa ham,
//      himoyalar endi id ni parseInt bilan o'qib fail-closed ishlaydi.
//
// Haqiqiy trafik hammasi shu qolipda: statik bo'laklar kichik harfda, parametrlar
// — butun son (id) yoki token (base64url/hex/cuid, 'natija' tokenida '.'), hech
// qaysi API yo'lida '%'/';'/'//' yo'q — shuning uchun hech bir qonuniy so'rov
// bloklanmaydi.

const API_404 = { error: 'Bunday manzil topilmadi' };

// Token/id bo'lagida uchraydigan belgilar: harf, raqam, '.', '_', '-'.
// '%', ';', '\\', bo'shliq, boshqaruv belgilari — bu to'plamdan tashqarida.
const BOLAK_RE = /^[A-Za-z0-9._-]+$/;

/** Yo'l kanonikmi? Sabab (xato) qaytaradi, kanonik bo'lsa — null. Sof funksiya (sinov uchun). */
export function yolKanonikXatosi(xomYol) {
  const yol = String(xomYol ?? '').split('?')[0].split('#')[0];
  // API bo'lmagan yo'l (statik fayllar, SPA) — bu himoya tegmaydi.
  if (!/^\/+api(\/|$)/i.test(yol)) return null;
  // Birinchi bo'lak aynan kichik harfli "api" bo'lishi shart ("/API", "//api" — rad).
  if (!/^\/api(\/|$)/.test(yol)) return 'api-prefiks';
  // Oxiridagi slashga ruxsat (himoyalar uni kanonik bilan bir xil o'qiydi): olib tashlab bo'laklarga bo'lamiz.
  const bolaklar = yol.replace(/\/+$/, '').split('/').slice(1);
  for (const b of bolaklar) {
    if (b === '') return 'bosh-bolak';          // ikkilangan slash (//)
    if (b === '.' || b === '..') return 'nuqta-bolak';
    if (!BOLAK_RE.test(b)) return 'belgi';       // %, ;, \\, bo'shliq, kodlangan va h.k.
  }
  return null;
}

/** Express middleware: kanonik bo'lmagan API yo'lini handlergacha 404 bilan rad etadi. */
export function yolHimoyasi(req, res, next) {
  // req.url — xom (dekodlanmagan) yo'l + so'rov qatori; mount yo'q (app darajasi).
  if (yolKanonikXatosi(req.originalUrl || req.url)) {
    return res.status(404).json(API_404);
  }
  next();
}
