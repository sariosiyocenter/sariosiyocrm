// i18n.jsx — Uzbek (primary) + English translations.
// Strings keep the same shape across languages. The active language is held
// in App state and passed down via a t(key) helper.

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
          a: "Albatta. Excel, Google Sheets yoki boshqa CRM'lardan ma'lumotlarni ko'chirish bepul. Buni shaxsiy menejer 24 soat ichida hal qiladi.",
        },
        {
          q: "OMR Test Skaneri qanday ishlaydi?",
          a: "Oddiy A4 varaqaga maxsus shablonni chop etasiz. Talabalar javoblarni belgilaydi. Telefoningiz kamerasini varaqaga tutasiz — AI 1 soniyada javoblarni o'qib, natijani Quantum'ga yozadi.",
        },
        {
          q: "14 kunlik bepul sinov nimani o'z ichiga oladi?",
          a: "To'liq tizim — barcha modullar, OMR skaner, SMS limitlari va Premium qo'llab-quvvatlash. Kredit karta talab qilinmaydi. Sinov tugagach, davom etmaslikni tanlasangiz ham, ma'lumotlaringiz saqlanadi.",
        },
        {
          q: "Ma'lumotlar xavfsizligi qanday ta'minlangan?",
          a: "Quantum O'zbekiston Respublikasi qonunchiligiga to'liq mos. Ma'lumotlar shifrlangan (AES-256), serverlar Toshkentda joylashgan, kunlik avtomatik zaxira nusxalar olinadi.",
        },
        {
          q: "Click va Payme'ni ulay olamanmi?",
          a: "Ha. Biznes va Enterprise tariflarda Click, Payme, Uzum Bank va boshqa to'lov tizimlari oldindan integratsiya qilingan. Sozlash 10 daqiqa oladi.",
        },
        {
          q: "Tariflarni keyinroq o'zgartirsam bo'ladimi?",
          a: "Albatta. Istalgan vaqtda yuqori tarifga o'tishingiz mumkin — farq pro-rata hisoblanadi. Pastga tushish keyingi davrning birinchi kunidan kuchga kiradi.",
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
      rights: "© 2026 Quantum Edu. Barcha huquqlar himoyalangan. Toshkent, O'zbekiston.",
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
          a: "The full system — every module, OMR, SMS quota and premium support. No card required. If you don't continue, your data is preserved." },
        { q: "How is data security handled?",
          a: "Fully compliant with Uzbek law. AES-256 encryption, Tashkent-hosted servers, daily automated backups." },
        { q: "Can I connect Click and Payme?",
          a: "Yes — Click, Payme, Uzum Bank and others are pre-integrated on Business and Enterprise. Setup takes 10 minutes." },
        { q: "Can I change plans later?",
          a: "Anytime. Upgrades are pro-rated; downgrades take effect from the next billing cycle." },
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
      rights: "© 2026 Quantum Edu. All rights reserved. Tashkent, Uzbekistan.",
    },
  },
};

// Helper — t('hero.title') with safe fallback to UZ.
function makeT(lang) {
  return (path) => {
    const segs = path.split('.');
    let cur = STRINGS[lang] || STRINGS.uz;
    for (const s of segs) cur = cur?.[s];
    if (cur === undefined) {
      let fb = STRINGS.uz;
      for (const s of segs) fb = fb?.[s];
      return fb;
    }
    return cur;
  };
}

Object.assign(window, { STRINGS, makeT });
