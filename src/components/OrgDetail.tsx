import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
  Building2, GitBranch, Users, GraduationCap, Wallet,
  MapPin, Phone, ArrowLeft, Plus, Trash2, User, X, Key
} from 'lucide-react';

interface Branch {
  id: number;
  name: string;
  address?: string;
  organizationId?: number;
  studentCount: number;
  teacherCount: number;
  revenue: number;
  userCount: number;
}

interface OrgData {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  createdAt: string;
  schools: Branch[];
}

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token, showNotification } = useCRM();

  const [org, setOrg] = useState<OrgData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Branch form
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  const fetchOrg = async () => {
    try {
      setFetching(true);
      const res = await fetch(`/api/organizations/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOrg(await res.json());
      } else {
        showNotification('Tashkilot topilmadi', 'error');
        navigate('/');
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchOrg(); }, [id]);

  if (user?.role !== 'SUPERADMIN') return null;

  const totalStudents = org?.schools.reduce((a, s) => a + (s.studentCount || 0), 0) || 0;
  const totalTeachers = org?.schools.reduce((a, s) => a + (s.teacherCount || 0), 0) || 0;
  const totalRevenue  = org?.schools.reduce((a, s) => a + (s.revenue || 0), 0) || 0;
  const totalUsers    = org?.schools.reduce((a, s) => a + (s.userCount || 0), 0) || 0;

  const handleCreateBranch = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!branchName) return;
    try {
      setLoading(true);

      // 1. Filial yaratish
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: branchName, address: branchAddress, organizationId: id })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Filialni yaratishda xatolik');
      const newSchool = await res.json();

      // 2. Admin user yaratish (ixtiyoriy)
      if (adminEmail && adminPassword && adminName) {
        const userRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            name: adminName, email: adminEmail,
            password: adminPassword, phone: adminPhone,
            role: 'ADMIN', schoolId: newSchool.id
          })
        });
        if (!userRes.ok) {
          const err = await userRes.json();
          throw new Error(err.error || 'Admin yaratishda xatolik');
        }
      }

      showNotification('Yangi filial muvaffaqiyatli yaratildi!', 'success');
      setBranchName(''); setBranchAddress('');
      setAdminName(''); setAdminEmail('');
      setAdminPassword(''); setAdminPhone('');
      setModalOpen(false);
      fetchOrg();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (schoolId: number, name: string) => {
    if (!window.confirm(`"${name}" filialini va unga tegishli barcha ma'lumotlarni o'chirib tashlamoqchimisiz?`)) return;
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("O'chirishda xatolik");
      showNotification("Filial o'chirildi", 'success');
      fetchOrg();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  if (fetching) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-[#1b6b6b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-extrabold text-gray-400 hover:text-[#1b6b6b] uppercase tracking-widest transition-colors mb-5"
        >
          <ArrowLeft size={14} />
          Tashkilotlarga qaytish
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Org Info */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#1b6b6b] flex items-center justify-center shrink-0 shadow-lg shadow-[#1b6b6b]/20">
                <Building2 size={28} className="text-white" />
              </div>
              <div>
                <div className="text-[9px] font-extrabold text-[#1b6b6b] uppercase tracking-widest mb-1">Tashkilot #{org.id}</div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{org.name}</h1>
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {org.address && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-bold">
                      <MapPin size={11} className="text-[#1b6b6b]" /> {org.address}
                    </div>
                  )}
                  {org.phone && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-bold">
                      <Phone size={11} /> {org.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Aggregate Stats */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Filiallar', value: org.schools.length, color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' },
                { label: "O'quvchilar", value: totalStudents, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
                { label: 'Ustozlar', value: totalTeachers, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
                { label: 'Xodimlar', value: totalUsers, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
                { label: 'Kassa', value: totalRevenue.toLocaleString() + " so'm", color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
              ].map((s, i) => (
                <div key={i} className={`flex flex-col items-center px-4 py-2.5 rounded-xl ${s.color}`}>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-70">{s.label}</span>
                  <span className="text-sm font-black mt-0.5">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Branches Section */}
      <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={15} className="text-[#1b6b6b]" />
            <span className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-widest">
              Filiallar ({org.schools.length})
            </span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl shadow-md shadow-[#1b6b6b]/20 transition-all hover:scale-105"
          >
            <Plus size={13} />
            Yangi Filial
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                <th className="pl-8 pr-4 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">ID</th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Filial Nomi / Manzil</th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-center">O'quvchilar</th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-center">Ustozlar</th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-center">Xodimlar</th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-center">Kassa</th>
                <th className="px-4 pr-8 py-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {org.schools.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-700/10 transition-colors">
                  <td className="pl-8 pr-4 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-l-2 border-b-2 border-gray-200 dark:border-gray-600 rounded-bl-sm shrink-0" />
                      <span className="text-xs font-extrabold text-gray-400">#{branch.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="font-extrabold text-gray-900 dark:text-white uppercase tracking-tight text-sm">{branch.name}</div>
                    {branch.address && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 font-bold">
                        <MapPin size={11} className="text-[#1b6b6b]" />
                        {branch.address}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-5 text-center">
                    <span className="inline-flex px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                      {branch.studentCount} ta
                    </span>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <span className="inline-flex px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-extrabold text-xs">
                      {branch.teacherCount} ta
                    </span>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <span className="inline-flex px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
                      {branch.userCount} ta
                    </span>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className="font-extrabold text-gray-900 dark:text-white text-sm">{(branch.revenue || 0).toLocaleString()} so'm</div>
                  </td>
                  <td className="px-4 pr-8 py-5 text-right">
                    <button
                      onClick={() => handleDeleteBranch(branch.id, branch.name)}
                      className="w-9 h-9 inline-flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {org.schools.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-14 text-center">
                    <GitBranch size={32} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                    <p className="text-gray-400 font-bold text-sm">Hozircha filial qo'shilmagan</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Branch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Filial Qo'shish</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{org.name} tashkilotiga</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-5">
              {/* Filial ma'lumotlari */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-widest flex items-center gap-2">
                  <GitBranch size={13} /> Filial Ma'lumotlari
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Filial Nomi *</label>
                    <input type="text" required placeholder="Masalan: Chilonzor Filliali"
                      value={branchName} onChange={e => setBranchName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Manzil</label>
                    <input type="text" placeholder="Masalan: Chilonzor 9-daha"
                      value={branchAddress} onChange={e => setBranchAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Admin ma'lumotlari */}
              <div className="space-y-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                <h4 className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-widest flex items-center gap-2">
                  <User size={13} /> Filial Administratori <span className="text-gray-400 font-normal normal-case tracking-normal">(ixtiyoriy)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Admin Ismi</label>
                    <input type="text" placeholder="Sardor Rahimov"
                      value={adminName} onChange={e => setAdminName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Telefon</label>
                    <input type="text" placeholder="+998 90 123 45 67"
                      value={adminPhone} onChange={e => setAdminPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Email</label>
                    <input type="email" placeholder="admin@filial.com"
                      value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Parol</label>
                    <input type="password" placeholder="••••••••"
                      value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all">
                  Bekor
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all disabled:opacity-50">
                  {loading ? 'Yaratilmoqda...' : 'Filial Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
