import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Spline from '@splinetool/react-spline';
import { Link } from 'react-router-dom';
import { 
  BusFront, MessageSquareWarning, MapPin, Phone, 
  Map, Send, GraduationCap, ShieldCheck, ChevronRight, ChevronLeft,
  Play, CheckCircle2, Flame, Timer, Instagram, Star, BookOpen, ChevronDown,
  Globe, Calculator, Laptop, Building, Atom, FlaskConical, Microscope, Languages
} from 'lucide-react';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Removed useScroll to fix crashes

  // IELTS Carousel state
  const [certIndex, setCertIndex] = useState(0);
  const results = [
    { name: "Soliha R.", course: "IELTS Intensive", band: "8.0", cefr: "C1", img: "https://images.unsplash.com/photo-1544717302-de2939b7ef71?auto=format&fit=crop&w=300&q=80", bgCorner: "bg-green-500" },
    { name: "Javohir T.", course: "DTM Matematika", band: "100%", cefr: "Grant", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80", bgCorner: "bg-[#1b6b6b]/50" },
    { name: "Madina R.", course: "Ona tili, Tarix", band: "189", cefr: "B1", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80", bgCorner: "bg-[#1b6b6b]" },
    { name: "Rustam Q.", course: "IELTS", band: "7.5", cefr: "B2", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80", bgCorner: "bg-green-500" }
  ];
  const nextCert = () => setCertIndex((p) => (p + 1 >= 3 ? 0 : p + 1));
  const prevCert = () => setCertIndex((p) => (p === 0 ? 2 : p - 1));

  // Teachers Carousel state
  const teachers = [
    { name: "Sardor M.", subject: "IELTS INSTRUCTOR", score: "8.0", exp: "5 yil", students: "1000+", img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80", gradient: "from-slate-200 to-[#1b6b6b]" },
    { name: "Malika R.", subject: "KIMYO & BIOLOGIYA", score: "100%", exp: "7 yil", students: "800+", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", gradient: "from-blue-200 to-cyan-400" },
    { name: "Jasur A.", subject: "MATEMATIKA DTM", score: "SENIOR", exp: "10 yil", students: "3500+", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80", gradient: "from-emerald-200 to-teal-500" },
    { name: "Aziza K.", subject: "ONA TILI", score: "EXPERT", exp: "8 yil", students: "2000+", img: "https://images.unsplash.com/photo-1580894732444-8ecded790047?auto=format&fit=crop&w=400&q=80", gradient: "from-purple-200 to-pink-400" }
  ];
  const [tchIndex, setTchIndex] = useState(0);
  const nextTch = () => setTchIndex((p) => (p + 1 >= 2 ? 0 : p + 1));
  const prevTch = () => setTchIndex((p) => (p === 0 ? 1 : p - 1));

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const faqs = [
    { q: "Darslar qancha vaqt davom etadi?", a: "Standart kurslar odatda 6-8 qismga bo'linib o'tildi. Haftada 3 kun, har bir dars davomiyligi 1.5 - 2 soatni tashkil qiladi. Darslar intensiv bo'lib o'tadi." },
    { q: "Ingliz tilini umuman bilmasam IELTS olishim mumkinmi?", a: "Albatta. Beginner (Noldan) boshlovchilar uchun maxsus 'General English' kurslarimiz mavjud bo'lib, ular bazani 3-4 oy ichida mustahkamlab Keyin IELTS Intensive kursiga yo'naltiriladi." },
    { q: "Transport xizmati qanday ishlaydi?", a: "Darsdan so'ng markazimizning marshrutkalari o'quvchilarni tumanning markaziy hududlarigacha yoki uzog'ida yashovchilarni bekatigacha xavfsiz eltib qo'yadi. Xizmat to'lovi oylik to'lov ichiga kiradi yoki alohida arzon narxda kelishiladi." },
    { q: "Ota-ona nazorati qanday ishlaydi?", a: "Biz maxsus o'zimizning Raqamli CRM ekotizimimizni ishlab chiqqanmiz. Farzandingiz darsga kelmagan zahoti administratorlar qayd etadi va dars boshlanishi bilan ota-onasining raqamiga Avtomatik SMS bildirishnoma yuboriladi." }
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-900 overflow-x-hidden scroll-smooth">
      
      {/* Dynamic Header */}
      <header className={`fixed w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-white/95 backdrop-blur-xl shadow-sm py-4 border-b border-slate-100' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Sariosiyo Logo" className="w-16 h-16 object-contain" />
            <div className="flex flex-col">
              <span className={`text-2xl font-black tracking-tighter leading-none ${isScrolled ? 'text-slate-800' : 'text-white'}`}>SARIOSIYO</span>
              <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${isScrolled ? 'text-[#1b6b6b]' : 'text-[#1b6b6b]'}`}>O'quv Markazi</span>
            </div>
          </div>

          <nav className={`hidden lg:flex gap-8 px-8 py-3 rounded-full border backdrop-blur-md transition-colors ${isScrolled ? 'bg-slate-100/50 border-slate-200/50' : 'bg-white/10 border-white/20'}`}>
            {['Natijalar', 'Kurslar', "Ustozlar", "Savollar", "Aloqa"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '')}`} className={`text-[14px] uppercase tracking-wider font-extrabold transition-colors ${isScrolled ? 'text-slate-600 hover:text-[#1b6b6b]' : 'text-slate-100 hover:text-white'}`}>
                {item}
              </a>
            ))}
          </nav>

          <Link to="/login" className="hidden md:flex items-center gap-2 px-7 py-3 bg-[#1b6b6b] hover:bg-[#0d4d4d] text-white font-bold rounded-full transition-all hover:scale-105 shadow-[0_0_20px_rgba(27,107,107,0.4)]">
            Kirish
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="relative min-h-[90vh] flex items-center pt-28 pb-16 overflow-hidden"
      >
        <div className="absolute inset-0 z-0 h-full w-full pointer-events-auto">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80')" }}
          ></div>
          <div className="absolute inset-0 bg-slate-900/70 z-10 pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/40 z-10 pointer-events-none"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 flex justify-center items-center w-full min-h-[60vh]">
          <div className="flex flex-col items-center text-center max-w-4xl w-full">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-[#1b6b6b]/20 border border-[#1b6b6b]/30 backdrop-blur-md mb-6 shadow-[0_0_30px_rgba(27,107,107,0.3)] relative pointer-events-auto"
            >
              <Flame className="w-5 h-5 text-orange-400 relative z-10" />
              <span className="font-extrabold text-[#1b6b6b] text-xs md:text-sm tracking-widest uppercase relative z-10">SARIOSIYODAGI ILK O'QUV EKOTIZIMI</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight max-w-5xl mx-auto uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto"
            >
              Oddiy Bolalar Qanday Qilib <br className="hidden md:block"/> <span className="text-[#1b6b6b] bg-clip-text text-transparent bg-gradient-to-r from-[#1b6b6b] to-teal-400 line-clamp-none">Davlat Grantiga</span> Kiryapti?
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto mt-6 mb-10 drop-shadow-2xl pointer-events-auto"
            >
              Kafolatlanmagan bilimlardan voz keching. Bizda barchasi aniq: DTM va IELTS uchun kafolatlangan tizim, haftalik nazorat va qat'iy tartib.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 w-full justify-center max-w-sm mx-auto"
            >
              <a href="#aloqa" className="group relative w-full flex items-center justify-center px-8 py-4 bg-gradient-to-r from-[#1b6b6b] to-[#1b6b6b] text-white font-black rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg text-lg">
                 Qabulga Yozilish <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Results Carousel */}
      <section id="natijalar" className="py-32 bg-black overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1b6b6b]/20 rounded-full blur-[120px] pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#1b6b6b]/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1b6b6b]/10 border border-[#1b6b6b]/20 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#1b6b6b] animate-pulse"></span>
                <span className="text-[#1b6b6b] font-bold uppercase tracking-widest text-xs">Real Natijalar</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none mb-6">
                ORZU EMAS, <br/><span className="text-[#1b6b6b]">NATIJA.</span>
              </h2>
              <p className="text-xl text-slate-400 font-medium max-w-xl leading-relaxed">
                Bozorda quruq va'da ko'p, ammo bizda faktlar gapiradi. Talabalarimizning xalqaro sertifikatlari — bizning yuzimiz.
              </p>
            </div>
            
            <div className="flex gap-4">
              <button onClick={prevCert} className="w-16 h-16 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-[#1b6b6b] text-white transition-all duration-300 group shadow-2xl">
                <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
              </button>
              <button onClick={nextCert} className="w-16 h-16 bg-[#1b6b6b] rounded-full flex items-center justify-center text-white hover:bg-[#155656] shadow-[0_0_30px_rgba(27,107,107,0.4)] transition-all duration-300 group">
                <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="flex gap-10 transition-transform duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)]" style={{ transform: `translateX(-${certIndex * (100 / 3)}%)` }}>
            {results.map((r, i) => (
              <div key={i} className="min-w-[380px] md:min-w-[450px] shrink-0 pb-12 perspective-1000">
                <motion.div 
                  whileHover={{ y: -15, rotateY: 2, rotateX: -2 }}
                  className="relative group cursor-pointer"
                >
                  {/* Decorative Glow */}
                  <div className={`absolute -inset-1 bg-gradient-to-br transition-opacity opacity-0 group-hover:opacity-30 blur-2xl rounded-[2.5rem] z-0`} style={{ backgroundColor: r.bgCorner === 'bg-[#1b6b6b]' ? '#1b6b6b' : (r.bgCorner === 'bg-green-500' ? '#22c55e' : '#f97316') }}></div>
                  
                  <div className="relative bg-slate-900 px-8 py-10 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl z-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.03] rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    
                    <div className="flex justify-between items-start mb-10">
                      <h3 className="text-2xl font-black text-white/20 tracking-widest uppercase">CERTIFICATE</h3>
                      <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                        <CheckCircle2 className="text-[#1b6b6b] w-6 h-6" />
                      </div>
                    </div>

                    <div className="flex gap-6 mb-10 pb-8 border-b border-white/5">
                      <div className="relative">
                        <img src={r.img} alt={r.name} className="w-28 h-28 rounded-2xl object-cover border border-white/10 p-1.5 bg-white/5" />
                        <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full ${r.bgCorner} border-4 border-slate-900 shadow-xl`}></div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-[#1b6b6b] tracking-[0.2em] mb-2">Student ID: 00{i+1}</div>
                        <div className="font-black text-3xl text-white tracking-tight leading-none mb-3">{r.name}</div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400">
                          {r.course}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-8">
                      <div className={`p-6 rounded-3xl ${r.bgCorner} text-white shadow-xl relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full blur-2xl -mr-8 -mt-8"></div>
                        <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-2 italic">Band Score</div>
                        <div className="text-5xl font-black tracking-tighter">{r.band}</div>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col justify-center shadow-inner">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 italic">CEFR Level</div>
                        <div className="text-3xl font-black text-white tracking-tight">{r.cefr}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Core Advantages (Features without CRM text) */}
      <section className="py-24 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 uppercase tracking-tight">Ota-onalar nima uchun <span className="text-[#1b6b6b]">bizni tanlashadi?</span></h2>
            <p className="text-xl text-slate-600 font-medium">Farzandingiz faqat ta'lim olibgina qolmay, xavfsiz va tizimli muhitda bo'ladi.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-16">
            {[
              { title: "Telefon orqali Nazorat", desc: "Farzandingiz darsga kelmasa darhol SMS ogohlantirish yuboriladi.", icon: MessageSquareWarning, color: "text-red-500", bg: "bg-red-50" },
              { title: "Kafolatlangan Xavfsizlik", desc: "Darsdan so'ng o'quvchilarni xavfsiz transport orqali uylariga eltish xizmati.", icon: BusFront, color: "text-[#1b6b6b]", bg: "bg-[#1b6b6b]/5" },
              { title: "Doimiy Imtihonlar (Mock/DTM)", desc: "Har oy xalqaro va davlat testlari formatida o'quvchilar darajasini tekshirib boramiz.", icon: ShieldCheck, color: "text-[#1b6b6b]", bg: "bg-[#1b6b6b]/5" },
              { title: "Kuchli Muhit va Metodlar", desc: "Oddiy takrorlashlar emas, balki til muhiti va mantiqiy fikrlashni kuchaytirish.", icon: Star, color: "text-[#1b6b6b]", bg: "bg-emerald-50" },
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                className="flex gap-6 group"
              >
                <div className={`w-20 h-20 rounded-3xl ${item.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 border border-slate-100`}>
                  <item.icon className={`w-10 h-10 ${item.color}`} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 font-medium text-lg leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Courses Section */}
      <section id="kurslar" className="py-16 bg-slate-50 border-t border-slate-200 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-4">Bizning Dasturlar</h2>
            <p className="text-xl text-slate-600 font-medium max-w-2xl">Barcha yo'nalishlar xalqaro va davlat standartlari asosida tuzilgan.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Course Card */}
            {[
              { name: "Matematika", time: "8 Oy", level: "DTM va Xalqaro testlar", icon: Calculator, bg: "bg-[#1b6b6b]", border: "border-[#1b6b6b]" },
              { name: "Ingliz Tili", time: "6 Oy", level: "IELTS va General English", icon: Globe, bg: "bg-[#1b6b6b]", border: "border-[#1b6b6b]" },
              { name: "Fizika", time: "8 Oy", level: "Nazariya va Masalalar", icon: Atom, bg: "bg-amber-500", border: "border-amber-500" },
              { name: "Kimyo", time: "9 Oy", level: "DTM va Tibbiyot yo'nalishi", icon: FlaskConical, bg: "bg-[#1b6b6b]", border: "border-[#1b6b6b]" },
              { name: "Biologiya", time: "9 Oy", level: "Tibbiyotga tayyorgarlik", icon: Microscope, bg: "bg-[#1b6b6b]", border: "border-[#1b6b6b]" },
              { name: "Ona Tili", time: "6 Oy", level: "Milliy sertifikat va DTM", icon: BookOpen, bg: "bg-[#1b6b6b]/50", border: "border-orange-500" },
              { name: "Tarix va Huquq", time: "8 Oy", level: "Abituriyentlar uchun", icon: Building, bg: "bg-slate-700", border: "border-slate-700" },
              { name: "Rus Tili", time: "4-5 Oy", level: "Native speaking formatida", icon: Languages, bg: "bg-[#1b6b6b]", border: "border-[#1b6b6b]" }
            ].map((course, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className={`bg-white rounded-3xl p-8 border-b-[6px] ${course.border} shadow-lg shadow-slate-200/50 relative overflow-hidden group`}
              >
                <div className={`w-16 h-16 ${course.bg} rounded-2xl flex items-center justify-center mb-6 shadow-md`}>
                  <course.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase tracking-wide">{course.name}</h3>
                <div className="space-y-2 mb-8">
                  <div className="flex font-bold text-slate-500 text-sm uppercase tracking-wider">
                    <span className="w-24">Davomiylik:</span> <span className="text-slate-800">{course.time}</span>
                  </div>
                  <div className="flex font-bold text-slate-500 text-sm uppercase tracking-wider">
                    <span className="w-24">Daraja:</span> <span className="text-slate-800">{course.level}</span>
                  </div>
                </div>
                <button className="w-full py-4 bg-slate-50 border-2 border-slate-100 text-slate-800 font-bold rounded-xl hover:bg-slate-900 hover:border-slate-900 hover:text-white transition-colors group-hover:shadow-md">
                  Ro'yxatdan o'tish
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Teachers Carousel */}
      <section id="ustozlar" className="py-32 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/20 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#1b6b6b]/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-5xl font-black uppercase tracking-tight mb-4 text-white">Ustozlarimiz</h2>
              <p className="text-xl text-slate-400 font-medium">Barchasi darajali, xalqaro sertifikatga ega va yillar davomida tajriba to'plagan professionallar.</p>
            </div>
            
            <div className="hidden md:flex gap-3">
              <button onClick={prevTch} className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={nextTch} className="w-14 h-14 rounded-full border border-white/10 bg-white text-slate-900 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="relative">
             <div className="flex gap-6 transition-transform duration-500 ease-out" style={{ transform: `translateX(-${tchIndex * (350 + 24)}px)` }}>
               {teachers.map((t, idx) => (
                 <div key={idx} className="w-[350px] flex-shrink-0 relative group h-[480px] rounded-[2rem] overflow-hidden border border-white/10 bg-slate-800">
                   <div className={`absolute inset-0 bg-gradient-to-t ${t.gradient} to-transparent opacity-60 mix-blend-multiply z-0`}></div>
                   
                   <img src={t.img} alt={t.name} className="absolute bottom-0 w-full h-[110%] object-cover object-top z-10 transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-4" />
                   
                   {/* Glass Card content */}
                   <div className="absolute inset-x-0 bottom-0 p-6 pt-24 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent z-20">
                     <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-wide leading-tight">{t.name}</h3>
                     <p className="text-sm font-bold text-slate-300 uppercase mb-4 tracking-widest">{t.subject}</p>
                     
                     <div className="flex gap-4">
                       <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Score / Band</div>
                         <div className="inline-flex items-center px-3 py-1 bg-yellow-400 text-slate-900 font-extrabold rounded-md text-sm">
                           {t.score}
                         </div>
                       </div>
                       <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Experience</div>
                         <div className="font-extrabold text-white">{t.exp}</div>
                       </div>
                       <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Students</div>
                         <div className="font-extrabold text-white">{t.students}</div>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="savollar" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-4">Ko'p Beriladigan <span className="text-[#1b6b6b]">Savollar</span></h2>
            <p className="text-xl text-slate-600 font-medium">Qabul jarayoni va o'qish formati bo'yicha onalarning asosiy savollari.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-2 border-slate-100 rounded-2xl bg-white overflow-hidden transition-all shadow-sm">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xl font-bold text-slate-900 pr-5">{faq.q}</span>
                  <ChevronDown className={`w-6 h-6 text-slate-400 shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div 
                      key="content"
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: "auto", opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6 text-lg text-slate-600 font-medium"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Contact Section */}
      <section id="aloqa" className="py-24 relative bg-slate-900 border-t border-slate-800 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#1b6b6b]/10 rounded-full blur-[120px] pointer-events-none translate-x-1/4 -translate-y-1/4"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            
            {/* Left side: Info */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1b6b6b]/10 border border-[#1b6b6b]/20 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#1b6b6b] animate-pulse"></span>
                <span className="text-[#1b6b6b] font-bold uppercase tracking-wider text-xs">Aloqa</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-none tracking-tight">
                QABULGA <span className="text-[#1b6b6b]">YOZILISH</span>
              </h2>
              <p className="text-lg text-slate-400 font-medium mb-10 max-w-md leading-relaxed">
                Joylar soni cheklangan. Hozir ro'yxatdan o'ting va bepul sinov darsiga ega bo'ling.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shadow-lg">
                    <MapPin className="text-[#1b6b6b] w-6 h-6"/>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Manzil</div>
                    <div className="text-base font-bold text-white">Sariosiyo tumani, Xalqbank orqasi</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shadow-lg">
                    <Phone className="text-[#1b6b6b] w-6 h-6"/>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Telefon</div>
                    <div className="text-base font-bold text-white">+998 99 350 99 66</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Form */}
            <form className="bg-slate-900/80 backdrop-blur-2xl p-10 md:p-14 rounded-[3rem] border border-slate-700/50 shadow-2xl relative overflow-hidden" onSubmit={(e) => { e.preventDefault(); alert("So'rov yuborildi!"); }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#1b6b6b]/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#1b6b6b]/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">Ismingiz</label>
                  <input type="text" placeholder="Ism Familiya" required className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl outline-none focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 text-white font-bold text-lg transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">Telefon Raqamingiz</label>
                  <input type="tel" placeholder="+998" required className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl outline-none focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 text-white font-bold text-lg transition-all" />
                </div>
                
                <button type="submit" className="w-full mt-10 py-6 bg-[#1b6b6b] hover:bg-[#155656] text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl shadow-[#1b6b6b]/40 flex justify-center items-center gap-3 active:scale-[0.98]">
                  RO'YXATDAN O'TISH <Send className="w-6 h-6" />
                </button>
              </div>
            </form>
            
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-16 border-t font-medium border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-12 flex flex-col items-center">
            <img src="/logo.png" alt="Sariosiyo Logo" className="w-24 h-24 object-contain mb-6" />
            <div className="h-1 w-20 bg-[#1b6b6b] rounded-full"></div>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-6">Sariosiyo Learning Center</h2>
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12 text-lg text-slate-400 mb-12">
            <div className="flex items-center gap-3"><MapPin className="text-slate-500" /> Sariosiyo tumani, Xalqbank orqasi</div>
            <div className="flex items-center gap-3"><Phone className="text-slate-500" /> +998 99 350 99 66</div>
            <div className="flex gap-4">
              <a href="https://t.me/sariosiyooquvmarkazi" className="w-12 h-12 rounded-full bg-slate-800 flex justify-center items-center hover:bg-[#1b6b6b] text-white transition-colors"><Send className="w-5 h-5"/></a>
              <a href="https://instagram.com/sariosiyo_oquv_markaz" className="w-12 h-12 rounded-full bg-slate-800 flex justify-center items-center hover:bg-pink-600 text-white transition-colors"><Instagram className="w-5 h-5"/></a>
            </div>
          </div>
          <div className="text-slate-600 text-sm font-bold uppercase tracking-widest border-t border-slate-800 pt-8">
            © 2026 Sariosiyo O'quv Markazi — Professional ta'lim maskani.
          </div>
        </div>
      </footer>
      
    </div>
  );
}
