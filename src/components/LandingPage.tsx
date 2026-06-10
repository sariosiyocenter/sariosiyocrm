import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Zap, PlayCircle, Check, ArrowRight, Gift, PhoneCall, Scan,
  MessageSquare, Users, Wallet, Calendar, ShieldCheck, GitBranch, BarChart3,
  Bell, Atom, Download, ChevronDown, ChevronUp, Plus, Filter, Building2,
  Instagram, Globe, Send, Phone, CheckCircle2, LayoutDashboard, GraduationCap,
  Sun, Moon, HelpCircle,
} from 'lucide-react';

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const STRINGS = {
  uz: {
    nav: {
      features: "Imkoniyatlar",
      preview: "Mahsulot",
      pricing: "Tariflar",
      faq: "Savollar",
      contact: "Bog'lanish",
      cta: "Bepul sinab ko'rish",
      login: "Kirish",
    },
    hero: {
      badge: "Sun'iy intellektga asoslangan tizim",
      titleA: "O'quv markazingizni",
      titleB: "avtomatlashtirilgan brend",
      titleC: "darajasiga olib chiqing",
      sub: "Quantum CRM — bu o'quv markazlari va xususiy maktablar uchun yaxlit AI ekotizimi. Lidlar, dars jadvallari, moliya, OMR test skaneri va xabarnomalar — bir joyda.",
      cta1: "14 kunlik bepul sinash",
      cta2: "Demoni ko'rish",
      trust: "Kredit kartasi shart emas",
      trust2: "Sozlash bepul",
      trust3: "Istalgan vaqtda bekor qilish",
    },
    logos: {
      title: "200+ o'quv markazi Quantum bilan ishlaydi",
      stat1: { num: "200+", label: "ulangan markaz" },
      stat2: { num: "180K+", label: "faol o'quvchi" },
      stat3: { num: "35%", label: "Retention o'sishi" },
      stat4: { num: "4x", label: "tezroq admin" },
    },
    features: {
      kicker: "Nima uchun Quantum",
      title: "Tartibsizlikka barham. Brend darajasiga ko'tariling.",
      sub: "Administrator ishini 4 barobarga yengillashtiring, lidlarni yo'qotmang, to'lovlarni o'z vaqtida yig'ing va imtihonlarni soniyalarda tekshiring.",
      items: [
        {
          icon: "scan-line",
          tag: "Faqat bizda",
          title: "OMR Test Skaneri",
          body: "Oddiy telefon kamerasi orqali test varaqalarini 1 soniyada AI yordamida skanerlab, natijalarni hisoblang. Boshqa tizimlarda yo'q.",
        },
        {
          icon: "message-square-text",
          tag: "Avtomatik",
          title: "SMS va Telegram",
          body: "To'lovlar, qoldirilgan darslar va yangiliklarni avtomatik yuborish. Bitta marta sozlang — tizim o'zi ishlaydi.",
        },
        {
          icon: "users",
          tag: "Lidlar",
          title: "Talabgorlar yo'qolmaydi",
          body: "Har bir lid kanban pipeline'da kuzatiladi. Sayt, Instagram, qo'ng'iroq — barchasi avtomatik tushadi.",
        },
        {
          icon: "wallet",
          tag: "Moliya",
          title: "To'lovlar avtomatik yig'iladi",
          body: "Qarzdorlar ro'yxati, eslatmalar va daromad analitikasi. Click va Payme integratsiyasi tayyor.",
        },
        {
          icon: "calendar-range",
          tag: "Jadval",
          title: "Dars jadvallari konstruktor",
          body: "O'qituvchi, xona va guruh konfliktlarini AI tekshiradi. Drag & drop bilan sekundlarda jadvalni qurasiz.",
        },
        {
          icon: "shield-check",
          tag: "Mahalliy",
          title: "O'zbekiston uchun mo'ljallangan",
          body: "100% mahalliy bozorga moslashgan, ishonchli xavfsizlik tizimi va o'zbek tilidagi qo'llab-quvvatlash 24/7.",
        },
      ],
    },
    preview: {
      kicker: "Mahsulot tomoshasi",
      title: "Bitta interfeys. To'rt qudratli modul.",
      sub: "Tabni tanlang va Quantum ichidan tikka ko'rinishni ko'ring. Hammasi haqiqiy ma'lumotlar bilan.",
      tabs: [
        { key: "schedule", label: "Dars jadvallari", icon: "calendar-range" },
        { key: "finance",  label: "Moliya",          icon: "wallet" },
        { key: "leads",    label: "Lidlar pipeline", icon: "git-branch" },
        { key: "reports",  label: "Hisobotlar",      icon: "bar-chart-3" },
      ],
    },
    omr: {
      kicker: "Faqat Quantum'da",
      title: "OMR Test Skaneri. Bir soniya — natija tayyor.",
      sub: "100 ta varaqani 2 daqiqada tekshiring. Faqat telefon kamerasi va Quantum AI. Excel'ga eksport bir bosishda.",
      step1: "Test varaqasini kameraga tuting",
      step2: "AI 1 soniyada javoblarni o'qiydi",
      step3: "Natijalar reytingda jonli ko'rinadi",
      saved: "Vaqt tejaldi: ~92%",
      compare: "Qo'lda: 6 soat → Quantum: 5 daqiqa",
    },
    pricing: {
      kicker: "Tariflar",
      title: "O'quv markazingiz hajmiga mos rejani tanlang",
      sub: "14 kunlik bepul sinov — kredit kartasiz. Yillik to'lovda 2 oy bepul.",
      monthly: "Oylik",
      yearly: "Yillik",
      save: "2 oy bepul",
      perMonth: "/oy",
      currency: "so'm",
      cta: "Tanlash",
      ctaPop: "Hozir boshlash",
      mostPopular: "Eng ommabop",
      plans: [
        {
          name: "Boshlang'ich",
          desc: "Yangi ochilgan o'quv markazlari uchun",
          price: { m: "390 000", y: "3 900 000" },
          features: [
            "200 o'quvchigacha",
            "Dars jadvallari",
            "Lidlar va to'lovlar",
            "SMS xabarnomalar (limit)",
            "Email qo'llab-quvvatlash",
          ],
        },
        {
          name: "Biznes",
          desc: "O'sib borayotgan markazlar uchun",
          price: { m: "790 000", y: "7 900 000" },
          features: [
            "1000 o'quvchigacha",
            "OMR Test Skaneri",
            "Telegram + SMS avtomatlashtirish",
            "Click & Payme integratsiya",
            "Filiallar boshqaruvi (3 ta)",
            "Telefon orqali yordam",
          ],
        },
        {
          name: "Enterprise",
          desc: "Katta tarmoqlar va xususiy maktablar",
          price: { m: "Maxsus", y: "Maxsus" },
          features: [
            "Cheksiz o'quvchilar",
            "Cheksiz filiallar",
            "Maxsus integratsiyalar",
            "Shaxsiy menejer 24/7",
            "Maxsus SLA shartnoma",
            "On-premise variant",
          ],
        },
      ],
    },
    faq: {
      kicker: "Savollar",
      title: "Tez-tez beriladigan savollar",
      items: [
        {
          q: "Mavjud ma'lumotlarimni Quantum'ga ko'chirib bo'ladimi?",
          a: "Albatta. Excel, Google Sheets yoki boshqa CRM'lardan ma'lumotlarni ko'chirish bepul. Boti va menejeri 24 soat ichida hal qiladi.",
        },
        {
          q: "OMR Test Skaneri qanday ishlaydi?",
          a: "Oddiy A4 varaqaga maxsus shablonni chop etasiz. Talabalar javoblarni belgilaydi. Telefoningiz kamerasini varaqaga tutasiz — AI 1 soniyada javoblarni o'qib, natijani Quantum'ga yozadi.",
        },
        {
          q: "14 kunlik bepul sinov nimani o'z ichiga oladi?",
          a: "To'liq tizim — barcha modullar, OMR skaner, SMS limitlari va Premium qo'llab-quvvatlash. Kredit karta talab qilinmaydi.",
        },
        {
          q: "Ma'lumotlar xavfsizligi qanday ta'minlangan?",
          a: "Quantum O'zbekiston Respublikasi qonunchiligiga to'liq mos. Ma'lumotlar shifrlangan (AES-256), serverlar Supabase xavfsiz bulutida joylashgan.",
        },
        {
          q: "Click va Payme'ni ulay olamanmi?",
          a: "Ha. Biznes va Enterprise tariflarda Click, Payme va boshqa to'lov tizimlari integratsiyalari oldindan tayyorlangan. Sozlash 10 daqiqa oladi.",
        },
      ],
    },
    cta: {
      title: "Bugun ulanmagan har bir kun — yo'qolgan o'quvchi.",
      sub: "Hozir Quantum'ga ulanganlar birinchi oyda Retention'ni 35% ga oshirishadi. 14 kun bepul, sozlash sovg'a.",
      btn: "14 kunlik bepul sinashni boshlash",
      btn2: "Demo qo'ng'irog'i",
    },
    footer: {
      tagline: "O'quv markazlari uchun kelajak avlod ekotizim.",
      product: "Mahsulot",
      product_links: ["Imkoniyatlar", "OMR Skaner", "Tariflar", "Yangiliklar", "Yo'l xaritasi"],
      company: "Kompaniya",
      company_links: ["Biz haqimizda", "Karyera", "Blog", "Hamkorlik", "Press-kit"],
      support: "Yordam",
      support_links: ["Yordam markazi", "Bog'lanish", "Status", "API hujjatlari", "Telegram kanal"],
      legal: "Huquqiy",
      legal_links: ["Maxfiylik", "Foydalanish shartlari", "Cookie", "Litsenziya"],
      rights: "© 2026 Quantum CRM. Barcha huquqlar himoyalangan. Toshkent, O'zbekiston.",
    },
  },
  en: {
    nav: {
      features: "Features",
      preview: "Product",
      pricing: "Pricing",
      faq: "FAQ",
      contact: "Contact",
      cta: "Try free",
      login: "Sign in",
    },
    hero: {
      badge: "AI-powered education platform",
      titleA: "Run your learning center",
      titleB: "as a modern brand",
      titleC: "— fully automated.",
      sub: "Quantum CRM is a unified AI ecosystem for learning centers and private schools. Leads, schedules, finance, OMR test scanner and notifications — in one place.",
      cta1: "Start 14-day free trial",
      cta2: "Watch demo",
      trust: "No credit card",
      trust2: "Free onboarding",
      trust3: "Cancel anytime",
    },
    logos: {
      title: "200+ learning centers run on Quantum",
      stat1: { num: "200+", label: "centers" },
      stat2: { num: "180K+", label: "active students" },
      stat3: { num: "35%", label: "retention lift" },
      stat4: { num: "4x", label: "faster admin" },
    },
    features: {
      kicker: "Why Quantum",
      title: "End the chaos. Become a brand.",
      sub: "Cut admin work 4x, never lose a lead, collect tuition on time, and grade exams in seconds.",
      items: [
        { icon: "scan-line", tag: "Exclusive", title: "OMR Test Scanner",
          body: "Scan answer sheets with a phone camera in 1 second — AI reads marks, results land in the gradebook." },
        { icon: "message-square-text", tag: "Automated", title: "SMS & Telegram",
          body: "Auto-send payment reminders, absences, and announcements. Set up once — it runs itself." },
        { icon: "users", tag: "Leads", title: "Never lose a prospect",
          body: "Every lead lands in a kanban pipeline. Site, Instagram, calls — captured automatically." },
        { icon: "wallet", tag: "Finance", title: "Tuition collects itself",
          body: "Debtor lists, reminders, revenue analytics. Click and Payme integrations included." },
        { icon: "calendar-range", tag: "Schedule", title: "Schedule builder",
          body: "AI checks teacher, room and group conflicts. Drag-and-drop your week in seconds." },
        { icon: "shield-check", tag: "Local", title: "Built for Uzbekistan",
          body: "Fully localized, reliable security and Uzbek-speaking support 24/7." },
      ],
    },
    preview: {
      kicker: "Product tour",
      title: "One interface. Four powerful modules.",
      sub: "Pick a tab and peek inside Quantum — with real data.",
      tabs: [
        { key: "schedule", label: "Schedules",  icon: "calendar-range" },
        { key: "finance",  label: "Finance",    icon: "wallet" },
        { key: "leads",    label: "Leads",      icon: "git-branch" },
        { key: "reports",  label: "Reports",    icon: "bar-chart-3" },
      ],
    },
    omr: {
      kicker: "Exclusive to Quantum",
      title: "OMR Scanner. One second to a graded test.",
      sub: "Grade 100 sheets in 2 minutes with just a phone and Quantum AI. Export to Excel in one click.",
      step1: "Point your camera at the sheet",
      step2: "AI reads marks in 1 second",
      step3: "Results stream into the ranking",
      saved: "Time saved: ~92%",
      compare: "Manual: 6 hours → Quantum: 5 minutes",
    },
    pricing: {
      kicker: "Pricing",
      title: "Pick a plan that fits your center",
      sub: "14-day free trial — no credit card. Save 2 months on annual billing.",
      monthly: "Monthly",
      yearly: "Yearly",
      save: "2 months free",
      perMonth: "/mo",
      currency: "UZS",
      cta: "Choose plan",
      ctaPop: "Start now",
      mostPopular: "Most popular",
      plans: [
        { name: "Starter", desc: "For new learning centers",
          price: { m: "390 000", y: "3 900 000" },
          features: ["Up to 200 students","Schedules","Leads & payments","SMS notifications (limited)","Email support"] },
        { name: "Business", desc: "For growing centers",
          price: { m: "790 000", y: "7 900 000" },
          features: ["Up to 1000 students","OMR Test Scanner","Telegram + SMS automation","Click & Payme integrations","Multi-branch (3)","Phone support"] },
        { name: "Enterprise", desc: "Large networks & private schools",
          price: { m: "Custom", y: "Custom" },
          features: ["Unlimited students","Unlimited branches","Custom integrations","Dedicated manager 24/7","Custom SLA","On-prem option"] },
      ],
    },
    faq: {
      kicker: "Questions",
      title: "Frequently asked",
      items: [
        { q: "Can I import my existing data?",
          a: "Yes. Migration from Excel, Google Sheets or other CRMs is free — a dedicated manager handles it within 24 hours." },
        { q: "How does the OMR scanner work?",
          a: "Print our template on standard A4. Students fill in bubbles. Point your phone camera at the sheet — AI reads answers in 1 second and writes the result to Quantum." },
        { q: "What's included in the 14-day trial?",
          a: "The full system — every module, OMR, SMS quota and premium support. No card required." },
        { q: "How is data security handled?",
          a: "Fully compliant with Uzbek law. AES-256 encryption, hosted in safe cloud environments." },
        { q: "Can I connect Click and Payme?",
          a: "Yes — Click, Payme and others are pre-integrated on Business and Enterprise. Setup takes 10 minutes." },
      ],
    },
    cta: {
      title: "Every day off Quantum is a student lost.",
      sub: "Centers joining today lift retention 35% in the first month. 14 days free, onboarding on us.",
      btn: "Start 14-day free trial",
      btn2: "Book a demo call",
    },
    footer: {
      tagline: "Next-generation ecosystem for learning centers.",
      product: "Product",
      product_links: ["Features","OMR Scanner","Pricing","Changelog","Roadmap"],
      company: "Company",
      company_links: ["About","Careers","Blog","Partners","Press kit"],
      support: "Support",
      support_links: ["Help center","Contact","Status","API docs","Telegram channel"],
      legal: "Legal",
      legal_links: ["Privacy","Terms","Cookies","Licenses"],
      rights: "© 2026 Quantum CRM. All rights reserved. Tashkent, Uzbekistan.",
    },
  },
};

