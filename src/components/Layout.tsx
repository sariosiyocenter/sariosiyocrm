import React, { useState } from 'react';
import {
  Users, GraduationCap, Target, Settings,
  LayoutDashboard, Wallet, Search, Sun, Moon, LogOut, X, ChevronRight, User, MapPin,
  CheckCircle2, AlertCircle, AlertTriangle, Info, Menu, BarChart3, Bus, FileText, Shield, Atom, Users2, Globe, BookOpen, MessageSquare
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const BRAND = 'var(--brand-color)';

export default function Layout({ children, onLogout }: LayoutProps) {
  const { user, schools, selectedSchoolId, setSelectedSchoolId, students, leads, groups, teachers, courses, darkMode, toggleDarkMode, notification, settings, error, retryLoad } = useCRM();
  const { lang, setLang, t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const baseItems = [
    { label: t('nav_dashboard'), icon: LayoutDashboard, path: '/' },
    { label: t('nav_leads'),     icon: Target,          path: '/leads' },
    { label: t('nav_students'),  icon: User,            path: '/students' },
    { label: t('nav_groups'),    icon: Users,           path: '/courses' },
    { label: t('nav_syllabus'),  icon: BookOpen,        path: '/syllabus' },
    { label: t('nav_finance'),   icon: Wallet,          path: '/finance' },
    { label: t('nav_logistics'), icon: Bus,             path: '/logistics' },
    { label: t('nav_exams'),     icon: FileText,        path: '/exams' },
    { label: t('nav_messaging'), icon: MessageSquare,   path: '/messaging' },
    { label: t('nav_hr'),        icon: Users2,          path: '/hr' },
    { label: t('nav_settings'),  icon: Settings,        path: '/settings' },
  ];

  const navItems = user?.role === 'SUPERADMIN'
    ? [{ label: 'Super Admin', icon: Shield, path: '/superadmin' }]
    : user?.role === 'SELLER'
      ? [{ label: 'Sotuvchi Dashboard', icon: Target, path: '/superadmin' }]
      : baseItems;

  const getSearchResults = () => {
    if (searchQuery.trim().length < 2) return null;
    const lowerQ = searchQuery.toLowerCase();
    const s = (val: string | undefined | null) => (val || '').toLowerCase();
    return {
      students: (students || []).filter(st => s(st.name).includes(lowerQ) || s(st.phone).includes(lowerQ)).slice(0, 3),
      leads: (leads || []).filter(l => s(l.name).includes(lowerQ) || s(l.phone).includes(lowerQ)).slice(0, 3),
      groups: (groups || []).filter(g => s(g.name).includes(lowerQ) || s(courses.find(c => c.id === g.courseId)?.name).includes(lowerQ)).slice(0, 3),
      teachers: (teachers || []).filter(t => s(t.name).includes(lowerQ) || s(t.phone).includes(lowerQ)).slice(0, 3),
    };
  };

  const results = getSearchResults();
  const debtorCount = (students || []).filter(s => (s.balance || 0) < 0).length;

  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f18] transition-colors duration-200 flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#121826] border-b border-slate-200 dark:border-slate-800/60 shadow-sm">
        
        {/* Top Bar (DentaCRM style: Logo, Search, Profile) */}
        <div className="h-[64px] flex items-center justify-between px-4 xl:px-8">
          <div className="flex items-center gap-6 xl:gap-8">
            
            {/* Mobile menu button */}
            <button
              className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-brand to-brand-accent flex items-center justify-center shadow-inner">
                {settings?.logo
                  ? <img src={settings.logo} className="w-full h-full object-cover" alt="logo" />
                  : <Atom size={22} className="text-white" />
                }
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                  {settings?.orgName || 'Quantum'}
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-wide mt-1">O'quv markazi CRM</span>
              </div>
            </Link>

            {/* Search */}
            {user?.role !== 'SUPERADMIN' && user?.role !== 'SELLER' && (
              <div className="hidden lg:flex items-center relative w-[320px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Bemor yoki shifokor o'rniga: O'quvchi, ustoz..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#1b2333] border-none focus:ring-2 focus:ring-brand/30 rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400/80 outline-none transition-all"
                />
                
                {/* Search Dropdown */}
                {results && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a2232] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden max-h-[70vh] overflow-y-auto z-50">
                    {Object.values(results).every(arr => arr.length === 0) ? (
                      <div className="p-8 text-center">
                        <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">Hech narsa topilmadi</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {results.students.length > 0 && (
                          <div className="p-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">O'quvchilar</p>
                            {results.students.map(s => (
                              <div key={s.id} onClick={() => handleResultClick(`/students/${s.id}`)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand/5 dark:hover:bg-[#232d42] rounded-xl cursor-pointer transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0)}</div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.name}</p>
                                  <p className="text-xs font-medium text-slate-400">{s.phone}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {results.leads.length > 0 && (
                          <div className="p-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">Lidlar</p>
                            {results.leads.map(l => (
                              <div key={l.id} onClick={() => handleResultClick('/leads')} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand/5 dark:hover:bg-[#232d42] rounded-xl cursor-pointer transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0"><Target size={16}/></div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{l.name}</p>
                                  <p className="text-xs font-medium text-slate-400">{l.course} • {l.phone}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {results.groups.length > 0 && (
                          <div className="p-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">{t('stat_groups')}</p>
                            {results.groups.map(g => (
                              <div key={g.id} onClick={() => handleResultClick(`/courses/${g.id}`)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand/5 dark:hover:bg-[#232d42] rounded-xl cursor-pointer transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0"><Users size={16}/></div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.name}</p>
                                  <p className="text-xs font-medium text-slate-400">
                                    {(() => {
                                      const c = courses.find(c => c.id === g.courseId);
                                      return c && c.name !== 'birinchi' ? c.name : '';
                                    })()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {results.teachers.length > 0 && (
                          <div className="p-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">Ustozlar</p>
                            {results.teachers.map(t => (
                              <div key={t.id} onClick={() => handleResultClick(`/teachers/${t.id}`)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand/5 dark:hover:bg-[#232d42] rounded-xl cursor-pointer transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0"><GraduationCap size={16}/></div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.name}</p>
                                  <p className="text-xs font-medium text-slate-400">{t.phone}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 lg:gap-4">
            
            {/* Branch Selector */}
            {user?.role !== 'SUPERADMIN' && user?.role !== 'SELLER' && (
              <div className="hidden lg:flex relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={selectedSchoolId === null ? '' : selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(Number(e.target.value))}
                  className="pl-9 pr-8 py-2 bg-transparent border-none text-[13px] font-semibold text-slate-700 dark:text-slate-200 outline-none hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all cursor-pointer appearance-none"
                >
                  <option value="" disabled>Filialni tanlang</option>
                  {user?.role === 'ADMIN' && <option value="0">To'liq markaz</option>}
                  {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
              </div>
            )}

            {/* Debtors badge */}
            {user?.role !== 'SUPERADMIN' && user?.role !== 'SELLER' && debtorCount > 0 && (
              <button
                onClick={() => navigate('/students?filter=debt')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[12px] font-semibold tracking-wide">{debtorCount} qarzdor</span>
              </button>
            )}

            {/* Language & Theme & Profile */}
            <div className="flex items-center gap-1.5 pl-2 lg:pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="relative hidden sm:block">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={lang}
                  onChange={e => setLang(e.target.value as 'uz' | 'ru' | 'en')}
                  className="pl-8 pr-6 py-2 bg-transparent border-none text-[12px] font-semibold text-slate-600 dark:text-slate-300 outline-none hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all cursor-pointer appearance-none"
                >
                  <option value="uz">UZ</option>
                  <option value="ru">RU</option>
                  <option value="en">EN</option>
                </select>
              </div>

              <button
                onClick={toggleDarkMode}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              
              <div className="flex items-center gap-3 ml-2 group cursor-pointer" onClick={onLogout} title="Chiqish">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold text-white shadow-md ring-2 ring-transparent group-hover:ring-brand/30 transition-all" style={{ background: BRAND }}>
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div className="hidden lg:block">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white leading-none">{user?.name || 'Admin'}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">{user?.role === 'SUPERADMIN' ? 'Super Admin' : 'Administrator'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Sub-header) - DentaCRM style */}
        <div className="hidden lg:flex items-center gap-1 px-4 xl:px-8 h-[52px] bg-slate-50 dark:bg-[#121826]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-4 h-full text-[13px] font-semibold transition-all
                  ${isActive 
                    ? 'text-brand dark:text-white' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  } rounded-t-xl`}
              >
                <Icon size={16} className={isActive ? 'text-brand dark:text-[#48b4f0]' : ''} />
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-brand dark:bg-[#48b4f0]" />
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 xl:px-8 py-6">
        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-5 py-4">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-[14px] font-bold text-red-800 dark:text-red-200">Ma'lumotlarni yuklashda xatolik</p>
              <p className="text-[12px] font-medium text-red-600/80 dark:text-red-300/80 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => retryLoad()}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold transition-colors">
              Qayta urinish
            </button>
          </div>
        )}
        {children}
      </main>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-4 duration-300 pointer-events-none">
          <div className={`
            flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md text-[13px] font-semibold
            ${notification.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-800/50 dark:text-emerald-200' :
              notification.type === 'error' ? 'bg-rose-50/95 border-rose-200 text-rose-800 dark:bg-rose-950/90 dark:border-rose-800/50 dark:text-rose-200' :
              'bg-slate-900/95 border-slate-700 text-white'}
          `}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 
              ${notification.type === 'success' ? 'bg-emerald-500 text-white' : 
                notification.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-white'}`}>
              {notification.type === 'success' ? <CheckCircle2 size={14} /> :
               notification.type === 'error' ? <AlertCircle size={14} /> : <Info size={14} />}
            </div>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-[#121826] shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <span className="text-[15px] font-bold text-slate-900 dark:text-white">Menyu</span>
              <button aria-label="Menyuni yopish" onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all
                      ${isActive
                        ? 'bg-brand/10 dark:bg-brand/20 text-brand dark:text-[#48b4f0]'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a2232]'
                      }
                    `}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
              <button
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[14px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
              >
                <LogOut size={18} />
                Tizimdan chiqish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
