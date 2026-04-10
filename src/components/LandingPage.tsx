import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, MapPin, Phone, Send, GraduationCap,
  ShieldCheck, Star, BookOpen, Globe, Calculator, Atom, FlaskConical,
  Microscope, Languages, CheckCircle2, Trophy, Users, Clock, TrendingUp,
  Instagram, Award, Zap, Target, Building2, Menu, X,
  ArrowRight, Sparkles, BarChart3, Medal, Smartphone
} from 'lucide-react';

// ─── PALETTE ──────────────────────────────────────────────────────────────────
// bg:      #F7F6F2  (warm ivory)
// navy:    #0F2554  (deep navy primary)
// gold:    #C9922A  (academic gold accent)
// slate:   #64748B  (muted text)
// card:    #FFFFFF
// border:  rgba(15,37,84,0.08)

// ─── 3D ORBITAL CANVAS ───────────────────────────────────────────────────────

function OrbitalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = 0, H = 0;
    let t = 0;

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };

    // Subject orbs on different orbital rings
    const ORBS = [
      { label: 'Math', color: '#0F2554', r: 8, orbitR: 120, speed: 0.008, angle: 0,       tilt: 0.35 },
      { label: 'IELTS', color: '#C9922A', r: 10, orbitR: 180, speed: 0.005, angle: 2.1,   tilt: -0.5 },
      { label: 'Physics', color: '#1D4ED8', r: 7, orbitR: 240, speed: 0.007, angle: 4.2,  tilt: 0.6  },
      { label: 'Chemistry', color: '#059669', r: 9, orbitR: 300, speed: 0.004, angle: 1.0, tilt: -0.3 },
      { label: 'Biology', color: '#DC2626', r: 7, orbitR: 200, speed: 0.006, angle: 3.3,  tilt: 0.8  },
    ];

    // Background knowledge particles (tiny dots)
    const DOTS: { x: number; y: number; r: number; alpha: number; drift: number }[] = [];
    const initDots = () => {
      DOTS.length = 0;
      for (let i = 0; i < 60; i++) {
        DOTS.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.3 + 0.05,
          drift: (Math.random() - 0.5) * 0.15,
        });
      }
    };

    // project 3D point (x,y,z) to 2D with perspective
    const project3D = (x: number, y: number, z: number, cx: number, cy: number) => {
      const fov = 400;
      const scale = fov / (fov + z);
      return { sx: x * scale + cx, sy: y * scale + cy, scale };
    };

    // draw a filled circle
    const circle = (x: number, y: number, r: number, fill: string, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };

    // draw ellipse orbit ring
    const drawOrbit = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#0F2554';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 1;

      const mx = (mouseRef.current.x / W - 0.5) * 30;
      const my = (mouseRef.current.y / H - 0.5) * 20;
      const cx = W * 0.62 + mx;
      const cy = H * 0.5 + my;

      // drifting background dots
      for (const d of DOTS) {
        d.x += d.drift;
        if (d.x < 0) d.x = W;
        if (d.x > W) d.x = 0;
        circle(d.x, d.y, d.r, '#0F2554', d.alpha);
      }

      // draw orbit rings first (behind nucleus)
      for (const orb of ORBS) {
        const tiltCos = Math.cos(orb.tilt);
        const rx = orb.orbitR;
        const ry = orb.orbitR * Math.abs(tiltCos);
        drawOrbit(cx, cy, rx, ry, 0.12);
      }

      // nucleus glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55);
      grd.addColorStop(0, 'rgba(201,146,42,0.25)');
      grd.addColorStop(0.5, 'rgba(15,37,84,0.12)');
      grd.addColorStop(1, 'rgba(15,37,84,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // nucleus core
      const coreGrd = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, 22);
      coreGrd.addColorStop(0, '#4A6FD4');
      coreGrd.addColorStop(0.5, '#0F2554');
      coreGrd.addColorStop(1, '#081535');
      circle(cx, cy, 22, '#0F2554', 1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = coreGrd;
      ctx.fill();
      ctx.restore();

      // graduation cap icon (simplified) on nucleus
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#C9922A';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎓', cx, cy);
      ctx.restore();

      // draw orbs
      for (const orb of ORBS) {
        orb.angle += orb.speed;
        const ox = Math.cos(orb.angle) * orb.orbitR;
        const oy = Math.sin(orb.angle) * orb.orbitR * Math.cos(orb.tilt);
        const oz = Math.sin(orb.angle) * orb.orbitR * Math.sin(orb.tilt) * 0.5;

        const p = project3D(ox, oy, oz, cx, cy);
        const scale = p.scale;
        const r = orb.r * scale;

        // orb glow
        const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 3);
        glow.addColorStop(0, orb.color + '55');
        glow.addColorStop(1, orb.color + '00');
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.restore();

        // orb body
        const orbGrd = ctx.createRadialGradient(p.sx - r * 0.3, p.sy - r * 0.3, 0, p.sx, p.sy, r);
        orbGrd.addColorStop(0, lighten(orb.color));
        orbGrd.addColorStop(1, orb.color);
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = orbGrd;
        ctx.shadowColor = orb.color;
        ctx.shadowBlur = 8 * scale;
        ctx.fill();
        ctx.restore();

        // label
        if (scale > 0.6) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, (scale - 0.6) * 2.5);
          ctx.fillStyle = '#0F2554';
          ctx.font = `bold ${Math.round(10 * scale)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(orb.label, p.sx, p.sy + r + 12 * scale);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onResize = () => { resize(); initDots(); };

    resize();
    initDots();
    draw();
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.9 }}
    />
  );
}

function lighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)})`;
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Biz haqimizda', href: '#about' },
  { label: 'Kurslar', href: '#courses' },
  { label: 'Ustozlar', href: '#teachers' },
  { label: 'Natijalar', href: '#results' },
  { label: 'Filiallar', href: '#branches' },
  { label: 'Aloqa', href: '#contact' },
];