function makeT(lang: 'uz' | 'en') {
  return (path: string) => {
    const segs = path.split('.');
    let cur: any = STRINGS[lang] || STRINGS.uz;
    for (const s of segs) cur = cur?.[s];
    if (cur === undefined) {
      let fb: any = STRINGS.uz;
      for (const s of segs) fb = fb?.[s];
      return fb;
    }
    return cur;
  };
}

// ─── CUSTOM ICON MAPPING COMPONENT ────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  'sparkles': Sparkles,
  'rocket': Zap,
  'play-circle': PlayCircle,
  'check': Check,
  'arrow-right': ArrowRight,
  'gift': Gift,
  'phone-call': PhoneCall,
  'scan-line': Scan,
  'message-square-text': MessageSquare,
  'users': Users,
  'wallet': Wallet,
  'calendar-range': Calendar,
  'shield-check': ShieldCheck,
  'git-branch': GitBranch,
  'bar-chart-3': BarChart3,
  'bell': Bell,
  'atom': Atom,
  'download': Download,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'plus': Plus,
  'filter': Filter,
  'building-2': Building2,
  'instagram': Instagram,
  'globe': Globe,
  'send': Send,
  'phone': Phone,
  'calendar': Calendar,
  'check-circle-2': CheckCircle2,
  'zap': Zap,
  'layout-dashboard': LayoutDashboard,
  'graduation-cap': GraduationCap,
  'sun': Sun,
  'moon': Moon,
};

function Icon({ name, className = "", size = 18 }: { name: string, className?: string, size?: number }) {
  const Component = ICON_MAP[name] || ICON_MAP[name.toLowerCase()] || HelpCircle;
  return <Component className={className} size={size} />;
}

