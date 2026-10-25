// Ish o'lchagichi: sahifa qaysi bosqichda qancha vaqt olgani va qayerda QOTGANINI yozib boradi,
// keyin serverga yuboradi (POST /api/olchov → IshOlchovi). Egasi (2026-10-25): «fayldan yuklashda
// qotib qoldi … o'zing kuzata olmaysanmi? qancha vaqtda yuklanayapdi?» — xodimning brauzeridagi
// haqiqiy vaqtni dasturchi shu yozuvlardan ko'radi.
//
// Qotish (asosiy oqim band — sahifa bosilmaydi): Chrome/Edge'da brauzerning o'zi aytadi
// (PerformanceObserver 'longtask'); u bo'lmagan brauzerda (Safari) — 250 ms lik «yurak urishi»
// kechikib kelsa. Faqat sahifa ko'rinib turganda (yashirin varaqda taymer o'zi sekinlashadi).
// Fayl mazmuni, savol matni yuborilmaydi — faqat vaqtlar, sonlar va fayl turi/hajmi.

/** Shundan qisqa band bo'lish qotish hisoblanmaydi (ms). */
const QOTISH_MS = 300;
/** Shundan uzun qotishdan keyin yozuv darrov yuboriladi (ms). */
const KATTA_QOTISH_MS = 2000;
const YUBORISH_ORALIGI = 30_000;

export interface OlchovBosqichi { nom: string; boshi: number; davom: number | null }
export interface OlchovQotishi { boshi: number; davom: number; bosqich: string | null }
export interface OlchovXulosasi { bosqichlar: { nom: string; davom: number }[]; engUzunQotish: number; qotishlar: number; jamiQotish: number }

