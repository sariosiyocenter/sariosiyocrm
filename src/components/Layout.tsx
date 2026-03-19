import React, { useState } from 'react';
import { 
  Users, GraduationCap, Target, Settings, 
  LayoutDashboard, Wallet, Search, Bell, Sun, Moon, LogOut, X, ChevronRight, User, MapPin, 
  CheckCircle2, AlertCircle, Info, Menu, BarChart3
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

export default function Layout({ children, onLogout }: LayoutProps) {
  const { user, schools, selectedSchoolId, setSelectedSchoolId, students, leads, groups, teachers, darkMode, toggleDarkMode, notification } = useCRM();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Lidlar', icon: Target, path: '/leads' },
    { label: 'Ustozlar', icon: GraduationCap, path: '/teachers' },
    { label: 'Guruhlar', icon: Users, path: '/groups' },
    { label: "O'quvchilar", icon: User, path: '/students' },
    { label: 'Moliya', icon: Wallet, path: '/finance' },
    { label: 'Hisobotlar', icon: BarChart3, path: '/reports' },
    { label: 'Sozlamalar', icon: Settings, path: '/settings' },
  ];

  const currentPath = location.pathname;

  const getSearchResults = () => {
    if (searchQuery.trim().length < 2) return null;
    const lowerQ = searchQuery.toLowerCase();
    
    const safeToggle = (val: string | undefined | null) => (val || '').toLowerCase();
    
    return {
      students: (students || []).filter(s => safeToggle(s.name).includes(lowerQ) || safeToggle(s.phone).includes(lowerQ)).slice(0, 3),
      leads: (leads || []).filter(l => safeToggle(l.name).includes(lowerQ) || safeToggle(l.phone).includes(lowerQ)).slice(0, 3),
      groups: (groups || []).filter(g => safeToggle(g.name).includes(lowerQ) || safeToggle(g.courseName).includes(lowerQ)).slice(0, 3),
      teachers: (teachers || []).filter(t => safeToggle(t.name).includes(lowerQ) || safeToggle(t.phone).includes(lowerQ)).slice(0, 3),
    };
  };

  const results = getSearchResults();
  
  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-[#F0F1F3] dark:bg-gray-900 transition-colors duration-200 flex flex-col">
      {/* ==================== HEADER ==================== */}
      <header className="sticky top-0 z-50 shadow-sm border-b border-gray-100 dark:border-gray-800">
        {/* LAYER 1 — Top Bar */}
        <div className="h-[64px] bg-white dark:bg-gray-800 flex items-center justify-between px-4 lg:px-8 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <div className="flex items-center gap-6">
            <button 
              className="lg:hidden w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/30 group-hover:scale-105 transition-transform">
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight leading-none">Sariosiyo</span>
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mt-1">CRM System</span>
              </div>
            </Link>

            {/* Branch Selector */}
            <div className="hidden lg:flex items-center ml-4 pl-6 border-l border-gray-100 dark:border-gray-700">
              <div className="relative group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-500" />
                <select 
                  value={selectedSchoolId || ''} 
                  onChange={(e) => setSelectedSchoolId(Number(e.target.value))}
                  className="pl-11 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest text-gray-900 dark:text-white outline-none focus:ring-4 focus:ring-sky-500/10 transition-all cursor-pointer appearance-none min-w-[180px]"
                >
                  <option value="" disabled>Filialni tanlang</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
                <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 group-hover:text-sky-500 transition-colors pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-xl mx-8 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Qidirish..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl pl-12 pr-6 py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-gray-900 dark:text-white placeholder:text-gray-400/60 outline-none transition-all shadow-inner"
            />
            {results && (
              <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto animate-in slide-in-from-top-4 duration-300 ring-4 ring-black/5">
                {Object.values(results).every(arr => arr.length === 0) ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                    <Search className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-4" />
                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hech narsa topilmadi</p>
                  </div>
                ) : (
                  <div className="py-8 divide-y divide-gray-50 dark:divide-gray-700/50">
                     {results.students.length > 0 && (
                       <div className="px-8 py-5">
                         <div className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-2">O'quvchilar</div>
                         {results.students.map(s => (
                           <div key={s.id} onClick={() => handleResultClick(`/students/${s.id}`)} className="flex items-center gap-4 p-4 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-[1.5rem] cursor-pointer transition-all group">
                             <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-inner group-hover:scale-110 duration-300">{s.name.charAt(0)}</div>
                             <div>
                               <p className="text-sm font-extrabold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 uppercase tracking-tight">{s.name}</p>
                               <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-0.5">{s.phone}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}
                     {results.leads.length > 0 && (
                       <div className="px-8 py-5 border-t border-gray-50 dark:border-gray-700/50">
                         <div className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-2">Lidlar</div>
                         {results.leads.map(l => (
                           <div key={l.id} onClick={() => handleResultClick('/leads')} className="flex items-center gap-4 p-4 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-[1.5rem] cursor-pointer transition-all group">
                             <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-inner group-hover:scale-110 duration-300"><Target size={18}/></div>
                             <div>
                               <p className="text-sm font-extrabold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 uppercase tracking-tight">{l.name}</p>
                               <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-0.5">{l.course} • {l.phone}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}

                     {results.groups.length > 0 && (
                       <div className="px-8 py-5 border-t border-gray-50 dark:border-gray-700/50">
                         <div className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-2">Guruhlar</div>
                         {results.groups.map(g => (
                           <div key={g.id} onClick={() => handleResultClick(`/groups/${g.id}`)} className="flex items-center gap-4 p-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-[1.5rem] cursor-pointer transition-all group">
                             <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-inner group-hover:scale-110 duration-300"><Users size={18}/></div>
                             <div>
                               <p className="text-sm font-extrabold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 uppercase tracking-tight">{g.name}</p>
                               <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-0.5">{g.courseName}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}

                     {results.teachers.length > 0 && (
                       <div className="px-8 py-5 border-t border-gray-50 dark:border-gray-700/50">
                         <div className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-2">Ustozlar</div>
                         {results.teachers.map(t => (
                           <div key={t.id} onClick={() => handleResultClick(`/teachers/${t.id}`)} className="flex items-center gap-4 p-4 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-[1.5rem] cursor-pointer transition-all group">
                             <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-inner group-hover:scale-110 duration-300"><GraduationCap size={18}/></div>
                             <div>
                               <p className="text-sm font-extrabold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 uppercase tracking-tight">{t.name}</p>
                               <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-0.5">{t.phone}</p>
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

          <div className="flex items-center gap-4">
            <button onClick={toggleDarkMode} className="w-12 h-12 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold shadow-inner">
                {user?.name?.charAt(0) || 'A'}
            </div>
            <button onClick={onLogout} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* LAYER 2 — Navigation */}
        <div className="h-[64px] bg-white dark:bg-gray-800 flex items-center px-4 lg:px-8 gap-2 overflow-x-auto no-scrollbar transition-colors duration-200">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[11px] font-extrabold uppercase tracking-widest transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-sky-600 text-white shadow-xl shadow-sky-500/30' 
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-10">
        {children}
      </main>

      {/* Premium Toast Notification */}
      {notification && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-8 duration-500 pointer-events-none">
          <div className={`
            flex items-center gap-5 px-10 py-6 rounded-[2.5rem] shadow-2xl backdrop-blur-xl border
            ${notification.type === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-emerald-500/20' : 
              notification.type === 'error' ? 'bg-rose-600/90 border-rose-400 text-white shadow-rose-500/20' : 
              'bg-gray-900/90 border-gray-700 text-white shadow-black/20'}
          `}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              {notification.type === 'success' ? <CheckCircle2 size={24} /> : 
               notification.type === 'error' ? <AlertCircle size={24} /> : <Info size={24} />}
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[320px] bg-white dark:bg-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
             <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Menyu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">
                  <X size={24} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {navItems.map((item) => {
                   const isActive = location.pathname === item.path;
                   const Icon = item.icon;
                   return (
                     <button
                       key={item.path}
                       onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                       className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all
                         ${isActive 
                           ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30' 
                           : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                         }
                       `}
                     >
                       <Icon size={20} />
                       {item.label}
                     </button>
                   );
                })}
             </div>
             <div className="p-8 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                  <LogOut size={20} />
                  Tizimdan chiqish
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