// ─── TICKER HOOK ──────────────────────────────────────────────────────────────
function useTicker(target: number, period = 2400) {
  const [v, setV] = useState(target);
  useEffect(() => {
    const id = setInterval(() => {
      setV((cur) => {
        const delta = (Math.random() - 0.4) * Math.max(1, target * 0.012);
        return Math.max(0, Math.round(cur + delta));
      });
    }, period);
    return () => clearInterval(id);
  }, [target, period]);
  return v;
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

// ─── STYLES INJECT ────────────────────────────────────────────────────────────
const INLINE_STYLES = `
  :root {
    --bg: #07090f;
    --bg-2: #0b0f19;
    --surface: rgba(255,255,255,0.03);
    --surface-2: rgba(255,255,255,0.06);
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.14);
    --text: #e6e9f2;
    --text-dim: #9aa3b8;
    --text-faint: #6b7388;
    --accent: #6366f1;
    --accent-2: #a855f7;
    --accent-soft: rgba(99,102,241,0.18);
    --glow: 24;
    --blur: 18;
  }
  
  html.light {
    --bg: #f5f6fb;
    --bg-2: #ffffff;
    --surface: rgba(15,23,42,0.03);
    --surface-2: rgba(15,23,42,0.05);
    --border: rgba(15,23,42,0.08);
    --border-strong: rgba(15,23,42,0.14);
    --text: #0f172a;
    --text-dim: #475569;
    --text-faint: #94a3b8;
  }

  .font-display {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    letter-spacing: -0.02em;
  }

  .aurora {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    overflow: hidden;
  }
  .aurora::before, .aurora::after {
    content: ''; position: absolute; border-radius: 50%;
    filter: blur(80px); opacity: calc(var(--glow) / 100);
    will-change: transform;
  }
  .aurora::before {
    width: 60vw; height: 60vw; left: -10vw; top: -15vw;
    background: radial-gradient(circle, var(--accent) 0%, transparent 60%);
    animation: drift1 28s ease-in-out infinite;
  }
  .aurora::after {
    width: 55vw; height: 55vw; right: -10vw; top: 20vh;
    background: radial-gradient(circle, var(--accent-2) 0%, transparent 60%);
    animation: drift2 32s ease-in-out infinite;
  }
  .aurora-3 {
    position: absolute; width: 45vw; height: 45vw;
    left: 30vw; top: 50vh;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent) 0%, transparent 60%);
    filter: blur(90px); opacity: calc(var(--glow) / 140);
    animation: drift3 36s ease-in-out infinite;
  }
  html.light .aurora::before, html.light .aurora::after, html.light .aurora-3 {
    opacity: calc(var(--glow) / 220);
  }

  @keyframes drift1 {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(20vw, 15vh) scale(1.15); }
    66% { transform: translate(-10vw, 25vh) scale(0.9); }
  }
  @keyframes drift2 {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(-15vw, 10vh) scale(0.85); }
    66% { transform: translate(10vw, -10vh) scale(1.2); }
  }
  @keyframes drift3 {
    0%, 100% { transform: translate(0,0) scale(1); }
    50% { transform: translate(-20vw, -30vh) scale(1.1); }
  }

  .grid-overlay {
    position: fixed; inset: 0; z-index: 1; pointer-events: none;
    background-image:
      linear-gradient(to right, var(--border) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse at center top, black 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center top, black 0%, transparent 70%);
    opacity: 0.6;
  }

  .cursor-glow {
    position: fixed; pointer-events: none; z-index: 2;
    width: 480px; height: 480px; border-radius: 50%;
    background: radial-gradient(circle, var(--accent) 0%, transparent 60%);
    opacity: 0.10; filter: blur(40px);
    transform: translate(-50%, -50%);
    transition: opacity .4s;
    mix-blend-mode: screen;
  }
  html.light .cursor-glow { opacity: 0.08; mix-blend-mode: multiply; }

  .glass {
    background: var(--surface);
    backdrop-filter: blur(calc(var(--blur) * 1px)) saturate(150%);
    -webkit-backdrop-filter: blur(calc(var(--blur) * 1px)) saturate(150%);
    border: 1px solid var(--border);
  }
  .glass-strong {
    background: var(--surface-2);
    backdrop-filter: blur(calc(var(--blur) * 1.4px)) saturate(160%);
    -webkit-backdrop-filter: blur(calc(var(--blur) * 1.4px)) saturate(160%);
    border: 1px solid var(--border-strong);
  }
  .nav-glass-scrolled {
    background: var(--surface-2);
    backdrop-filter: blur(calc(var(--blur) * 1.4px)) saturate(160%);
    -webkit-backdrop-filter: blur(calc(var(--blur) * 1.4px)) saturate(160%);
  }
  select option {
    background-color: #0b0f19;
    color: #e6e9f2;
  }
  html.light select option {
    background-color: #ffffff;
    color: #0f172a;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
    color: white; font-weight: 600;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.1) inset,
      0 calc(var(--glow) * 0.5px) calc(var(--glow) * 1.5px) calc(var(--accent-soft));
    transition: transform .2s, box-shadow .3s;
  }
  .btn-primary:hover { transform: translateY(-1px); }
  
  .btn-secondary {
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border-strong);
    font-weight: 500;
    transition: all .2s;
  }
  .btn-secondary:hover { background: var(--surface); border-color: var(--accent); }

  .gradient-text {
    background: linear-gradient(135deg, var(--text) 0%, var(--accent-2) 50%, var(--accent) 100%);
    -webkit-background-clip: text; background-clip: text;
    color: transparent;
  }
  html.light .gradient-text {
    background: linear-gradient(135deg, #0f172a 0%, var(--accent) 60%, var(--accent-2) 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  .neon-ring {
    box-shadow:
      0 0 0 1px var(--accent-soft),
      0 0 calc(var(--glow) * 1.5px) calc(var(--accent-soft));
  }

  .chip {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.4rem 0.85rem; border-radius: 999px;
    font-size: 0.8rem; font-weight: 500;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    backdrop-filter: blur(12px);
  }

  .marquee { mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent); }
  @keyframes scroll-x { to { transform: translateX(-50%); } }
  .marquee-track { animation: scroll-x 40s linear infinite; }

  @keyframes pulse-soft {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }

  @keyframes bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }

  @keyframes omr-scan {
    0% { transform: translateY(-100%); }
    50% { transform: translateY(100%); }
    100% { transform: translateY(-100%); }
  }
  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes float-y {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .float-y { animation: float-y 4s ease-in-out infinite; }

  .tab-enter { animation: fade-in-up .4s ease-out; }

  @keyframes border-pulse {
    0%, 100% { box-shadow: 0 0 0 1px var(--accent), 0 0 60px -10px var(--accent); }
    50% { box-shadow: 0 0 0 1px var(--accent-2), 0 0 80px -10px var(--accent-2); }
  }
  .pulse-border { animation: border-pulse 4s ease-in-out infinite; }

  .twk-chip[data-on="1"] {
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.85), 0 2px 6px rgba(0,0,0,0.15);
  }
`;

const ACCENT_PALETTES = {
  indigo:  { a: "#6366f1", b: "#a855f7", soft: "rgba(99,102,241,0.18)",  label: "Indigo" },
  violet:  { a: "#a855f7", b: "#ec4899", soft: "rgba(168,85,247,0.18)",  label: "Violet" },
  emerald: { a: "#10b981", b: "#14b8a6", soft: "rgba(16,185,129,0.18)",  label: "Emerald" },
  amber:   { a: "#f59e0b", b: "#f97316", soft: "rgba(245,158,11,0.18)",  label: "Amber" },
};

// ─── AREA CHART COMPONENT ─────────────────────────────────────────────────────
interface AreaChartProps {
  data: number[];
  color?: string;
  color2?: string;
  height?: number;
}
function AreaChart({ data, color = "var(--accent)", color2 = "var(--accent-2)", height = 120 }: AreaChartProps) {
  const w = 520, h = height;
  const max = Math.max(...data) * 1.15;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 20) - 10]);
  const linePath = pts.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x},${y}` : ` L ${x},${y}`), '');
  const areaPath = linePath + ` L ${w},${h} L 0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1="0" x2={w} y1={h * t} y2={h * t} stroke="var(--border)" strokeDasharray="2 4" />
      ))}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="5" fill="var(--bg)" stroke={color2} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="9" fill="none" stroke={color2} strokeOpacity="0.4" className="pulse-soft" />
    </svg>
  );
}

// ─── SUB-COMPONENTS FOR PREVIEWS ──────────────────────────────────────────────
function SBItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={"flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] " +
      (active ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-faint)]")}>
      <Icon name={icon} size={15} />
      <span>{label}</span>
    </div>
  );
}