const STATS = [
  { value: '3,200+', label: "O'quvchilar", icon: Users },
  { value: '280+', label: 'Davlat granti', icon: Trophy },
  { value: '8', label: 'Yil tajriba', icon: Clock },
  { value: '94%', label: 'Muvaffaqiyat', icon: TrendingUp },
];

const WHY_US = [
  { icon: Smartphone, title: 'Raqamli Nazorat', desc: "Farzandingiz darsga kelmasa, SMS bildirishnoma darhol yuboriladi. O'z CRM tizimimiz." },
  { icon: ShieldCheck, title: 'Xavfsiz Transport', desc: "Darsdan so'ng markazimiz marshrutkalari o'quvchilarni xavfsiz uyiga yetkazadi." },
  { icon: Target, title: 'Kafolatlangan Tizim', desc: "DTM va IELTS uchun ishlangan metodologiya. Natija ko'rinmasa — pul qaytariladi." },
  { icon: BarChart3, title: 'Haftalik Hisobot', desc: "Har hafta bolangizning rivojlanishi bo'yicha batafsil hisobot WhatsApp ga yuboriladi." },
  { icon: Award, title: 'Tajribali Ustozlar', desc: "O'rtacha 8+ yillik tajribaga ega, sertifikatlangan pedagog-ustozlar jamoasi." },
  { icon: Zap, title: 'Intensiv Darslar', desc: "Haftada 3 marta, 1.5–2 soatlik intensiv format. Qisqa vaqtda maksimal natija." },
];

const COURSES = [
  { icon: Calculator, name: 'Matematika', level: 'Barcha bosqich', badge: 'DTM' },
  { icon: Globe, name: 'Ingliz tili (IELTS)', level: 'Beginner → Advanced', badge: 'IELTS' },
  { icon: Atom, name: 'Fizika', level: "O'rta va yuqori", badge: 'DTM' },
  { icon: FlaskConical, name: 'Kimyo', level: "O'rta va yuqori", badge: 'DTM' },
  { icon: Microscope, name: 'Biologiya', level: "O'rta va yuqori", badge: 'DTM' },
  { icon: BookOpen, name: "Ona tili & Adabiyot", level: 'Barcha bosqich', badge: 'DTM' },
  { icon: Languages, name: 'Rus tili', level: 'Beginner → B2', badge: 'CEFR' },
  { icon: GraduationCap, name: 'Tarix', level: "O'rta va yuqori", badge: 'DTM' },
];