const hozir = () => Math.round(performance.now());
const sessiyaId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export class Olchagich {
  readonly sessiya = sessiyaId();
  private readonly t0 = hozir();
  private readonly boshlandi = new Date().toISOString();
  private bosqichlar: OlchovBosqichi[] = [];
  private joriy: OlchovBosqichi | null = null;
  private qotishlar: OlchovQotishi[] = [];
  private hodisalar: { t: number; nom: string; tafsil?: Record<string, unknown> }[] = [];
  private kontekst: Record<string, unknown> = {};
  private ozgardi = false;
  private toxtatildi = false;
  private kuzatuvchi: PerformanceObserver | null = null;
  private taymerlar: number[] = [];
  private yuborishKutadi: number | null = null;

  constructor(private readonly joy: string, private readonly yubor: (malumot: unknown) => void, private readonly onOzgar?: () => void) {
    if (typeof window === 'undefined') return;
    const longtask = typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes || []).includes('longtask');
    if (longtask) {
      this.kuzatuvchi = new PerformanceObserver((ro) => {
        for (const e of ro.getEntries()) if (e.duration >= QOTISH_MS) this.qotdi(Math.round(e.startTime), Math.round(e.duration));
      });
      this.kuzatuvchi.observe({ type: 'longtask', buffered: false } as PerformanceObserverInit);
    } else {
      let oxirgi = hozir();
      let korinardi = document.visibilityState === 'visible';
      this.taymerlar.push(window.setInterval(() => {
        const t = hozir();
        const korinadi = document.visibilityState === 'visible';
        if (korinardi && korinadi && t - oxirgi - 250 >= QOTISH_MS) this.qotdi(oxirgi + 250, t - oxirgi - 250);
        oxirgi = t;
        korinardi = korinadi;
      }, 250));
    }
    this.taymerlar.push(window.setInterval(() => { if (this.ozgardi) this.jonat('oraliq'); }, YUBORISH_ORALIGI));
    window.addEventListener('pagehide', this.yopildi);
  }

  private readonly yopildi = () => this.jonat('sahifa-yopildi');

  private qotdi(boshi: number, davom: number) {
    this.qotishlar.push({ boshi: boshi - this.t0, davom, bosqich: this.joriy?.nom ?? null });
    if (this.qotishlar.length > 200) this.qotishlar.shift();
    this.ozgardi = true;
    this.onOzgar?.();
    // Katta qotish — darrov (sahifa keyin butunlay osilib qolsa ham yozuv yetib borsin).
    if (davom >= KATTA_QOTISH_MS && this.yuborishKutadi === null) {
      this.yuborishKutadi = window.setTimeout(() => { this.yuborishKutadi = null; this.jonat('qotish'); }, 500);
    }
  }

  /** Joriy bosqich (nom bir xil bo'lsa — davom etadi; null — bosqichsiz kutish). */
  bosqich(nom: string | null) {
    if (this.toxtatildi || (this.joriy?.nom ?? null) === nom) return;
    const t = hozir() - this.t0;
    if (this.joriy) this.joriy.davom = t - this.joriy.boshi;
    this.joriy = nom ? { nom, boshi: t, davom: null } : null;
    if (this.joriy) this.bosqichlar.push(this.joriy);
    if (this.bosqichlar.length > 300) this.bosqichlar.shift();
    this.ozgardi = true;
    this.onOzgar?.();
  }

  /** Bir martalik hodisa (fayl tanlandi, natija chiqdi, saqlandi…) va uning tafsiloti. */
  belgi(nom: string, tafsil?: Record<string, unknown>) {
    if (this.toxtatildi) return;
    this.hodisalar.push({ t: hozir() - this.t0, nom, ...(tafsil ? { tafsil } : {}) });
    if (this.hodisalar.length > 300) this.hodisalar.shift();
    this.ozgardi = true;
  }

  /** Umumiy ma'lumot (fayllar soni, savollar soni…) — oxirgi qiymati qoladi. */
  qosh(k: Record<string, unknown>) { Object.assign(this.kontekst, k); this.ozgardi = true; }

  xulosa(): OlchovXulosasi {
    const t = hozir() - this.t0;
    const jamlangan = new Map<string, number>();
    for (const b of this.bosqichlar) jamlangan.set(b.nom, (jamlangan.get(b.nom) || 0) + (b.davom ?? t - b.boshi));
    return {
      bosqichlar: [...jamlangan].map(([nom, davom]) => ({ nom, davom })),
      engUzunQotish: this.qotishlar.reduce((m, q) => Math.max(m, q.davom), 0),
      qotishlar: this.qotishlar.length,
      jamiQotish: this.qotishlar.reduce((s, q) => s + q.davom, 0),
    };
  }

  jonat(sabab: string) {
    this.ozgardi = false;
    // Oyna ochilib, hech narsa qilinmay yopilgan — yozadigan narsa yo'q.
    if (!this.bosqichlar.length && !this.hodisalar.length && !this.qotishlar.length) return;
    const n = navigator as Navigator & { deviceMemory?: number };
    try {
      this.yubor({
        sessiya: this.sessiya, joy: this.joy, sabab, boshlandi: this.boshlandi, davom: hozir() - this.t0,
        brauzer: { ua: navigator.userAgent.slice(0, 300), yadro: n.hardwareConcurrency ?? null, xotira: n.deviceMemory ?? null, ekran: `${screen.width}x${screen.height}` },
        kontekst: this.kontekst, xulosa: this.xulosa(), bosqichlar: this.bosqichlar, qotishlar: this.qotishlar, hodisalar: this.hodisalar,
      });
    } catch { /* o'lchov ishga xalaqit bermaydi */ }
  }

  toxtat() {
    if (this.toxtatildi) return;
    this.bosqich(null);
    this.jonat('yopildi');
    this.toxtatildi = true;
    this.kuzatuvchi?.disconnect();
    this.taymerlar.forEach(t => window.clearInterval(t));
    if (this.yuborishKutadi !== null) window.clearTimeout(this.yuborishKutadi);
    window.removeEventListener('pagehide', this.yopildi);
  }
}