function DashboardMockup({ lang }: { lang: 'uz' | 'en' }) {
  const labels_uz = {
    title: "Quantum • Demo markazi",
    overview: "Umumiy", schedule: "Jadval", students: "O'quvchilar",
    leads: "Lidlar", finance: "Moliya", omr: "OMR", reports: "Hisobotlar",
    revenue: "Bu oy daromad", active: "Faol o'quvchilar", retention: "Retention",
    todayLessons: "Bugungi darslar",
    newLeads: "Yangi lidlar", payments: "So'nggi to'lovlar",
    sum: "so'm", paid: "to'langan", pending: "kutilmoqda",
    weekFlow: "Haftalik o'sish", growth: "+24.6% o'tgan haftaga nisbatan",
  };
  const labels_en = {
    title: "Quantum • Demo center",
    overview: "Overview", schedule: "Schedule", students: "Students",
    leads: "Leads", finance: "Finance", omr: "OMR", reports: "Reports",
    revenue: "Revenue this month", active: "Active students", retention: "Retention",
    todayLessons: "Today's lessons",
    newLeads: "New leads", payments: "Recent payments",
    sum: "UZS", paid: "paid", pending: "pending",
    weekFlow: "Weekly growth", growth: "+24.6% vs last week",
  };
  const L = lang === 'en' ? labels_en : labels_uz;

  const revenue = useTicker(184650000, 2200);
  const active = useTicker(2847, 2600);
  const retention = useTicker(94, 3200);

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 1), 1800);
    return () => clearInterval(id);
  }, []);
  const series = useMemo(() => {
    const base = [42, 51, 49, 58, 64, 60, 72, 78, 74, 83, 88, 96];
    return base.map((v, i) => v + Math.sin((phase + i) * 0.6) * 3);
  }, [phase]);

  const stages = lang === 'en'
    ? [{ k: "New", n: 18, c: "#6366f1" }, { k: "Trial", n: 11, c: "#a855f7" }, { k: "Negotiation", n: 7, c: "#ec4899" }, { k: "Won", n: 24, c: "#10b981" }]
    : [{ k: "Yangi", n: 18, c: "#6366f1" }, { k: "Sinov", n: 11, c: "#a855f7" }, { k: "Muzokara", n: 7, c: "#ec4899" }, { k: "Yopildi", n: 24, c: "#10b981" }];

  const paymentsList = [
    { name: "Aliyev Sardor",   group: "IELTS B1 · Jft/Psh", amt: 850000, ok: true },
    { name: "Karimova Malika", group: "Web dev · Dsh/Chsh/Jum", amt: 1200000, ok: true },
    { name: "Yusupov Bekzod",  group: "Math 9th",            amt: 600000,   ok: false },
    { name: "Tursunova Sevinch", group: "SAT prep",          amt: 1500000, ok: true },
  ];

  return (
    <div className="glass-strong rounded-2xl overflow-hidden neon-ring relative"
         style={{ boxShadow: "0 30px 80px -30px rgba(0,0,0,0.6), 0 0 0 1px var(--border-strong)" }}>
      {/* faux browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></span>
        <div className="ml-4 px-3 py-1 rounded-md bg-[var(--surface-2)] text-[11px] text-[var(--text-faint)] font-mono">
          quantum.uz/dashboard
        </div>
        <div className="ml-auto flex items-center gap-2 text-[var(--text-faint)]">
          <Icon name="bell" size={14} />
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]"></span>
        </div>
      </div>

      <div className="grid grid-cols-[180px,1fr] min-h-[500px]">
        {/* sidebar */}
        <aside className="border-r border-[var(--border)] p-3 flex flex-col gap-1 bg-[var(--surface)]">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
              <Icon name="atom" size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-[13px]">Quantum</span>
          </div>
          <SBItem icon="layout-dashboard" label={L.overview} active />
          <SBItem icon="calendar-range" label={L.schedule} />
          <SBItem icon="graduation-cap" label={L.students} />
          <SBItem icon="git-branch" label={L.leads} />
          <SBItem icon="wallet" label={L.finance} />
          <SBItem icon="scan-line" label={L.omr} />
          <SBItem icon="bar-chart-3" label={L.reports} />
          <div className="mt-auto p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[10.5px] text-[var(--text-faint)]">
            <div className="font-medium text-[var(--text-dim)] mb-0.5">{lang === 'en' ? 'Trial' : 'Sinov'}: 11 / 14</div>
            <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]" style={{ width: '78%' }} />
            </div>
          </div>
        </aside>

        {/* main */}
        <main className="p-4 flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{L.title}</div>
              <div className="font-display font-bold text-lg">{L.overview}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="chip text-[10.5px]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft"></span> Live</span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3 text-left">
            <KPI label={L.revenue} value={fmt(revenue)} unit={L.sum} delta="+12.4%" trend="up" />
            <KPI label={L.active} value={fmt(active)} delta="+86" trend="up" />
            <KPI label={L.retention} value={retention + "%"} delta="+3.2pp" trend="up" />
          </div>

          {/* Chart + pipeline */}
          <div className="grid grid-cols-[1.4fr,1fr] gap-3">
            <div className="glass rounded-xl p-3 text-left">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-[11px] text-[var(--text-faint)]">{L.weekFlow}</div>
                  <div className="text-[12px] text-emerald-400 font-medium">{L.growth}</div>
                </div>
                <div className="flex gap-1">
                  {["7D","30D","90D"].map((t,i) => (
                    <span key={t} className={"px-2 py-0.5 rounded-md text-[10px] " + (i===1 ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-faint)]")}>{t}</span>
                  ))}
                </div>
              </div>
              <AreaChart data={series} />
            </div>
            <div className="glass rounded-xl p-3 text-left">
              <div className="text-[11px] text-[var(--text-faint)] mb-2">{L.newLeads}</div>
              <div className="flex flex-col gap-2">
                {stages.map((s) => (
                  <div key={s.k} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }}></span>
                    <span className="text-[11.5px] text-[var(--text-dim)] flex-1">{s.k}</span>
                    <span className="font-mono text-[11.5px]">{s.n}</span>
                    <div className="w-16 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                      <div className="h-full" style={{ width: `${(s.n/24)*100}%`, background: s.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payments feed */}
          <div className="glass rounded-xl text-left">
            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
              <div className="text-[11px] text-[var(--text-faint)]">{L.payments}</div>
              <span className="text-[10px] text-[var(--text-faint)]">{lang==='en'?'Auto-reconciled':'Avtomatik tasdiqlangan'}</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {paymentsList.map((p, i) => (
                <div key={i} className="px-3 py-2 flex items-center gap-3 text-[11.5px]">
                  <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-medium text-[var(--text-dim)]">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="text-[var(--text-faint)] truncate text-[10.5px]">{p.group}</div>
                  </div>
                  <div className="font-mono">{fmt(p.amt)} <span className="text-[var(--text-faint)] text-[10px]">{L.sum}</span></div>
                  <span className={"px-2 py-0.5 rounded-md text-[10px] " +
                    (p.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>
                    {p.ok ? L.paid : L.pending}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* floating notification */}
      <div className="absolute -right-4 top-32 hidden md:flex glass-strong rounded-xl p-3 gap-3 items-center float-y text-left"
           style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,0.5)" }}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
          <Icon name="check" size={16} className="text-white" />
        </div>
        <div>
          <div className="text-[11px] font-medium">{lang==='en'?'Payment received':'To\'lov qabul qilindi'}</div>
          <div className="text-[10px] text-[var(--text-faint)]">+ 1 200 000 {L.sum} · Click</div>
        </div>
      </div>

      <div className="absolute -left-6 bottom-24 hidden md:flex glass-strong rounded-xl p-3 gap-3 items-center float-y text-left"
           style={{ animationDelay: '1.5s', boxShadow: "0 20px 50px -20px rgba(0,0,0,0.5)" }}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
          <Icon name="sparkles" size={16} className="text-white" />
        </div>
        <div>
          <div className="text-[11px] font-medium">{lang==='en'?'OMR scanned · 42 sheets':'OMR skanerlandi · 42 varaq'}</div>
          <div className="text-[10px] text-[var(--text-faint)]">{lang==='en'?'Avg score 84%':'O\'rtacha 84%'}</div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, unit, delta, trend }: { label: string; value: string; unit?: string; delta: string; trend: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] text-[var(--text-faint)]">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="font-display font-bold text-[20px] tabular-nums">{value}</div>
        {unit && <div className="text-[10.5px] text-[var(--text-faint)]">{unit}</div>}
      </div>
      <div className={"text-[10.5px] mt-0.5 flex items-center gap-1 " + (trend === 'up' ? 'text-emerald-400' : 'text-rose-400')}>
        <span style={{ transform: trend === 'up' ? 'none' : 'rotate(180deg)', display: 'inline-block' }}>↑</span>
        {delta}
      </div>
    </div>
  );
}

// ─── TABS DEMO COMPONENT ──────────────────────────────────────────────────────
const PreviewTabs = ({ lang, t }: { lang: 'uz' | 'en'; t: (s: string) => any }) => {
  const tabs = t('preview.tabs');
  const [active, setActive] = useState(tabs[0].key);

  return (
    <div>
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {tabs.map((tab: any) => {
          const on = tab.key === active;
          return (
            <button key={tab.key} onClick={() => setActive(tab.key)}
              className={"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer " +
                (on
                  ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white border-transparent shadow-[0_10px_40px_-15px_var(--accent)]"
                  : "glass text-[var(--text-dim)] hover:text-[var(--text)]")}>
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Frame */}
      <div className="glass-strong rounded-2xl overflow-hidden neon-ring"
           style={{ boxShadow: "0 40px 100px -40px rgba(0,0,0,0.6), 0 0 0 1px var(--border-strong)" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></span>
          <div className="ml-4 px-3 py-1 rounded-md bg-[var(--surface-2)] text-[11px] text-[var(--text-faint)] font-mono">
            quantum.uz/{active}
          </div>
        </div>

        <div className="min-h-[520px] tab-enter" key={active}>
          {active === "schedule" && <ScheduleView lang={lang} />}
          {active === "finance"  && <FinanceView lang={lang} />}
          {active === "leads"    && <LeadsView lang={lang} />}
          {active === "reports"  && <ReportsView lang={lang} />}
        </div>
      </div>
    </div>
  );
};

function ScheduleView({ lang }: { lang: 'uz' | 'en' }) {
  const days_uz = ["Du","Se","Ch","Pa","Ju","Sh","Ya"];
  const days_en = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const days = lang === 'en' ? days_en : days_uz;
  const hours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

  const lessons = [
    { day: 0, h: 0,  span: 2, title: "IELTS B1", teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 0, h: 4,  span: 2, title: "Math 9th",   teacher: "Karimova M.", room: "101", color: "#10b981" },
    { day: 1, h: 1,  span: 1.5, title: "Web dev", teacher: "Yusupov B.", room: "Lab 3", color: "#a855f7" },
    { day: 1, h: 5,  span: 2, title: "SAT prep",   teacher: "Tursunova S.", room: "204", color: "#ec4899" },
    { day: 2, h: 0,  span: 1.5, title: "IELTS B2", teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 2, h: 3,  span: 2, title: "Python", teacher: "Yusupov B.", room: "Lab 3", color: "#a855f7" },
    { day: 3, h: 2,  span: 2, title: "TOEFL",     teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 3, h: 5,  span: 1.5, title: "Math 11th", teacher: "Karimova M.", room: "101", color: "#10b981" },
    { day: 4, h: 1,  span: 2, title: "IELTS B1",   teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 4, h: 5,  span: 2, title: "UI/UX",     teacher: "Saidova N.", room: "Lab 2", color: "#f59e0b" },
    { day: 5, h: 0,  span: 3, title: "Bootcamp", teacher: "Yusupov B.", room: "Lab 3", color: "#a855f7" },
  ];

  return (
    <div className="p-5 text-left">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Schedule':'Dars jadvali'}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?'Week 47 · Nov':"47-hafta · Noyabr"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="chip"><Icon name="filter" size={13} />{lang==='en'?'All teachers':"Hamma o'qituvchilar"}</span>
          <span className="chip"><Icon name="building-2" size={13} />{lang==='en'?'Main branch':"Asosiy filial"}</span>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white font-medium cursor-pointer">
            <Icon name="plus" size={14} /> {lang==='en'?'New lesson':"Yangi dars"}
          </button>
        </div>
      </div>

      <div className="grid border border-[var(--border)] rounded-xl overflow-hidden text-[11px]"
           style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="bg-[var(--surface)]"></div>
        {days.map((d, i) => (
          <div key={i} className="px-2 py-2 bg-[var(--surface)] border-l border-[var(--border)] text-center font-medium">
            {d} <span className="text-[var(--text-faint)] ml-0.5">{18 + i}</span>
          </div>
        ))}

        {hours.map((h, hi) => (
          <Fragment key={hi}>
            <div className="px-2 py-3 text-[var(--text-faint)] text-[10px] border-t border-[var(--border)] font-mono">{h}</div>
            {days.map((_, di) => (
              <div key={di} className="relative border-t border-l border-[var(--border)]" style={{ height: 38 }}>
                {lessons.filter(l => l.day === di && l.h === hi).map((l, i) => (
                  <div key={i} className="absolute left-1 right-1 rounded-md px-2 py-1.5 text-[10.5px] overflow-hidden cursor-pointer hover:opacity-90"
                       style={{
                         top: 2,
                         height: l.span * 38 - 4,
                         background: `${l.color}30`,
                         borderLeft: `3px solid ${l.color}`,
                         color: 'var(--text)'
                       }}>
                    <div className="font-medium truncate">{l.title}</div>
                    <div className="text-[9.5px] text-[var(--text-dim)] truncate">{l.teacher} · {l.room}</div>
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function FinanceView({ lang }: { lang: 'uz' | 'en' }) {
  const months = lang === 'en'
    ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    : ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
  const series = [62, 71, 68, 80, 88, 95, 102, 98, 112, 124, 138, 154];
  const max = Math.max(...series);

  const debts = [
    { name: "Karimov Bobur",     group: "IELTS B2",     due: "12 kun", amt: 850000 },
    { name: "Saidova Nigora",    group: "Web dev",      due: "8 kun",  amt: 1200000 },
    { name: "Olimov Jasur",      group: "Math 9th",     due: "3 kun",  amt: 600000 },
    { name: "Toirova Madina",    group: "SAT prep",     due: "1 kun",  amt: 1500000 },
    { name: "Mansurov Rustam",   group: "Python intro", due: "Bugun",  amt: 900000 },
  ];

  return (
    <div className="p-5 text-left">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Finance':"Moliya"}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?"Cash flow":"Pul oqimi"}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="chip"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Click</span>
          <span className="chip"><span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span> Payme</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <KPIBig label={lang==='en'?'Revenue YTD':"Yillik daromad"} val="1.84B" unit="UZS" delta="+18.4%" />
        <KPIBig label={lang==='en'?'Collected':"Yig'ildi"} val="92.7%" delta="+2.1pp" />
        <KPIBig label={lang==='en'?'Debtors':"Qarzdorlar"} val="34" unit={lang==='en'?'students':"o'quvchi"} delta="−6" />
        <KPIBig label={lang==='en'?'Avg check':"O'rtacha"} val="980K" unit="UZS" delta="+4.2%" />
      </div>

      <div className="grid grid-cols-[1.6fr,1fr] gap-3">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Revenue by month':"Oylar bo'yicha daromad"}</div>
              <div className="text-sm text-emerald-400">+24.6% YoY</div>
            </div>
            <div className="font-mono text-[10px] text-[var(--text-faint)]">{lang==='en'?'in millions UZS':"mln so'm"}</div>
          </div>
          <div className="flex items-end gap-2 h-44">
            {series.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md relative overflow-hidden"
                     style={{
                       height: `${(v/max)*100}%`,
                       background: "linear-gradient(180deg, var(--accent-2), var(--accent))",
                     }}>
                </div>
                <div className="text-[9.5px] text-[var(--text-faint)] font-mono">{months[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Debtors':"Qarzdorlar"}</div>
            <span className="text-[10px] text-amber-400">5 / 34</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {debts.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[10px] text-[var(--text-dim)]">{d.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{d.name}</div>
                  <div className="text-[var(--text-faint)] text-[10px] truncate">{d.group}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono">{fmt(d.amt)}</div>
                  <div className={"text-[9.5px] " + (d.due === "Bugun" || d.due === "1 kun" ? "text-rose-400" : "text-[var(--text-faint)]")}>{d.due}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPIBig({ label, val, unit, delta }: { label: string; val: string; unit?: string; delta: string }) {
  return (
    <div className="glass rounded-xl p-3 text-left">
      <div className="text-[11px] text-[var(--text-faint)]">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="font-display font-bold text-[22px] tabular-nums">{val}</div>
        {unit && <div className="text-[10.5px] text-[var(--text-faint)]">{unit}</div>}
      </div>
      <div className="text-[10.5px] mt-0.5 text-emerald-400">{delta}</div>
    </div>
  );
}

function LeadsView({ lang }: { lang: 'uz' | 'en' }) {
  const cols_uz = [
    { k: "Yangi",     n: 18, c: "#6366f1", leads: [
      { name: "Aziza R.",    src: "Instagram", course: "IELTS B1",  age: "2 soat" },
      { name: "Bekhzod T.",  src: "Sayt",      course: "Web dev",   age: "5 soat" },
      { name: "Munisa K.",   src: "Telegram",  course: "SAT prep",  age: "Bugun" },
    ]},
    { k: "Aloqa",     n: 12, c: "#8b5cf6", leads: [
      { name: "Sherzod M.",  src: "Qo'ng'iroq", course: "TOEFL",     age: "1 kun" },
    ]},
    { k: "Sinov darsi", n: 9, c: "#ec4899", leads: [
      { name: "Olim S.",     src: "Tavsiya",   course: "Math 11th",  age: "3 kun" },
      { name: "Nigora I.",   src: "Sayt",      course: "UI/UX",      age: "3 kun" },
    ]},
    { k: "Muzokara",  n: 5, c: "#f59e0b", leads: [
      { name: "Sevinch U.",  src: "Telegram", course: "IELTS B2",   age: "1 hafta" },
    ]},
    { k: "Yopildi",   n: 24, c: "#10b981", leads: [
      { name: "Jasur K.",    src: "Sayt",     course: "Web dev",    age: "Bugun", won: true },
    ]},
  ];
  const cols_en = [
    { k: "New",     n: 18, c: "#6366f1", leads: [
      { name: "Aziza R.",   src: "Instagram", course: "IELTS B1",  age: "2h" },
      { name: "Bekhzod T.", src: "Site",      course: "Web dev",   age: "5h" },
      { name: "Munisa K.",  src: "Telegram",  course: "SAT prep",  age: "today" },
    ]},
    { k: "Contacted", n: 12, c: "#8b5cf6", leads: [
      { name: "Sherzod M.", src: "Phone",     course: "TOEFL",     age: "1d" },
    ]},
    { k: "Trial",    n: 9, c: "#ec4899", leads: [
      { name: "Olim S.",    src: "Referral",  course: "Math 11th", age: "3d" },
      { name: "Nigora I.",  src: "Site",      course: "UI/UX",     age: "3d" },
    ]},
    { k: "Negotiation", n: 5, c: "#f59e0b", leads: [
      { name: "Sevinch U.", src: "Telegram", course: "IELTS B2",   age: "1w" },
    ]},
    { k: "Won",      n: 24, c: "#10b981", leads: [
      { name: "Jasur K.",   src: "Site",     course: "Web dev",    age: "today", won: true },
    ]},
  ];
  const cols = lang === 'en' ? cols_en : cols_uz;

  return (
    <div className="p-5 text-left">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Pipeline':"Voronka"}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?'68 leads in pipeline':"Voronkada 68 lid"}</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {cols.map((c) => (
          <div key={c.k} className="glass rounded-xl p-2.5 min-h-[380px]">
            <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: c.c }}></span>
                <span className="text-[11px] font-medium">{c.k}</span>
              </div>
              <span className="text-[10px] text-[var(--text-faint)] font-mono">{c.n}</span>
            </div>
            <div className="flex flex-col gap-2">
              {c.leads.map((l, i) => (
                <div key={i} className="rounded-lg p-2 bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer">
                  <div className="text-[11px] font-medium truncate">{l.name}</div>
                  <div className="text-[10px] text-[var(--text-faint)] truncate mt-0.5">{l.course}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{l.src}</span>
                    <span className="text-[9.5px] text-[var(--text-faint)] font-mono">{l.age}</span>
                  </div>
                  {l.won && (
                    <div className="mt-1.5 text-[9.5px] text-emerald-400 flex items-center gap-1">
                      <Icon name="check-circle-2" size={11} /> {lang==='en'?'enrolled':"ro'yxatda"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsView({ lang }: { lang: 'uz' | 'en' }) {
  const months_uz = ["Iyn","Iyl","Avg","Sen","Okt","Noy"];
  const months_en = ["Jun","Jul","Aug","Sep","Oct","Nov"];
  const months = lang === 'en' ? months_en : months_uz;

  const cohorts = [
    [100, 92, 88, 84, 82, 80],
    [100, 94, 90, 87, 85, null],
    [100, 91, 88, 85, null, null],
    [100, 95, 92, null, null, null],
    [100, 96, null, null, null, null],
    [100, null, null, null, null, null],
  ];

  const sources_uz = [
    { name: "Instagram", v: 38, color: "#ec4899" },
    { name: "Sayt", v: 24, color: "#6366f1" },
    { name: "Tavsiya", v: 18, color: "#10b981" },
    { name: "Telegram", v: 14, color: "#a855f7" },
    { name: "Boshqa", v: 6, color: "#64748b" },
  ];
  const sources_en = [
    { name: "Instagram", v: 38, color: "#ec4899" },
    { name: "Website", v: 24, color: "#6366f1" },
    { name: "Referral", v: 18, color: "#10b981" },
    { name: "Telegram", v: 14, color: "#a855f7" },
    { name: "Other", v: 6, color: "#64748b" },
  ];
  const sources = lang === 'en' ? sources_en : sources_uz;

  let cum = 0;
  const total = sources.reduce((a, b) => a + b.v, 0);
  const segs = sources.map((s) => {
    const start = cum / total;
    cum += s.v;
    const end = cum / total;
    return { ...s, start, end };
  });

  return (
    <div className="p-5 text-left">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Reports':"Hisobotlar"}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?'Retention & acquisition':"Retention va lidlar"}</div>
        </div>
      </div>

      <div className="grid grid-cols-[1.6fr,1fr] gap-3">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Cohort retention':"Kogorta retention"}</div>
              <div className="text-sm text-emerald-400">{lang==='en'?'Avg 6-mo: 80%':"O'rtacha 6 oy: 80%"}</div>
            </div>
          </div>
          <div className="grid gap-1 text-[10px]" style={{ gridTemplateColumns: "80px repeat(6, 1fr)" }}>
            <div></div>
            {months.map((m) => <div key={m} className="text-center text-[var(--text-faint)] font-mono">M+{months.indexOf(m)}</div>)}
            {cohorts.map((row, ci) => (
              <Fragment key={ci}>
                <div className="text-[var(--text-faint)] font-mono pr-2 truncate">{months[ci]} '26</div>
                {row.map((v, vi) => {
                  if (v === null) return <div key={vi} className="rounded-md bg-[var(--surface)] h-9"></div>;
                  const intensity = v / 100;
                  return (
                    <div key={vi} className="rounded-md flex items-center justify-center h-9 font-mono"
                         style={{
                           background: `color-mix(in oklab, var(--accent) ${intensity*65}%, transparent)`,
                           color: intensity > 0.85 ? '#fff' : 'var(--text-dim)',
                         }}>{v}%</div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="text-[11px] text-[var(--text-faint)] mb-2">{lang==='en'?'Lead sources':"Lid manbalari"}</div>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" width="120" height="120">
              {segs.map((s, i) => {
                const a0 = s.start * 2 * Math.PI - Math.PI/2;
                const a1 = s.end * 2 * Math.PI - Math.PI/2;
                const large = s.end - s.start > 0.5 ? 1 : 0;
                const r = 38;
                const x0 = 50 + r * Math.cos(a0), y0 = 50 + r * Math.sin(a0);
                const x1 = 50 + r * Math.cos(a1), y1 = 50 + r * Math.sin(a1);
                return <path key={i} d={`M 50 50 L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`} fill={s.color} />;
              })}
              <circle cx="50" cy="50" r="22" fill="var(--bg)" />
              <text x="50" y="48" textAnchor="middle" fontSize="11" fill="var(--text)" fontWeight="600">{total}</text>
              <text x="50" y="60" textAnchor="middle" fontSize="6" fill="var(--text-faint)">{lang==='en'?'leads':"lid"}</text>
            </svg>
            <div className="flex-1 flex flex-col gap-1.5">
              {sources.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span>
                  <span className="flex-1 text-[var(--text-dim)]">{s.name}</span>
                  <span className="font-mono">{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OMR SCAN DEMO COMPONENT ──────────────────────────────────────────────────
function OMRDemo({ lang, t }: { lang: 'uz' | 'en'; t: (s: string) => any }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 1400);
    const t1 = setTimeout(() => setPhase(2), 4000);
    const t2 = setTimeout(() => setPhase(0), 7400);
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 7400);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearInterval(id); };
  }, []);

  const questions = 20;
  const correct = ["A","C","B","D","A","B","C","A","D","B","A","C","D","B","A","C","B","D","A","C"];
  const student = ["A","C","B","D","A","B","C","B","D","B","A","C","D","A","A","C","B","D","A","C"];

  const students = [
    { name: "Aliyev Sardor",     score: 19, rank: 1 },
    { name: "Karimova Malika",   score: 18, rank: 2 },
    { name: "Yusupov Bekzod",    score: 17, rank: 3 },
    { name: "Tursunova Sevinch", score: 17, rank: 4 },
  ];

  return (
    <div className="grid lg:grid-cols-[1.1fr,1fr] gap-6 items-stretch text-left">
      <div className="relative glass-strong rounded-2xl p-8 overflow-hidden min-h-[500px] flex items-center justify-center neon-ring">
        <div className="absolute inset-0 opacity-30"
             style={{
               backgroundImage: "radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 1px)",
               backgroundSize: "16px 16px",
             }}></div>

        <div className="relative" style={{ width: 280, perspective: 1200 }}>
          <div className="relative bg-[#f8f6f0] dark:bg-[#f5f1e6] rounded-lg shadow-2xl"
               style={{
                 transform: "rotateX(8deg) rotateY(-6deg) rotateZ(-3deg)",
                 transformStyle: "preserve-3d",
                 padding: "20px 22px",
                 boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.08)",
                 color: "#1a1a1a",
               }}>
            <span className="absolute top-2 left-2 w-3 h-3 bg-black"></span>
            <span className="absolute top-2 right-2 w-3 h-3 bg-black"></span>
            <span className="absolute bottom-2 left-2 w-3 h-3 bg-black"></span>
            <span className="absolute bottom-2 right-2 w-3 h-3 bg-black"></span>

            <div className="text-center mb-2">
              <div className="text-[9px] font-bold tracking-widest text-black/60">QUANTUM · OMR</div>
              <div className="text-[10px] font-bold">{lang==='en'?'TEST SHEET · 20 questions':"TEST VARAQA · 20 savol"}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
              {Array.from({ length: questions }).map((_, i) => {
                const filled = phase >= 1 && i < (phase === 1 ? Math.min(questions, 20) : questions);
                const matched = student[i] === correct[i];
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[9px]">
                    <span className="w-3 text-right font-bold text-black/70">{i+1}.</span>
                    {["A","B","C","D"].map((opt) => {
                      const isStudent = student[i] === opt;
                      const show = phase >= 1 && isStudent;
                      const showResult = phase >= 2;
                      let bg = "transparent", border = "rgba(0,0,0,0.5)";
                      if (show && !showResult) { bg = "#1a1a1a"; border = "#1a1a1a"; }
                      if (show && showResult && matched) { bg = "#10b981"; border = "#10b981"; }
                      if (show && showResult && !matched) { bg = "#ef4444"; border = "#ef4444"; }
                      return (
                        <span key={opt} className="inline-flex items-center justify-center font-bold"
                              style={{
                                width: 10, height: 10, borderRadius: "50%",
                                border: `1px solid ${border}`, background: bg,
                                color: bg === "transparent" ? "rgba(0,0,0,0.5)" : "#fff",
                                fontSize: 6, transition: "all .25s",
                              }}>{opt}</span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {phase === 1 && (
            <div className="absolute left-0 right-0 pointer-events-none"
                 style={{
                   top: 0, bottom: 0,
                   transform: "rotateX(8deg) rotateY(-6deg) rotateZ(-3deg)",
                 }}>
              <div className="absolute left-0 right-0 h-12"
                   style={{
                     background: "linear-gradient(180deg, transparent, var(--accent) 40%, var(--accent-2) 60%, transparent)",
                     filter: "blur(2px)",
                     opacity: 0.85,
                     animation: "omr-scan 2.4s ease-in-out infinite",
                   }}></div>
            </div>
          )}
        </div>

        {/* Phone overlay */}
        <div className="absolute top-6 right-6 lg:top-10 lg:right-10 w-32 lg:w-40 rounded-[26px] p-2"
             style={{
               background: "linear-gradient(160deg, #1a1d28, #0a0c14)",
               border: "1.5px solid rgba(255,255,255,0.1)",
               boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
             }}>
          <div className="rounded-[20px] overflow-hidden relative" style={{ aspectRatio: "9/16", background: "#000" }}>
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-2.5 rounded-full bg-black z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]"></div>
            {[
              "top-4 left-4 border-l-2 border-t-2",
              "top-4 right-4 border-r-2 border-t-2",
              "bottom-12 left-4 border-l-2 border-b-2",
              "bottom-12 right-4 border-r-2 border-b-2",
            ].map((c, i) => (
              <span key={i} className={"absolute w-4 h-4 " + c}
                    style={{ borderColor: phase >= 1 ? "var(--accent-2)" : "var(--accent)", transition: 'border-color .3s' }}></span>
            ))}
            <div className="absolute top-6 right-3 px-1.5 py-0.5 rounded-md bg-black/50 text-white text-[7px] font-mono backdrop-blur-sm">
              {phase >= 2 ? "20 / 20" : phase === 1 ? "scan..." : "live"}
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[8px] font-medium whitespace-nowrap"
                 style={{
                   background: phase >= 2 ? "rgba(16,185,129,0.25)" : phase >= 1 ? "rgba(168,85,247,0.25)" : "rgba(99,102,241,0.25)",
                   color: phase >= 2 ? "#34d399" : phase >= 1 ? "#c4b5fd" : "#a5b4fc",
                   border: "1px solid currentColor",
                 }}>
              {phase >= 2 ? (lang==='en'?'✓ Done':"✓ Tayyor") : phase >= 1 ? (lang==='en'?'Scanning…':"Skanerlanmoqda…") : (lang==='en'?'Aim at sheet':"Varaqaga tuting")}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-2">
          {[0, 1, 2].map((i) => {
            const labels = [t('omr.step1'), t('omr.step2'), t('omr.step3')];
            const on = phase === i;
            return (
              <div key={i} className={"flex-1 rounded-lg px-2.5 py-2 text-[10.5px] glass " + (on ? "border-[var(--accent)] text-[var(--text)]" : "text-[var(--text-faint)]")}
                   style={{ borderColor: on ? 'var(--accent)' : 'var(--border)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono">0{i+1}</span>
                  <span className="truncate">{labels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results panel */}
      <div className="glass-strong rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Live results':"Jonli natijalar"}</div>
              <div className="font-display font-bold text-lg">{lang==='en'?'IELTS Mock · Group 204':"IELTS Mock · 204-guruh"}</div>
            </div>
            <span className="chip">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft"></span>
              {lang==='en'?'AI grading':"AI baholash"}
            </span>
          </div>

          <div className="rounded-xl p-4 mb-3 relative overflow-hidden"
               style={{ background: "linear-gradient(135deg, var(--accent-soft), transparent)", border: "1px solid var(--border-strong)" }}>
            <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Avg score':"O'rtacha ball"}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-4xl gradient-text">17.2</span>
              <span className="text-[var(--text-faint)]">/ 20</span>
              <span className="ml-auto text-emerald-400 text-sm font-mono">86%</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--text-dim)]">{t('omr.compare')}</div>
          </div>

          <div className="text-[11px] text-[var(--text-faint)] mb-2">{lang==='en'?'Ranking':"Reyting"}</div>
          <div className="flex flex-col gap-1.5">
            {students.map((s, i) => {
              const visible = phase === 2 ? i < students.length : phase === 1 ? i < Math.min(3, students.length) : 0;
              return (
                <div key={i} className={"flex items-center gap-3 px-3 py-2 rounded-lg transition-all " +
                    (visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3")}
                    style={{
                      background: s.rank === 1 ? "linear-gradient(90deg, var(--accent-soft), transparent)" : "var(--surface)",
                      border: "1px solid var(--border)",
                      transitionDelay: `${i*0.08}s`,
                    }}>
                  <span className={"w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold " +
                      (s.rank === 1 ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)]")}>
                    {s.rank}
                  </span>
                  <span className="flex-1 text-[12px]">{s.name}</span>
                  <span className="font-mono text-[12px]">{s.score}/20</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 flex items-center gap-2 text-[11px]">
          <span className="chip"><Icon name="zap" size={12} className="text-[var(--accent-2)]" /> {t('omr.saved')}</span>
          <button className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer">
            <Icon name="download" size={12} /> Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GLASSMORPHIC TRIAL MODAL FORM ───────────────────────────────────────────
interface TrialModalProps {
  t: (s: string) => any;
  lang: 'uz' | 'en';
  plan: string;
  onClose: () => void;
}
function TrialModal({ t, lang, plan, onClose }: TrialModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [center, setCenter] = useState('');
  const [selPlan, setSelPlan] = useState(plan || 'Biznes');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !center) {
      alert(lang === 'en' ? 'Please fill in all fields' : "Iltimos, barcha maydonlarni to'ldiring");
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-[var(--bg-2)] border border-[var(--border-strong)] rounded-3xl p-7 shadow-2xl pulse-border flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-lg transition-colors cursor-pointer">
          <Icon name="chevron-down" size={20} />
        </button>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <div className="text-center pb-2">
              <h3 className="font-display font-bold text-xl text-[var(--text)]">
                {lang === 'en' ? 'Start Free Trial' : 'Bepul sinab ko\'rish'}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-1.5 leading-relaxed">
                {lang === 'en' ? 'Get 14 days of free access and onboarding support!' : '14 kunlik bepul sinov va bepul sozlab berish sovg\'asiga ega bo\'ling!'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Full Name' : 'F.I.Sh.'}</label>
              <input 
                type="text" 
                required
                placeholder={lang === 'en' ? 'Enter your full name' : 'Ism familiyangizni kiriting'}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all placeholder:text-[var(--text-faint)] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Phone Number' : 'Telefon raqami'}</label>
              <input 
                type="tel" 
                required
                placeholder="+998 (90) 123-45-67"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all placeholder:text-[var(--text-faint)] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Learning Center Name' : 'O\'quv markazi nomi'}</label>
              <input 
                type="text" 
                required
                placeholder={lang === 'en' ? 'Name of your academy' : 'Markaz yoki maktabingiz nomi'}
                value={center}
                onChange={e => setCenter(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all placeholder:text-[var(--text-faint)] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Select Plan' : 'Tarifni tanlang'}</label>
              <select 
                value={selPlan}
                onChange={e => setSelPlan(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all text-[var(--text)] cursor-pointer"
              >
                <option value="Boshlang'ich" className="bg-[#0b0f19] text-[#e6e9f2] dark:bg-white dark:text-slate-900">{lang === 'en' ? 'Starter (200 students)' : 'Boshlang\'ich (200 o\'quvchi)'}</option>
                <option value="Biznes" className="bg-[#0b0f19] text-[#e6e9f2] dark:bg-white dark:text-slate-900">{lang === 'en' ? 'Business (1000 students)' : 'Biznes (1000 o\'quvchi)'}</option>
                <option value="Enterprise" className="bg-[#0b0f19] text-[#e6e9f2] dark:bg-white dark:text-slate-900">{lang === 'en' ? 'Enterprise (Unlimited)' : 'Enterprise (Cheksiz)'}</option>
              </select>
            </div>

            <button type="submit" className="btn-primary w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer">
              {lang === 'en' ? 'Start Free Trial Now' : 'Bepul sinashni boshlash'}
            </button>
          </form>
        ) : (
          <div className="text-center py-8 flex flex-col items-center gap-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <Icon name="check" size={28} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-[var(--text)]">
                {lang === 'en' ? 'Request Submitted!' : 'So\'rovingiz qabul qilindi!'}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-2 leading-relaxed max-w-xs mx-auto">
                {lang === 'en' 
                  ? 'Congratulations! A dedicated Quantum onboarding manager will contact you within 24 hours to set up your account!' 
                  : 'Tabriklaymiz! Quantum shaxsiy menejeri 24 soat ichida siz bilan bog\'lanib, o\'quv markazingiz uchun tizimni to\'liq bepul sozlab beradi!'}
              </p>
            </div>
            <button onClick={onClose} className="btn-secondary px-8 py-2.5 rounded-xl font-semibold text-sm transition-all mt-4 cursor-pointer">
              {lang === 'en' ? 'Close' : 'Yopish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN LANDING PAGE CONTAINER ──────────────────────────────────────────────
export default function LandingPage() {
  const [lang, setLang] = useState<'uz' | 'en'>('uz');
  const [dark, setDark] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalPlan, setModalPlan] = useState('');

  const t = useMemo(() => makeT(lang), [lang]);

  // Apply theme classes natively
  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Track cursor glow follower
  useEffect(() => {
    const el = document.getElementById('cursor-glow');
    if (!el) return;
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y;
    const onMove = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
    window.addEventListener('mousemove', onMove);
    
    let active = true;
    function tick() {
      if (!active) return;
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      if (el) {
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      }
      requestAnimationFrame(tick);
    }
    tick();

    return () => {
      active = false;
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  const handleOpenModal = (planName = '') => {
    setModalPlan(planName);
    setShowModal(true);
  };

  return (
    <div className="relative min-h-screen text-[var(--text)] font-sans overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--bg)' }}>
      {/* Dynamic inline stylesheets for Aurora and Blur effects */}
      <style dangerouslySetInnerHTML={{ __html: INLINE_STYLES }} />

      {/* Aurora visual glow meshes */}
      <div className="aurora">
        <div className="aurora-3"></div>
      </div>
      <div className="grid-overlay"></div>
      <div id="cursor-glow" className="cursor-glow"></div>

      {/* Main navigation */}
      <Nav t={t} lang={lang} setLang={setLang} dark={dark} setDark={setDark} onOpenModal={() => handleOpenModal()} />

      {/* Hero Section */}
      <Hero t={t} lang={lang} onOpenModal={() => handleOpenModal('Biznes')} />

      {/* Trust statistics row */}
      <Logos t={t} />

      {/* Features mesh grid */}
      <Features t={t} />

      {/* Interactive dashboard preview tabs */}
      <PreviewSection t={t} lang={lang} />

      {/* OMR grading scanning section */}
      <OMRSection t={t} lang={lang} />

      {/* Dynamic pricing plans */}
      <Pricing t={t} onOpenModal={handleOpenModal} />

      {/* Accordion FAQ questions */}
      <FAQ t={t} />

      {/* Final Conversion box */}
      <FinalCTA t={t} onOpenModal={() => handleOpenModal()} />

      {/* Footer copyright */}
      <Footer t={t} />

      {/* Signup Free trial Modal */}
      {showModal && (
        <TrialModal t={t} lang={lang} plan={modalPlan} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

// ─── NAV SECTION ──────────────────────────────────────────────────────────────
interface NavProps {
  t: (s: string) => any;
  lang: 'uz' | 'en';
  setLang: (l: 'uz' | 'en') => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  onOpenModal: () => void;
}
function Nav({ t, lang, setLang, dark, setDark, onOpenModal }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={"fixed top-0 left-0 right-0 z-40 transition-all duration-300 border-b " +
      (scrolled ? "nav-glass-scrolled border-b-[var(--border-strong)] py-3 shadow-[0_10px_30px_rgba(0,0,0,0.1)]" : "py-5 bg-transparent border-b-transparent")}>
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        
        {/* Brand logo */}
        <a href="#" className="flex items-center gap-2 z-50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
            <Icon name="atom" size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Quantum CRM</span>
        </a>

        {/* Anchors links */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">{t('nav.features')}</a>
          <a href="#preview" className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">{t('nav.preview')}</a>
          <a href="#pricing" className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">{t('nav.pricing')}</a>
          <a href="#faq" className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">{t('nav.faq')}</a>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Lang switch */}
          <button onClick={() => setLang(lang === 'uz' ? 'en' : 'uz')}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center text-xs font-semibold hover:border-[var(--accent)] cursor-pointer">
            {lang === 'uz' ? "EN" : "UZ"}
          </button>

          {/* Theme switch */}
          <button onClick={() => setDark(!dark)}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center hover:border-[var(--accent)] cursor-pointer">
            <Icon name={dark ? "sun" : "moon"} size={14} />
          </button>

          {/* Login button */}
          <Link to="/login" className="text-sm font-medium hover:text-[var(--accent)] transition-colors mr-1">
            {t('nav.login')}
          </Link>

          {/* Primary CTA */}
          <button onClick={onOpenModal} className="btn-primary inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg cursor-pointer">
            {t('nav.cta')} <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── HERO SECTION ─────────────────────────────────────────────────────────────
interface HeroProps {
  t: (s: string) => any;
  lang: 'uz' | 'en';
  onOpenModal: () => void;
}
function Hero({ t, lang, onOpenModal }: HeroProps) {
  return (
    <section className="relative pt-32 pb-16 px-4">
      <div className="max-w-6xl mx-auto text-center relative">
        <div className="chip mb-6 mx-auto">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[var(--accent-2)] pulse-soft"></span>
            <span className="absolute inset-0 rounded-full bg-[var(--accent-2)]"></span>
          </span>
          <Icon name="sparkles" size={13} className="text-[var(--accent-2)]" />
          {t('hero.badge')}
        </div>

        <h1 className="font-display font-bold tracking-tight text-[clamp(2.3rem,5.5vw,4.5rem)] leading-[1.06] text-balance">
          <span className="block">{t('hero.titleA')}</span>
          <span className="block gradient-text">{t('hero.titleB')}</span>
          <span className="block">{t('hero.titleC')}</span>
        </h1>

        <p className="mt-6 text-[var(--text-dim)] text-lg max-w-2xl mx-auto leading-relaxed text-balance">
          {t('hero.sub')}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={onOpenModal} className="btn-primary inline-flex items-center gap-2 text-base px-6 py-3 rounded-xl cursor-pointer">
            <Icon name="rocket" size={16} /> {t('hero.cta1')}
          </button>
          <a href="#preview" className="btn-secondary inline-flex items-center gap-2 text-base px-6 py-3 rounded-xl cursor-pointer">
            <Icon name="play-circle" size={16} /> {t('hero.cta2')}
          </a>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[12.5px] text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={12} className="text-emerald-400"/> {t('hero.trust')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={12} className="text-emerald-400"/> {t('hero.trust2')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={12} className="text-emerald-400"/> {t('hero.trust3')}</span>
        </div>
      </div>

      {/* Interactive dashboard mockup element */}
      <div className="max-w-5xl mx-auto mt-16 relative">
        <DashboardMockup lang={lang} />
      </div>
    </section>
  );
}

// ─── LOGOS SECTION ────────────────────────────────────────────────────────────
function Logos({ t }: { t: (s: string) => any }) {
  const stats = [
    { key: "stat1" },
    { key: "stat2" },
    { key: "stat3" },
    { key: "stat4" },
  ];

  return (
    <section className="py-12 border-y border-[var(--border)] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-8">
          {t('logos.title')}
        </div>

        {/* Dynamic statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center max-w-4xl mx-auto">
          {stats.map((s) => {
            const num = t(`logos.${s.key}.num`);
            const label = t(`logos.${s.key}.label`);
            return (
              <div key={s.key} className="flex flex-col items-center">
                <span className="font-display font-bold text-3xl md:text-4xl gradient-text">{num}</span>
                <span className="text-xs text-[var(--text-dim)] mt-1.5 font-medium">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── FEATURES GRID ────────────────────────────────────────────────────────────
function Features({ t }: { t: (s: string) => any }) {
  const items = t('features.items');

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <span className="chip mb-4">
            <Icon name="atom" size={12} className="text-[var(--accent)]" />
            {t('features.kicker')}
          </span>
          <h2 className="font-display font-bold text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] max-w-2xl mx-auto text-balance mt-2">
            {t('features.title')}
          </h2>
          <p className="mt-4 text-[var(--text-dim)] max-w-xl mx-auto text-balance">
            {t('features.sub')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it: any, i: number) => (
            <div key={i} className="glass rounded-2xl p-6 relative overflow-hidden group hover:border-[var(--accent)] transition-all duration-300 text-left">
              {/* background subtle aura glow */}
              <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-[var(--accent-soft)] filter blur-2xl group-hover:scale-150 transition-all duration-300"></div>
              
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
                    <Icon name={it.icon} size={20} className="text-[var(--accent)]" />
                  </div>
                  {it.tag && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">
                      {it.tag}
                    </span>
                  )}
                </div>

                <h3 className="font-display font-bold text-lg mt-2">{it.title}</h3>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed mt-1">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── INTERACTIVE TABS VIEW ────────────────────────────────────────────────────
interface PreviewProps {
  t: (s: string) => any;
  lang: 'uz' | 'en';
}
function PreviewSection({ t, lang }: PreviewProps) {
  return (
    <section id="preview" className="py-24 border-t border-[var(--border)] relative bg-[var(--bg-2)]/30">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <div className="mb-16">
          <span className="chip mb-4">
            <Icon name="sparkles" size={12} className="text-[var(--accent-2)]" />
            {t('preview.kicker')}
          </span>
          <h2 className="font-display font-bold text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] max-w-2xl mx-auto text-balance mt-2">
            {t('preview.title')}
          </h2>
          <p className="mt-4 text-[var(--text-dim)] max-w-xl mx-auto text-balance">
            {t('preview.sub')}
          </p>
        </div>

        {/* Tab pill mockups */}
        <div className="max-w-5xl mx-auto">
          <PreviewTabs lang={lang} t={t} />
        </div>
      </div>
    </section>
  );
}

// ─── OMR CAMERA DEMO GRID ─────────────────────────────────────────────────────
function OMRSection({ t, lang }: PreviewProps) {
  return (
    <section className="py-24 border-t border-[var(--border)] relative">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-[1fr,1.3fr] gap-12 items-center mb-16 text-left">
          <div>
            <span className="chip mb-4">
              <Icon name="scan-line" size={12} className="text-[var(--accent)]" />
              {t('omr.kicker')}
            </span>
            <h2 className="font-display font-bold text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] mt-2">
              {t('omr.title')}
            </h2>
            <p className="mt-4 text-[var(--text-dim)] leading-relaxed">
              {t('omr.sub')}
            </p>
          </div>
        </div>

        {/* Animated scanning board demo */}
        <div className="max-w-6xl mx-auto">
          <OMRDemo lang={lang} t={t} />
        </div>
      </div>
    </section>
  );
}

// ─── PRICING REVOLVER ─────────────────────────────────────────────────────────
interface PricingProps {
  t: (s: string) => any;
  onOpenModal: (p: string) => void;
}
function Pricing({ t, onOpenModal }: PricingProps) {
  const [yearly, setYearly] = useState(false);
  const plans = t('pricing.plans');

  return (
    <section id="pricing" className="py-24 border-t border-[var(--border)] bg-[var(--bg-2)]/40 relative">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <span className="chip mb-4">
            <Icon name="wallet" size={12} className="text-[var(--accent-2)]" />
            {t('pricing.kicker')}
          </span>
          <h2 className="font-display font-bold text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] max-w-2xl mx-auto text-balance mt-2">
            {t('pricing.title')}
          </h2>
          <p className="mt-4 text-[var(--text-dim)] max-w-xl mx-auto text-balance">
            {t('pricing.sub')}
          </p>

          {/* switcher */}
          <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <button onClick={() => setYearly(false)}
                    className={"px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer " + (!yearly ? "bg-[var(--bg-2)] text-[var(--text)] border border-[var(--border-strong)]" : "text-[var(--text-dim)]")}>
              {t('pricing.monthly')}
            </button>
            <button onClick={() => setYearly(true)}
                    className={"px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer " + (yearly ? "bg-[var(--bg-2)] text-[var(--text)] border border-[var(--border-strong)]" : "text-[var(--text-dim)]")}>
              {t('pricing.yearly')}
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">{t('pricing.save')}</span>
            </button>
          </div>
        </div>

        {/* cards grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          {plans.map((p: any, pi: number) => {
            const popular = pi === 1; // Middle Business Plan
            return (
              <div key={pi} className={"glass rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden transition-all duration-300 text-left " +
                   (popular ? "pulse-border scale-102 z-10" : "hover:border-[var(--accent)]")}
                   style={popular ? { background: "linear-gradient(180deg, var(--accent-soft), var(--bg-2))" } : {}}>
                
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10.5px] uppercase tracking-wider font-semibold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white">
                    {t('pricing.mostPopular')}
                  </span>
                )}

                <div>
                  <div className="font-display font-bold text-xl">{p.name}</div>
                  <div className="text-[12.5px] text-[var(--text-dim)] mt-1">{p.desc}</div>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display font-bold text-[34px] tabular-nums">
                      {yearly ? p.price.y : p.price.m}
                    </span>
                    {(p.price.m !== "Maxsus" && p.price.m !== "Custom") && (
                      <span className="text-[12px] text-[var(--text-faint)]">{t('pricing.currency')}{t('pricing.perMonth')}</span>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-2.5 border-t border-[var(--border)] pt-5">
                    {p.features.map((f: string, fi: number) => (
                      <div key={fi} className="flex items-start gap-2 text-[13px]">
                        <Icon name="check" size={14} className="text-[var(--accent-2)] mt-0.5" />
                        <span className="text-[var(--text-dim)]">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => onOpenModal(p.name)} className={"mt-8 w-full py-2.5 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer " +
                  (popular ? "btn-primary" : "btn-secondary")}>
                  {popular ? t('pricing.ctaPop') : t('pricing.cta')}
                  <Icon name="arrow-right" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ACCORDIONS ───────────────────────────────────────────────────────────
function FAQ({ t }: { t: (s: string) => any }) {
  const items = t('faq.items');
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 border-t border-[var(--border)] relative">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-16">
          <span className="chip mb-4">
            <Icon name="chevron-down" size={12} className="text-[var(--accent)]" />
            {t('faq.kicker')}
          </span>
          <h2 className="font-display font-bold text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] mt-2">
            {t('faq.title')}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((it: any, i: number) => {
            const open = openIdx === i;
            return (
              <div key={i} className="glass rounded-2xl overflow-hidden transition-all duration-300">
                <button onClick={() => setOpenIdx(open ? null : i)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left font-display font-bold text-sm md:text-base cursor-pointer hover:bg-[var(--surface)] transition-all">
                  <span>{it.q}</span>
                  <Icon name={open ? "chevron-up" : "chevron-down"} size={16} className="text-[var(--text-faint)]" />
                </button>

                <div className={"transition-all duration-300 overflow-hidden " + (open ? "max-h-40" : "max-h-0")}>
                  <div className="px-5 pb-5 pt-1 text-xs md:text-sm text-[var(--text-dim)] leading-relaxed border-t border-[var(--border)]/30">
                    {it.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── FINAL CALL TO ACTION BOX ─────────────────────────────────────────────────
function FinalCTA({ t, onOpenModal }: { t: (s: string) => any; onOpenModal: () => void }) {
  return (
    <section className="py-20 relative">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden glass-strong p-12 text-center"
             style={{
               background: "radial-gradient(ellipse at top, var(--accent-soft), transparent 60%), var(--surface-2)",
               boxShadow: "0 30px 100px -30px var(--accent-soft), 0 0 0 1px var(--border-strong)"
             }}>
          {/* decorative grid */}
          <div className="absolute inset-0 opacity-30 pointer-events-none"
               style={{
                 backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
                 backgroundSize: "32px 32px",
                 mask: "radial-gradient(ellipse at center, black, transparent 70%)",
                 WebkitMask: "radial-gradient(ellipse at center, black, transparent 70%)",
               }}></div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 chip mb-6">
              <Icon name="gift" size={13} className="text-[var(--accent-2)]" />
              14 days · 100% free
            </div>
            <h2 className="font-display font-bold text-[clamp(1.8rem,4.5vw,3rem)] leading-[1.05] text-balance max-w-3xl mx-auto">
              {t('cta.title')}
            </h2>
            <p className="mt-5 text-[var(--text-dim)] max-w-xl mx-auto text-balance">{t('cta.sub')}</p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <button onClick={onOpenModal} className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-base cursor-pointer">
                <Icon name="rocket" size={16} /> {t('cta.btn')}
              </button>
              <button onClick={onOpenModal} className="btn-secondary inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-base cursor-pointer">
                <Icon name="phone-call" size={16} /> {t('cta.btn2')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER SECTION ───────────────────────────────────────────────────────────
function Footer({ t }: { t: (s: string) => any }) {
  const cols = [
    { title: t('footer.product'), links: t('footer.product_links') },
    { title: t('footer.company'), links: t('footer.company_links') },
    { title: t('footer.support'), links: t('footer.support_links') },
    { title: t('footer.legal'),   links: t('footer.legal_links') },
  ];

  return (
    <footer className="py-20 border-t border-[var(--border)] relative bg-[var(--bg-2)]/80 text-left">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          
          {/* Tagline */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
                <Icon name="atom" size={16} className="text-white" />
              </div>
              <span className="font-display font-bold text-base">Quantum CRM</span>
            </div>
            <p className="text-xs text-[var(--text-dim)] max-w-xs leading-relaxed">{t('footer.tagline')}</p>
          </div>

          {/* Links */}
          {cols.map((c, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{c.title}</div>
              <div className="flex flex-col gap-1.5">
                {c.links.map((lnk: string, j: number) => (
                  <a key={j} href="#" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
                    {lnk}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[11px] text-[var(--text-faint)]">{t('footer.rights')}</span>
          <div className="flex gap-4">
            <a href="#" className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"><Icon name="instagram" size={16} /></a>
            <a href="#" className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"><Icon name="send" size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