const TEACHERS = [
  { name: "Sardor Mirzayev", subject: "IELTS INSTRUCTOR", score: "8.0", exp: "5 yil", students: "1,000+", img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80" },
  { name: "Malika Rahimova", subject: "KIMYO & BIOLOGIYA", score: "100%", exp: "7 yil", students: "800+", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80" },
  { name: "Jasur Aliyev", subject: "MATEMATIKA DTM", score: "SENIOR", exp: "10 yil", students: "3,500+", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80" },
  { name: "Aziza Karimova", subject: "ONA TILI", score: "EXPERT", exp: "8 yil", students: "2,000+", img: "https://images.unsplash.com/photo-1580894732444-8ecded790047?auto=format&fit=crop&w=400&q=80" },
  { name: "Bobur Toshmatov", subject: "FIZIKA DTM", score: "98%", exp: "6 yil", students: "1,200+", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80" },
];

const RESULTS = [
  { name: "Soliha R.", course: "IELTS Intensive", badge: "8.0 Band", sub: "C1 darajasi", img: "https://images.unsplash.com/photo-1544717302-de2939b7ef71?auto=format&fit=crop&w=300&q=80" },
  { name: "Javohir T.", course: "DTM Matematika", badge: "100%", sub: "Davlat granti", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80" },
  { name: "Madina R.", course: "Ona tili, Tarix", badge: "189 ball", sub: "Grant, 2024", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80" },
  { name: "Rustam Q.", course: "IELTS", badge: "7.5 Band", sub: "B2 darajasi", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80" },
  { name: "Nilufar A.", course: "Kimyo, Biologiya", badge: "185 ball", sub: "Tibbiyot fakulteti", img: "https://images.unsplash.com/photo-1580894732444-8ecded790047?auto=format&fit=crop&w=300&q=80" },
];

const BRANCHES = [
  { name: "Sariosiyo Markaziy filiali", address: "Sariosiyo tumani, Markaziy ko'cha 45", phone: "+998 90 123 45 67", hours: "08:00 – 20:00", students: "1,800+", mapUrl: "https://maps.google.com/?q=Sariosiyo" },
  { name: "Sariosiyo Shimoliy filiali", address: "Sariosiyo tumani, Mustaqillik ko'chasi 12", phone: "+998 90 765 43 21", hours: "08:00 – 20:00", students: "1,400+", mapUrl: "https://maps.google.com/?q=Sariosiyo" },
];

const FAQS = [
  { q: "Darslar qancha vaqt davom etadi?", a: "Haftada 3 kun, har bir dars 1.5–2 soat. Kurslar o'rtacha 6–8 moduldan iborat bo'lib, jami 3–4 oy davom etadi." },
  { q: "Ingliz tilini umuman bilmasam IELTS olishim mumkinmi?", a: "Albatta. Noldan boshlash uchun 'General English' kursimiz bor. 3–4 oy ichida baza mustahkamlangach, IELTS Intensive kursiga o'tiladi." },
  { q: "Transport xizmati qanday ishlaydi?", a: "Darsdan so'ng markazimizning marshrutkalari o'quvchilarni xavfsiz uyiga yetkazadi. Narxi oylik to'lovga kiritilgan yoki alohida kelishiladi." },
  { q: "Ota-ona nazorati qanday amalga oshiriladi?", a: "O'z CRM tizimimiz orqali: farzandingiz darsga kelmasa darhol SMS yuboriladi. Haftalik rivojlanish hisoboti WhatsApp ga keladi." },
];

const wiv = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: 'easeOut' },
} as const;

// ─── MAIN ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [teacherIdx, setTeacherIdx] = useState(0);
  const [resultIdx, setResultIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState({ name: '', phone: '', course: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const prevResult = () => setResultIdx(p => p === 0 ? RESULTS.length - 1 : p - 1);
  const nextResult = () => setResultIdx(p => p + 1 >= RESULTS.length ? 0 : p + 1);
  const visibleResults = [RESULTS[resultIdx], RESULTS[(resultIdx + 1) % RESULTS.length], RESULTS[(resultIdx + 2) % RESULTS.length]];

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setFormStatus('loading');
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setFormStatus(res.ok ? 'success' : 'error');
      if (res.ok) setForm({ name: '', phone: '', course: '' });
    } catch { setFormStatus('error'); }
  };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden scroll-smooth" style={{ background: '#F7F6F2', color: '#0F2554' }}>

      {/* ── HEADER ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-navy-900/5 py-3' : 'py-6 bg-transparent'}`}
        style={scrolled ? { borderColor: 'rgba(15,37,84,0.08)' } : {}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F2554' }}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight leading-none" style={{ color: '#0F2554' }}>SARIOSIYO</div>
              <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>O'quv Markazi</div>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-black/5"
                style={{ color: '#334155' }}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login"
              className="hidden md:flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all hover:scale-105 shadow-md"
              style={{ background: '#0F2554' }}>
              Tizimga kirish
            </Link>
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg transition-colors hover:bg-black/5"
              style={{ color: '#0F2554' }}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="lg:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg p-4"
              style={{ borderColor: 'rgba(15,37,84,0.1)' }}>
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold rounded-lg hover:bg-black/5 transition-colors"
                  style={{ color: '#334155' }}>{l.label}</a>
              ))}
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 px-4 py-3 text-white text-sm font-bold rounded-xl"
                style={{ background: '#0F2554' }}>
                Tizimga kirish
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F7F6F2 40%, #FEF9EF 100%)' }}>

        {/* subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #0F2554 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        {/* Orbital 3D Canvas — right side */}
        <div className="absolute inset-0 pointer-events-none">
          <OrbitalCanvas />
        </div>

        {/* Left glow */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(15,37,84,0.06) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-[52%] lg:max-w-[48%]">

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8"
              style={{ background: 'rgba(15,37,84,0.06)', borderColor: 'rgba(15,37,84,0.15)' }}>
              <Sparkles className="w-4 h-4" style={{ color: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#0F2554' }}>
                Sariosiyodagi ilk o'quv ekotizimi
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
              className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.06] mb-6"
              style={{ color: '#0F2554' }}>
              Oddiy Bolalar<br />
              Qanday Qilib{' '}
              <span style={{ color: '#C9922A' }}>Davlat Grantiga</span>
              <br />Kiryapti?
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
              className="text-lg md:text-xl font-medium leading-relaxed max-w-xl mb-10"
              style={{ color: '#475569' }}>
              Kafolatlanmagan bilimlardan voz keching. Bizda barchasi aniq: DTM va IELTS uchun
              ishlangan tizim, haftalik nazorat va qat'iy tartib.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-4">
              <a href="#contact"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-white font-black rounded-2xl transition-all hover:scale-105 text-lg shadow-lg shadow-navy/20"
                style={{ background: '#0F2554' }}>
                Qabulga Yozilish
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#results"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 font-bold rounded-2xl transition-all border text-lg hover:bg-white"
                style={{ color: '#0F2554', borderColor: 'rgba(15,37,84,0.2)' }}>
                Natijalarni Ko'rish
              </a>
            </motion.div>
          </div>
        </div>

        {/* scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-navy-900/40" style={{ background: 'linear-gradient(to bottom, transparent, rgba(15,37,84,0.3))' }} />
          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#C9922A' }} />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="border-y bg-white" style={{ borderColor: 'rgba(15,37,84,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <motion.div key={i} {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: i * 0.08 }}
                className={`flex flex-col items-center py-10 px-6 gap-2 ${i < STATS.length - 1 ? 'border-r' : ''}`}
                style={{ borderColor: 'rgba(15,37,84,0.08)' }}>
                <s.icon className="w-5 h-5 mb-1" style={{ color: '#C9922A' }} />
                <span className="text-3xl md:text-4xl font-black" style={{ color: '#0F2554' }}>{s.value}</span>
                <span className="text-sm font-medium" style={{ color: '#64748B' }}>{s.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ABOUT ── */}
      <section id="about" className="py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.div {...wiv}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
              style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Biz Haqimizda</span>
            </motion.div>
            <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.06 }}
              className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6" style={{ color: '#0F2554' }}>
              Biz shunchaki<br />
              <span style={{ color: '#C9922A' }}>o'quv markaz</span><br />
              emasmiz.
            </motion.h2>
            <motion.p {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              className="text-lg leading-relaxed mb-5" style={{ color: '#475569' }}>
              Sariosiyo O'quv Markazi 2016 yildan beri mintaqada ta'lim sifatini yangi darajaga ko'tarib kelmoqda.
              Bizning maqsadimiz — har bir o'quvchining potensialini to'liq ochib berish.
            </motion.p>
            <motion.p {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.14 }}
              className="text-lg leading-relaxed mb-8" style={{ color: '#475569' }}>
              Zamonaviy raqamli CRM tizimimiz, tajribali ustozlar jamoasi va individual yondashuv orqali
              minglab talabalarimiz DTM va xalqaro imtihonlarda yuqori natijalar ko'rsatdi.
            </motion.p>
            <motion.div {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.18 }} className="flex flex-wrap gap-3">
              {['DTM mutaxassisligi', 'IELTS tayyorlash', 'Raqamli nazorat', 'Individual yondashuv'].map(tag => (
                <span key={tag}
                  className="px-4 py-2 rounded-full border text-sm font-semibold"
                  style={{ borderColor: 'rgba(15,37,84,0.15)', color: '#0F2554', background: 'rgba(15,37,84,0.04)' }}>
                  {tag}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div {...wiv} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }} className="relative">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-navy/10">
              <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80"
                alt="O'quv markaz" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl p-5 shadow-xl border"
              style={{ borderColor: 'rgba(15,37,84,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,146,42,0.12)' }}>
                  <Trophy className="w-5 h-5" style={{ color: '#C9922A' }} />
                </div>
                <div>
                  <div className="text-xl font-black" style={{ color: '#0F2554' }}>280+</div>
                  <div className="text-xs" style={{ color: '#64748B' }}>2024 yilda davlat granti</div>
                </div>
              </div>
            </div>
            <div className="absolute -top-5 -right-5 bg-white rounded-2xl p-5 shadow-xl border"
              style={{ borderColor: 'rgba(15,37,84,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,37,84,0.08)' }}>
                  <Star className="w-5 h-5" style={{ color: '#0F2554' }} />
                </div>
                <div>
                  <div className="text-xl font-black" style={{ color: '#0F2554' }}>4.9/5</div>
                  <div className="text-xs" style={{ color: '#64748B' }}>O'quvchilar bahosi</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── WHY US ── */}
      <section id="why" className="py-28 border-y" style={{ background: '#FFFFFF', borderColor: 'rgba(15,37,84,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div {...wiv}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
              style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Nega Biz</span>
            </motion.div>
            <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="text-4xl md:text-6xl font-black tracking-tight" style={{ color: '#0F2554' }}>
              Boshqalardan<br /><span style={{ color: '#C9922A' }}>farqimiz</span> nima?
            </motion.h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_US.map((item, i) => (
              <motion.div key={i} {...wiv} transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.07 }}
                className="group p-7 rounded-2xl border hover:shadow-lg transition-all duration-300"
                style={{ borderColor: 'rgba(15,37,84,0.08)', background: '#FAFAF8' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(15,37,84,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(15,37,84,0.08)')}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all"
                  style={{ background: 'rgba(15,37,84,0.07)' }}>
                  <item.icon className="w-6 h-6" style={{ color: '#0F2554' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#0F2554' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES ── */}
      <section id="courses" className="py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <motion.div {...wiv}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
              style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Kurslar</span>
            </motion.div>
            <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="text-4xl md:text-6xl font-black tracking-tight" style={{ color: '#0F2554' }}>
              Qaysi yo'nalishda<br /><span style={{ color: '#C9922A' }}>muvaffaq</span> bo'lmoqchisiz?
            </motion.h2>
          </div>
          <motion.a {...wiv} href="#contact"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl border transition-all hover:bg-white"
            style={{ color: '#0F2554', borderColor: 'rgba(15,37,84,0.2)' }}>
            Bog'lanish <ArrowRight className="w-4 h-4" />
          </motion.a>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COURSES.map((c, i) => (
            <motion.div key={i} {...wiv} transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
              className="group p-6 rounded-2xl border bg-white hover:shadow-xl transition-all duration-300 cursor-pointer"
              style={{ borderColor: 'rgba(15,37,84,0.08)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(15,37,84,0.2)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(15,37,84,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,37,84,0.07)' }}>
                  <c.icon className="w-6 h-6" style={{ color: '#0F2554' }} />
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-black" style={{ background: 'rgba(201,146,42,0.12)', color: '#C9922A' }}>
                  {c.badge}
                </span>
              </div>
              <h3 className="font-black text-lg leading-tight mb-1" style={{ color: '#0F2554' }}>{c.name}</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>{c.level}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TEACHERS ── */}
      <section id="teachers" className="py-28 border-y" style={{ background: '#FFFFFF', borderColor: 'rgba(15,37,84,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <motion.div {...wiv}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
              style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>O'qituvchilar</span>
            </motion.div>
            <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="text-4xl md:text-6xl font-black tracking-tight mb-4" style={{ color: '#0F2554' }}>
              Eng yaxshi <span style={{ color: '#C9922A' }}>ustozlar</span> bilan.
            </motion.h2>
            <motion.p {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.14 }}
              className="max-w-lg mx-auto" style={{ color: '#64748B' }}>
              Har bir ustozimiz o'z sohasining amaliyotchisi. Ular faqat o'qitmaydi — natijaga olib boradilar.
            </motion.p>
          </div>

          <div className="grid lg:grid-cols-[1fr_340px] gap-5 mb-5">
            {/* Big featured card */}
            <motion.div {...wiv} transition={{ duration: 0.6, ease: 'easeOut' }}
              className="group relative rounded-3xl overflow-hidden cursor-pointer shadow-2xl shadow-navy/10"
              style={{ minHeight: 480 }}>
              <img src={TEACHERS[teacherIdx].img} alt={TEACHERS[teacherIdx].name}
                className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,37,84,0.92) 0%, rgba(15,37,84,0.3) 50%, transparent 100%)' }} />

              <div className="absolute top-6 left-6">
                <span className="px-3 py-1.5 rounded-xl text-white text-xs font-black" style={{ background: '#C9922A' }}>
                  {TEACHERS[teacherIdx].score}
                </span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C9922A' }}>
                  {TEACHERS[teacherIdx].subject}
                </div>
                <h3 className="text-3xl font-black text-white mb-5">{TEACHERS[teacherIdx].name}</h3>
                <div className="flex items-center gap-5">
                  {[
                    { icon: Clock, value: TEACHERS[teacherIdx].exp, label: 'Tajriba' },
                    { icon: Users, value: TEACHERS[teacherIdx].students, label: "O'quvchi" },
                    { icon: Star, value: '4.9/5', label: 'Reyting' },
                  ].map((stat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                        <stat.icon className="w-4 h-4" style={{ color: '#C9922A' }} />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{stat.value}</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Side list */}
            <div className="flex flex-col gap-3">
              {TEACHERS.map((t, i) => (
                <motion.button key={i} onClick={() => setTeacherIdx(i)}
                  {...wiv} transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.06 }}
                  className="group flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300"
                  style={{
                    borderColor: i === teacherIdx ? 'rgba(15,37,84,0.3)' : 'rgba(15,37,84,0.08)',
                    background: i === teacherIdx ? 'rgba(15,37,84,0.05)' : '#FAFAF8',
                  }}>
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden">
                      <img src={t.img} alt={t.name} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    {i === teacherIdx && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white" style={{ background: '#C9922A' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold tracking-widest truncate mb-0.5" style={{ color: '#C9922A' }}>{t.subject}</div>
                    <div className="font-black truncate" style={{ color: '#0F2554' }}>{t.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{t.exp}</span>
                      <span style={{ color: '#CBD5E1' }}>·</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{t.students} o'quvchi</span>
                    </div>
                  </div>
                  <div className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-black"
                    style={{
                      background: i === teacherIdx ? 'rgba(15,37,84,0.1)' : 'rgba(15,37,84,0.04)',
                      color: '#0F2554'
                    }}>
                    {t.score}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* bottom stats row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {[
              { icon: Trophy, label: 'Davlat granti', value: '280+', desc: "o'quvchi JSHIR oldi" },
              { icon: Star, label: "O'rtacha reyting", value: '4.9', desc: "o'quvchilar bahosi" },
              { icon: Clock, label: 'Umumiy tajriba', value: '36 yil', desc: 'besh ustozning tajribasi' },
              { icon: Users, label: "O'quvchilar", value: '8,500+', desc: 'barcha vaqt uchun' },
            ].map((item, i) => (
              <motion.div key={i} {...wiv} transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.07 }}
                className="flex items-center gap-4 p-5 rounded-2xl border"
                style={{ borderColor: 'rgba(15,37,84,0.08)', background: '#FAFAF8' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(201,146,42,0.1)' }}>
                  <item.icon className="w-5 h-5" style={{ color: '#C9922A' }} />
                </div>
                <div>
                  <div className="text-xl font-black" style={{ color: '#0F2554' }}>{item.value}</div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>{item.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      <section id="results" className="py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.div {...wiv}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
            style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Natijalar</span>
          </motion.div>
          <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
            className="text-4xl md:text-6xl font-black tracking-tight" style={{ color: '#0F2554' }}>
            Orzu emas,<br /><span style={{ color: '#C9922A' }}>haqiqiy natija.</span>
          </motion.h2>
          <motion.p {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.14 }}
            className="mt-4 max-w-xl mx-auto" style={{ color: '#64748B' }}>
            Talabalarimizning xalqaro sertifikatlari va DTM natijalari — bizning eng katta faxrimiz.
          </motion.p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={resultIdx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }}
            className="grid md:grid-cols-3 gap-5">
            {visibleResults.map((r, i) => (
              <div key={i} className="group relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
                style={{ border: '1px solid rgba(15,37,84,0.08)' }}>
                <div className="aspect-[3/4] relative">
                  <img src={r.img} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,37,84,0.9) 30%, transparent)' }} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="inline-block px-3 py-1 rounded-lg text-white text-sm font-black mb-2" style={{ background: '#C9922A' }}>{r.badge}</div>
                  <div className="text-white font-black text-lg">{r.name}</div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{r.course}</div>
                  <div className="text-xs mt-1" style={{ color: '#C9922A' }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-3 mt-8 items-center">
          <button onClick={prevResult}
            className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:bg-white hover:shadow-md"
            style={{ borderColor: 'rgba(15,37,84,0.15)', color: '#0F2554' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          {RESULTS.map((_, i) => (
            <button key={i} onClick={() => setResultIdx(i)}
              className="h-2 rounded-full transition-all"
              style={{ width: i === resultIdx ? 24 : 8, background: i === resultIdx ? '#C9922A' : 'rgba(15,37,84,0.15)' }} />
          ))}
          <button onClick={nextResult}
            className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:bg-white hover:shadow-md"
            style={{ borderColor: 'rgba(15,37,84,0.15)', color: '#0F2554' }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ── BRANCHES ── */}
      <section id="branches" className="py-28 border-y" style={{ background: '#FFFFFF', borderColor: 'rgba(15,37,84,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div {...wiv}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
              style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Filiallar</span>
            </motion.div>
            <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="text-4xl md:text-6xl font-black tracking-tight" style={{ color: '#0F2554' }}>
              Sizga <span style={{ color: '#C9922A' }}>yaqin</span><br />filiallarda.
            </motion.h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {BRANCHES.map((b, i) => (
              <motion.div key={i} {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: i * 0.1 }}
                className="p-7 rounded-2xl border bg-white hover:shadow-xl transition-all duration-300"
                style={{ borderColor: 'rgba(15,37,84,0.08)' }}>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,37,84,0.07)' }}>
                    <Building2 className="w-6 h-6" style={{ color: '#0F2554' }} />
                  </div>
                  <span className="text-xs font-bold border rounded-lg px-3 py-1"
                    style={{ color: '#64748B', borderColor: 'rgba(15,37,84,0.12)' }}>
                    {b.students} o'quvchi
                  </span>
                </div>
                <h3 className="text-xl font-black mb-5" style={{ color: '#0F2554' }}>{b.name}</h3>
                <div className="space-y-3 mb-6">
                  {[
                    { icon: MapPin, text: b.address },
                    { icon: Phone, text: b.phone },
                    { icon: Clock, text: b.hours },
                  ].map((row, j) => (
                    <div key={j} className="flex items-center gap-3 text-sm" style={{ color: '#64748B' }}>
                      <row.icon className="w-4 h-4 shrink-0" style={{ color: '#C9922A' }} />
                      {row.text}
                    </div>
                  ))}
                </div>
                <a href={b.mapUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold transition-colors"
                  style={{ color: '#0F2554' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C9922A')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#0F2554')}>
                  Xaritada ko'rish <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div {...wiv}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
              style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Ko'p so'raladigan savollar</span>
            </motion.div>
            <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: '#0F2554' }}>
              Savollaringizga <span style={{ color: '#C9922A' }}>javob</span>.
            </motion.h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div key={i} {...wiv} transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.07 }}
                className="rounded-2xl border overflow-hidden transition-all duration-300"
                style={{
                  borderColor: openFaq === i ? 'rgba(15,37,84,0.2)' : 'rgba(15,37,84,0.08)',
                  background: openFaq === i ? 'rgba(15,37,84,0.03)' : '#FFFFFF',
                }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-6 text-left">
                  <span className="font-bold text-base" style={{ color: '#0F2554' }}>{faq.q}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: openFaq === i ? '#0F2554' : 'rgba(15,37,84,0.07)',
                      transform: openFaq === i ? 'rotate(45deg)' : 'none',
                    }}>
                    <span className="text-lg font-bold leading-none" style={{ color: openFaq === i ? '#fff' : '#0F2554' }}>+</span>
                  </div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                      <div className="px-6 pb-6 text-base leading-relaxed" style={{ color: '#64748B' }}>{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT + FORM ── */}
      <section id="contact" className="py-28 border-y" style={{ background: '#FFFFFF', borderColor: 'rgba(15,37,84,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <motion.div {...wiv}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border mb-6"
                style={{ background: 'rgba(201,146,42,0.08)', borderColor: 'rgba(201,146,42,0.25)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9922A' }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>Bog'lanish</span>
              </motion.div>
              <motion.h2 {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
                className="text-4xl md:text-5xl font-black tracking-tight mb-6" style={{ color: '#0F2554' }}>
                Bugun qadamingizni<br /><span style={{ color: '#C9922A' }}>qo'ying.</span>
              </motion.h2>
              <motion.p {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.14 }}
                className="text-lg leading-relaxed mb-10" style={{ color: '#475569' }}>
                Bepul maslahat uchun ariza qoldiring. Mutaxassislarimiz 24 soat ichida siz bilan bog'lanadi.
              </motion.p>
              <motion.div {...wiv} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.2 }} className="space-y-4">
                {[
                  { icon: Phone, label: 'Telefon', value: '+998 90 123 45 67', href: 'tel:+998901234567' },
                  { icon: Instagram, label: 'Instagram', value: '@sariosiyo_markaz', href: 'https://instagram.com' },
                  { icon: MapPin, label: 'Manzil', value: "Sariosiyo tumani, Markaziy ko'cha 45", href: null },
                ].map((row, i) => (
                  <div key={i}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${row.href ? 'cursor-pointer hover:bg-gray-50 hover:shadow-sm' : ''}`}
                    style={{ borderColor: 'rgba(15,37,84,0.1)' }}
                    onClick={() => row.href && window.open(row.href)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(15,37,84,0.07)' }}>
                      <row.icon className="w-5 h-5" style={{ color: '#0F2554' }} />
                    </div>
                    <div>
                      <div className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>{row.label}</div>
                      <div className="font-bold" style={{ color: '#0F2554' }}>{row.value}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div {...wiv} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              className="p-8 rounded-3xl border shadow-xl shadow-navy/5"
              style={{ borderColor: 'rgba(15,37,84,0.1)', background: '#FAFAF8' }}>
              <h3 className="text-2xl font-black mb-2" style={{ color: '#0F2554' }}>Bepul Konsultatsiya</h3>
              <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>Ma'lumotlaringizni qoldiring, biz bog'lanamiz.</p>

              {formStatus === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(201,146,42,0.12)' }}>
                    <CheckCircle2 className="w-8 h-8" style={{ color: '#C9922A' }} />
                  </div>
                  <h4 className="text-xl font-black mb-2" style={{ color: '#0F2554' }}>Ariza qabul qilindi!</h4>
                  <p style={{ color: '#64748B' }}>24 soat ichida siz bilan bog'lanamiz.</p>
                  <button onClick={() => setFormStatus('idle')}
                    className="mt-6 text-sm font-semibold" style={{ color: '#C9922A' }}>
                    Yangi ariza qoldirish
                  </button>
                </div>
              ) : (
                <form onSubmit={submitForm} className="space-y-4">
                  {[
                    { label: 'Ism Familiya *', key: 'name', type: 'text', placeholder: 'Masalan: Aziz Karimov' },
                    { label: 'Telefon *', key: 'phone', type: 'tel', placeholder: '+998 90 123 45 67' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#94A3B8' }}>{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={form[f.key as 'name' | 'phone']}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        required={f.label.includes('*')}
                        className="w-full px-4 py-3.5 rounded-xl border outline-none transition-all text-sm"
                        style={{ background: '#FFFFFF', borderColor: 'rgba(15,37,84,0.15)', color: '#0F2554' }}
                        onFocus={e => (e.target.style.borderColor = '#0F2554')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(15,37,84,0.15)')}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#94A3B8' }}>Qiziqayotgan kurs</label>
                    <select
                      value={form.course}
                      onChange={e => setForm({ ...form, course: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl border outline-none transition-all text-sm"
                      style={{ background: '#FFFFFF', borderColor: 'rgba(15,37,84,0.15)', color: form.course ? '#0F2554' : '#94A3B8' }}>
                      <option value="">Kursni tanlang (ixtiyoriy)</option>
                      {COURSES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  {formStatus === 'error' && (
                    <p className="text-red-500 text-sm">Xatolik yuz berdi. Qayta urinib ko'ring.</p>
                  )}

                  <button type="submit" disabled={formStatus === 'loading'}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 text-white font-black rounded-xl transition-all hover:scale-[1.02] active:scale-95 text-base mt-2 disabled:opacity-60 shadow-lg"
                    style={{ background: '#0F2554' }}>
                    {formStatus === 'loading' ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Yuborilmoqda...</>
                    ) : (
                      <>Ariza Yuborish <Send className="w-4 h-4" /></>
                    )}
                  </button>
                  <p className="text-xs text-center" style={{ color: '#CBD5E1' }}>Ma'lumotlaringiz uchinchi shaxslarga berilmaydi</p>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 border-t" style={{ borderColor: 'rgba(15,37,84,0.08)', background: '#F7F6F2' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <a href="#" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0F2554' }}>
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-black" style={{ color: '#0F2554' }}>SARIOSIYO</div>
                <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#C9922A' }}>O'quv Markazi</div>
              </div>
            </a>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} className="text-xs transition-colors hover:opacity-70" style={{ color: '#94A3B8' }}>{l.label}</a>
              ))}
            </nav>
            <p className="text-xs" style={{ color: '#CBD5E1' }}>© {new Date().getFullYear()} Sariosiyo O'quv Markazi</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
