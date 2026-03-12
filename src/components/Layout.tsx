import React from 'react';
import { Search, Bell, User, Home, ClipboardList, Presentation, Layers, Users, Settings, Activity, FileText, ChevronDown, ChevronRight, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

export default function Layout({ children, onLogout }: LayoutProps) {
  const { settings, user, schools, selectedSchoolId, setSelectedSchoolId } = useCRM();
  const location = useLocation();
  const navigate = useNavigate();
  const [isBranchOpen, setIsBranchOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  const currentSchool = schools.find(s => s.id === selectedSchoolId) || schools[0];
  const branchLabel = currentSchool ? currentSchool.name : `${settings.orgName} Filliali`;

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col font-sans text-slate-800">
      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold overflow-hidden">
              <img src={settings.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${settings.orgName}&backgroundColor=000000`} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <span className="font-bold text-xl tracking-wide text-slate-800 uppercase">{settings.orgName}</span>
          </div>
        </div>

        <div className="flex-1 max-w-3xl mx-8">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Qidirish..."
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
            <Search className="absolute right-3 text-slate-400 w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="bg-[#5C67F2] hover:bg-indigo-600 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm">
            TO'LOV
          </button>
          <div className="relative">
            <div
              className={`flex items-center gap-2 p-2 rounded-md transition-colors ${user?.role === 'ADMIN' ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              onClick={() => user?.role === 'ADMIN' && setIsBranchOpen(!isBranchOpen)}
            >
              <span className="text-sm font-medium text-slate-600">{branchLabel}</span>
              {user?.role === 'ADMIN' && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isBranchOpen ? 'rotate-180' : ''}`} />}
            </div>

            {isBranchOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1">
                {schools.map(school => (
                  <button
                    key={school.id}
                    onClick={() => {
                      setSelectedSchoolId(school.id);
                      setIsBranchOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors capitalize ${selectedSchoolId === school.id ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                  >
                    {school.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full relative transition-colors">
            <Bell className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-9 h-9 bg-slate-100 text-slate-400 hover:bg-slate-200 rounded-full flex items-center justify-center relative transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white rounded-full">!</span>
            </button>

            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 transform origin-top-right">
                <div className="px-4 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{user?.role || 'Foydalanuvchi'}</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{user?.name || user?.email}</p>
                  <p className="text-[10px] text-slate-400 truncate opacity-70">{user?.email}</p>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#5C67F2] rounded-xl transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Sozlamalar
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  Chiqish
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2 overflow-x-auto shadow-sm relative z-10">
        <NavItem icon={<Home className="w-[18px] h-[18px]" />} label="Bosh sahifa" path="/" currentPath={location.pathname} />
        <NavItem icon={<ClipboardList className="w-[18px] h-[18px]" />} label="Lidlar" path="/leads" currentPath={location.pathname} />
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <NavItem icon={<Presentation className="w-[18px] h-[18px]" />} label="O'qituvchilar" path="/teachers" currentPath={location.pathname} />
        )}
        <NavItem icon={<Layers className="w-[18px] h-[18px]" />} label="Guruhlar" path="/groups" currentPath={location.pathname} />
        <NavItem icon={<Users className="w-[18px] h-[18px]" />} label="O'quvchilar" path="/students" currentPath={location.pathname} />
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <NavItem icon={<Settings className="w-[18px] h-[18px]" />} label="Sozlamalar" hasDropdown path="/settings" currentPath={location.pathname} />
        )}
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <NavItem icon={<Activity className="w-[18px] h-[18px]" />} label="Moliya" path="/finance" currentPath={location.pathname} />
        )}
        {user?.role === 'ADMIN' && (
          <NavItem icon={<FileText className="w-[18px] h-[18px]" />} label="Hisobotlar" hasDropdown path="/reports" currentPath={location.pathname} />
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function NavItem({ icon, label, path, currentPath, hasDropdown }: { icon: React.ReactNode, label: string, path: string, currentPath: string, hasDropdown?: boolean }) {
  const navigate = useNavigate();
  const { user } = useCRM();
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));

  return (
    <div className="relative group">
      <button
        onClick={() => navigate(path)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-all whitespace-nowrap ${isActive
          ? 'bg-[#5C67F2] text-white shadow-lg shadow-indigo-200/50'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
      >
        {icon}
        <span>{label}</span>
        {hasDropdown && <ChevronDown className={`w-4 h-4 ml-1 transition-transform group-hover:rotate-180 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />}
      </button>

      {hasDropdown && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 transform origin-top scale-95 group-hover:scale-100 duration-200 text-slate-800">
          {label === "Sozlamalar" ? (
            <div className="flex flex-col">
              <DropdownItem label="SMS Sozlamalari" onClick={() => navigate('/settings')} />
              <DropdownItem label="Chek Sozlamalari" onClick={() => navigate('/settings')} />
              <DropdownItem label="Ofis" hasSub onClick={() => navigate('/settings')} />
              {user?.role === 'ADMIN' && <DropdownItem label="CEO" hasSub onClick={() => navigate('/settings')} />}
            </div>
          ) : (
            <div className="flex flex-col">
              <DropdownItem label="To'lovlar hisoboti" onClick={() => navigate('/reports')} />
              <DropdownItem label="O'quvchilar to'lovi" onClick={() => navigate('/reports')} />
              <DropdownItem label="Ketgan o'quvchilar hisoboti" onClick={() => navigate('/reports')} />
              <DropdownItem label="Xodimlar Davomati Hisoboti" onClick={() => navigate('/reports')} />
              <DropdownItem label="O'quvchilar Bonuslari" onClick={() => navigate('/reports')} />
              <DropdownItem label="Lidlar Hisoboti" onClick={() => navigate('/reports')} />
              <DropdownItem label="O'quvchilar Hisoboti" onClick={() => navigate('/reports')} />
              <DropdownItem label="Bitiruvchilar" onClick={() => navigate('/reports')} />
              <DropdownItem label="Markaz Faoliyati Statistikasi" onClick={() => navigate('/reports')} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ label, hasSub, onClick }: { label: string, hasSub?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex items-center justify-between px-4 py-3 rounded-xl text-[14px] font-medium text-slate-500 hover:bg-slate-50 hover:text-[#5C67F2] transition-all text-left group/item"
    >
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/item:bg-[#5C67F2]"></div>
        <span>{label}</span>
      </div>
      {hasSub && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}
