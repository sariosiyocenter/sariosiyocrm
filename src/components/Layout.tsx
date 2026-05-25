import React, { useState } from 'react';
import {
  Users, GraduationCap, Target, Settings,
  LayoutDashboard, Wallet, Search, Bell, Sun, Moon, LogOut, X,
  ChevronDown, CheckCircle2, AlertCircle, Info, Menu,
  BarChart3, Navigation, MessageSquare, FileText, BookOpen, ScanLine, Shield,
  MapPin, User
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
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const baseItems = [
    { label: 'Dashboard',     icon: LayoutDashboard, path: '/' },
    { label: 'Lidlar',        icon: Target,           path: '/leads' },
    { label: 'Ustozlar',      icon: GraduationCap,    path: '/teachers' },
    { label: 'Guruhlar',      icon: Users,            path: '/groups' },
    { label: "O'quvchilar",   icon: User,             path: '/students' },
    { label: 'Moliya',        icon: Wallet,           path: '/finance' },
    { label: 'Logistika',     icon: Navigation,       path: '/logistics' },
    { label: 'Imtihonlar',    icon: FileText,         path: '/exams' },
    { label: 'Savollar banki',icon: BookOpen,         path: '/questions' },
    { label: 'Hisobotlar',    icon: BarChart3,        path: '/reports' },
    { label: 'SMS',           icon: MessageSquare,    path: '/sms-history' },
    { label: 'Sozlamalar',    icon: Settings,         path: '/settings' },
  ];

  const navItems = user?.role === 'SUPERADMIN'
    ? [{ label: 'Super Admin', icon: Shield, path: '/superadmin' }]
    : baseItems;

  const getSearchResults = () => {
    if (searchQuery.trim().length < 2) return null;
    const lowerQ = searchQuery.toLowerCase();
    const safe = (v?: string | null) => (v || '').toLowerCase();
    return {
      students: (students || []).filter(s => safe(s.name).includes(lowerQ) || safe(s.phone).includes(lowerQ)).slice(0, 3),
      leads:    (leads    || []).filter(l => safe(l.name).includes(lowerQ) || safe(l.phone).includes(lowerQ)).slice(0, 3),
      groups:   (groups   || []).filter(g => safe(g.name).includes(lowerQ)).slice(0, 3),
      teachers: (teachers || []).filter(t => safe(t.name).includes(lowerQ) || safe(t.phone).includes(lowerQ)).slice(0, 3),
    };
  };

  const results = getSearchResults();
  const handleResultClick = (path: string) => { navigate(path); setSearchQuery(''); };

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);
  const newLeadsCount  = (leads || []).filter(l => l.status === 'Yangi').length;

  // Date-time
  const now = new Date();
  const dateStr = now.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

  // Sidebar item
  const SidebarItem = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));
    const Icon = item.icon;
    const badge = item.path === '/leads' && newLeadsCount > 0 ? newLeadsCount : null;

    return (
      <button
        onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-150 group relative
          ${isActive
            ? 'bg-[#0ea5e9]/15 text-[#38bdf8] border border-[#0ea5e9]/20'
            : 'text-[#8b9ab2] hover:text-white hover:bg-white/5 border border-transparent'
          }`}
      >
        <Icon size={16} className={isActive ? 'text-[#38bdf8]' : 'text-[#6b7a95] group-hover:text-white transition-colors'} />
        <span className="flex-1 text-left leading-none">{item.label}</span>
        {badge && (
          <span className="bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xs">Q</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">
              Quantum<span className="text-[#38bdf8]">Edu</span>
            </div>
            <div className="text-[#4a5568] text-[9px] font-medium mt-0.5 uppercase tracking-widest">CRM · V2.6</div>
          </div>
        </Link>
      </div>

      {/* Branch Selector */}
      {user?.role !== 'SUPERADMIN' && (
        <div className="px-3 py-3 border-b border-white/5">
          <div className="text-[9px] font-bold text-[#4a5568] uppercase tracking-widest mb-1.5 px-1">Filial</div>
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8 transition-all text-left"
            >
              <MapPin size={12} className="text-[#38bdf8] shrink-0" />
              <span className="text-white text-[11px] font-medium truncate flex-1">
                {selectedSchool?.name || 'Filial tanlang'}
              </span>
              <ChevronDown size={12} className="text-[#4a5568] shrink-0" />
            </button>
            {showBranchDropdown && schools.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e2d3d] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                {schools.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSchoolId(s.id); setShowBranchDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors hover:bg-white/5
                      ${s.id === selectedSchoolId ? 'text-[#38bdf8] font-semibold' : 'text-[#8b9ab2]'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <div className="text-[9px] font-bold text-[#4a5568] uppercase tracking-widest mb-2 px-1">Menyu</div>
        {navItems.map(item => <SidebarItem key={item.path} item={item} />)}
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-all cursor-default">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-xs shrink-0">
            {user?.name?.substring(0, 2).toUpperCase() || 'AB'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[11px] font-semibold truncate">{user?.name || 'Admin'}</div>
            <div className="text-[#4a5568] text-[9px] truncate">{user?.email || 'admin@quantum.uz'}</div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-[#4a5568] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
            title="Chiqish"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex ${darkMode ? 'dark' : ''}`} style={{ backgroundColor: darkMode ? '#0d1117' : '#0f1923' }}>

      {/* ─── Desktop Sidebar ─── */}
      <aside
        className="hidden lg:flex flex-col w-[168px] shrink-0 fixed top-0 left-0 h-screen z-40"
        style={{ backgroundColor: '#141c27', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        <SidebarContent />
      </aside>

      {/* ─── Mobile Sidebar Overlay ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[200px] flex flex-col"
            style={{ backgroundColor: '#141c27', borderRight: '1px solid rgba(255,255,255,0.05)' }}
          >
            <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 text-[#4a5568] hover:text-white p-1 z-10">
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[168px]">

        {/* ─── Top Bar ─── */}
        <header
          className="sticky top-0 z-30 h-[56px] flex items-center px-4 lg:px-6 gap-4"
          style={{
            backgroundColor: '#141c27',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          {/* Mobile menu button */}
          <button
            className="lg:hidden text-[#8b9ab2] hover:text-white p-1"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Search */}
          {user?.role !== 'SUPERADMIN' && (
            <div className="flex-1 max-w-[480px] relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a5568]" />
              <input
                type="text"
                placeholder="O'quvchi, ustoz, guruh yoki kursni qidiring..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-14 py-2 rounded-xl text-[11px] text-white placeholder-[#4a5568] outline-none transition-all"
                style={{
                  backgroundColor: darkMode ? '#0d1117' : '#0f1923',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5568] text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded">⌘K</span>

              {/* Search Results */}
              {results && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
                  style={{ backgroundColor: '#1a2332', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {Object.values(results).every(a => a.length === 0) ? (
                    <div className="p-6 text-center text-[#4a5568] text-xs">Hech narsa topilmadi</div>
                  ) : (
                    <div className="py-2">
                      {results.students.length > 0 && (
                        <div>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-[#4a5568] uppercase tracking-widest">O'quvchilar</div>
                          {results.students.map(s => (
                            <button key={s.id} onClick={() => handleResultClick(`/students/${s.id}`)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors text-left">
                              <div className="w-7 h-7 rounded-lg bg-[#0ea5e9]/20 text-[#38bdf8] flex items-center justify-center text-[10px] font-bold">{s.name.charAt(0)}</div>
                              <div>
                                <p className="text-white text-[11px] font-medium">{s.name}</p>
                                <p className="text-[#4a5568] text-[9px]">{s.phone}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {results.teachers.length > 0 && (
                        <div>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-[#4a5568] uppercase tracking-widest border-t border-white/5 mt-1">Ustozlar</div>
                          {results.teachers.map(t => (
                            <button key={t.id} onClick={() => handleResultClick(`/teachers/${t.id}`)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors text-left">
                              <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-bold">{t.name.charAt(0)}</div>
                              <div>
                                <p className="text-white text-[11px] font-medium">{t.name}</p>
                                <p className="text-[#4a5568] text-[9px]">{t.phone}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {results.groups.length > 0 && (
                        <div>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-[#4a5568] uppercase tracking-widest border-t border-white/5 mt-1">Guruhlar</div>
                          {results.groups.map(g => (
                            <button key={g.id} onClick={() => handleResultClick(`/groups/${g.id}`)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors text-left">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">{g.name.charAt(0)}</div>
                              <div>
                                <p className="text-white text-[11px] font-medium">{g.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Date & Time */}
            <div className="hidden md:flex items-center gap-2 text-[11px] text-[#8b9ab2]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{dateStr} · {timeStr}</span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8b9ab2] hover:text-white hover:bg-white/8 transition-all"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notifications */}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8b9ab2] hover:text-white hover:bg-white/8 transition-all relative">
              <Bell size={16} />
              {newLeadsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <main
          className="flex-1 p-6"
          style={{ backgroundColor: darkMode ? '#0d1117' : '#0f1923' }}
        >
          {children}
        </main>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-6 duration-400 pointer-events-none">
          <div className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium
            ${notification.type === 'success'
              ? 'bg-emerald-600/90 border-emerald-400/30 text-white shadow-emerald-500/20'
              : notification.type === 'error'
              ? 'bg-rose-600/90 border-rose-400/30 text-white shadow-rose-500/20'
              : 'bg-[#1a2332] border-white/10 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={18} /> :
             notification.type === 'error'   ? <AlertCircle size={18} /> : <Info size={18} />}
            {notification.message}
          </div>
        </div>
      )}
    </div>
  );
}
