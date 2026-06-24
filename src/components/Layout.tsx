import React, { useState } from 'react';
import {
  Users, GraduationCap, Target, Settings,
  LayoutDashboard, Wallet, Search, Sun, Moon, LogOut, X, ChevronRight, User, MapPin,
  CheckCircle2, AlertCircle, Info, Menu, BarChart3, Navigation, FileText, Shield, Atom, Users2, Globe, BookOpen, MessageSquare
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

// Brand color token — easy to change globally
const BRAND = '#6366f1';         // indigo-500
const BRAND_HOVER = '#4f46e5';   // indigo-600
const BRAND_LIGHT = '#eef2ff';   // indigo-50
const BRAND_DARK_TEXT = '#a5b4fc'; // indigo-300 for dark mode text

export default function Layout({ children, onLogout }: LayoutProps) {
  const { user, schools, selectedSchoolId, setSelectedSchoolId, students, leads, groups, teachers, courses, darkMode, toggleDarkMode, notification, settings } = useCRM();
  const { lang, setLang, t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const baseItems = [
    { label: t('nav_dashboard'), icon: LayoutDashboard, path: '/' },
    { label: t('nav_leads'),     icon: Target,          path: '/leads' },
    { label: t('nav_groups'),    icon: Users,           path: '/courses' },
    { label: t('nav_students'),  icon: User,            path: '/students' },
    { label: t('nav_syllabus'),  icon: BookOpen,        path: '/syllabus' },
    { label: t('nav_finance'),   icon: Wallet,          path: '/finance' },
    { label: t('nav_logistics'), icon: Navigation,      path: '/logistics' },
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
  
  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f172a] transition-colors duration-200 flex flex-col">
      
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        
        {/* Top Bar */}
        <div className="h-[60px] flex items-center justify-between px-4 lg:px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/10 group-hover:scale-105 transition-transform duration-200 shrink-0">
                {settings?.logo
                  ? <img src={settings.logo} className="w-full h-full object-cover" alt="logo" />
                  : <Atom size={20} className="text-white animate-pulse" />
                }
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">{settings?.orgName || 'Quantum Edu'}</span>
                <span className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: BRAND }}>CRM System</span>
              </div>
            </Link>

            {/* Branch selector */}
            {user?.role !== 'SUPERADMIN' && user?.role !== 'SELLER' && (
              <div className="hidden lg:flex items-center ml-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedSchoolId === null ? '' : selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(Number(e.target.value))}
                    className="pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all cursor-pointer appearance-none min-w-[160px]"
                  >
                    <option value="" disabled>Filialni tanlang</option>
                    {user?.role === 'ADMIN' && (
                      <option value="0">To'liq o'quv markazi</option>
                    )}
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                  <ChevronRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          {user?.role !== 'SUPERADMIN' && user?.role !== 'SELLER' && (
            <div className="hidden md:flex items-center flex-1 max-w-md mx-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="O'quvchi, ustoz yoki kurs qidiring..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none transition-all"
              />
              {/* Search results dropdown */}
              {results && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[70vh] overflow-y-auto z-50">
                  {Object.values(results).every(arr => arr.length === 0) ? (
                    <div className="p-8 text-center">
                      <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Hech narsa topilmadi</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {results.students.length > 0 && (
                        <div className="p-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">O'quvchilar</p>
                          {results.students.map(s => (
                            <div key={s.id} onClick={() => handleResultClick(`/students/${s.id}`)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer transition-colors group">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0)}</div>
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">{s.name}</p>
                                <p className="text-xs text-slate-400">{s.phone}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {results.leads.length > 0 && (
                        <div className="p-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">Lidlar</p>
                          {results.leads.map(l => (
                            <div key={l.id} onClick={() => handleResultClick('/leads')} className="flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg cursor-pointer transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><Target size={16}/></div>
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">{l.name}</p>
                                <p className="text-xs text-slate-400">{l.course} • {l.phone}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {results.groups.length > 0 && (
                        <div className="p-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">{t('stat_groups')}</p>
                          {results.groups.map(g => (
                            <div key={g.id} onClick={() => handleResultClick(`/courses/${g.id}`)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg cursor-pointer transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><Users size={16}/></div>
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">{g.name}</p>
                                <p className="text-xs text-slate-400">
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
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">Ustozlar</p>
                          {results.teachers.map(t => (
                            <div key={t.id} onClick={() => handleResultClick(`/teachers/${t.id}`)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg cursor-pointer transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0"><GraduationCap size={16}/></div>
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">{t.name}</p>
                                <p className="text-xs text-slate-400">{t.phone}</p>
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

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Language switcher — dropdown like branch selector */}
            <div className="relative">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={lang}
                onChange={e => setLang(e.target.value as 'uz' | 'ru' | 'en')}
                className="pl-8 pr-6 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all cursor-pointer appearance-none uppercase tracking-widest"
              >
                <option value="uz">UZ</option>
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
              <ChevronRight size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
            </div>
            <button
              onClick={toggleDarkMode}
              className="w-9 h-9 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={darkMode ? 'Yorug\' rejim' : 'Qorong\'u rejim'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* User avatar */}
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: BRAND }}>
              {user?.name?.charAt(0) || 'A'}
            </div>
            <button
              onClick={onLogout}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title="Chiqish"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="h-[48px] bg-white dark:bg-slate-900 flex items-center px-4 lg:px-6 gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                  }
                `}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-6 py-4">
        {children}
      </main>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-4 duration-300 pointer-events-none">
          <div className={`
            flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-medium
            ${notification.type === 'success' ? 'bg-emerald-600/95 border-emerald-500 text-white' :
              notification.type === 'error' ? 'bg-rose-600/95 border-rose-500 text-white' :
              'bg-slate-900/95 border-slate-700 text-white'}
          `}>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              {notification.type === 'success' ? <CheckCircle2 size={16} /> :
               notification.type === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
            </div>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900 dark:text-white">Menyu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                      ${isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }
                    `}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
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
