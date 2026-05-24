import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Building2, Plus, Trash2,
  MapPin, User, ChevronDown, ChevronRight, GitBranch, X
} from 'lucide-react';

export default function SuperAdmin() {
  const { schools, user, token, showNotification } = useCRM();
  const [modalOpen, setModalOpen] = useState(false);
  const [orgExpanded, setOrgExpanded] = useState(true);

  // Form states
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [loading, setLoading] = useState(false);

  if (user?.role !== 'SUPERADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-red-500 font-extrabold text-lg uppercase tracking-widest">Ruxsat etilmagan</div>
        <p className="text-gray-500 text-sm mt-2">Bu sahifaga faqat Super Admin kira oladi.</p>
      </div>
    );
  }

  const totalStudents = schools.reduce((acc, s: any) => acc + (s.studentCount || 0), 0);
  const totalTeachers = schools.reduce((acc, s: any) => acc + (s.teacherCount || 0), 0);
  const totalUsers = schools.reduce((acc, s: any) => acc + (s.userCount || 0), 0);
  const totalRevenue = schools.reduce((acc, s: any) => acc + (s.revenue || 0), 0);

  const handleCreateBranch = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!schoolName) return;

    try {
      setLoading(true);
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: schoolName, address: schoolAddress })
      });
      if (!res.ok) throw new Error("Filialni yaratishda xatolik");
      const newSchool = await res.json();

      if (adminEmail && adminPassword && adminName) {
        const userRes = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            phone: adminPhone,
            role: 'ADMIN',
            schoolId: newSchool.id
          })
        });
        if (!userRes.ok) {
          const errData = await userRes.json();
          throw new Error(errData.error || "Admin foydalanuvchisini yaratishda xatolik");
        }
      }

      showNotification("Yangi filial va administrator muvaffaqiyatli yaratildi!", "success");
      setSchoolName(''); setSchoolAddress('');
      setAdminName(''); setAdminEmail('');
      setAdminPassword(''); setAdminPhone('');
      setModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (id: number, name: string) => {
    if (window.confirm(`"${name}" filialini va unga tegishli barcha ma'lumotlarni o'chirib tashlamoqchimisiz?`)) {
      try {
        const res = await fetch(`/api/schools/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Filialni o'chirishda xatolik");
        showNotification("Filial muvaffaqiyatli o'chirildi", "success");
        window.location.reload();
      } catch (err: any) {
        showNotification(err.message, "error");
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Super Admin Boshqaruvi</h1>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">O'quv markaz va filiallarini nazorat qilish</p>
        </div>
      </div>

      {/* O'quv Markaz Card */}
      <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">

        {/* Org Header */}
        <div className="p-6 md:p-8 bg-gradient-to-r from-[#1b6b6b]/5 to-transparent border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#1b6b6b] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20 shrink-0">
                <Building2 size={24} className="text-white" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-widest mb-1">O'quv Markaz</div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Sariosiyo O'quv Markazi</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <GitBranch size={11} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-400">{schools.length} ta filial</span>
                </div>
              </div>
            </div>

            {/* Aggregate Stats */}
            <div className="flex flex-wrap gap-3">
              {[
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

        {/* Filiallar Section Header */}
        <div className="px-8 py-4 border-b border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
          <button
            onClick={() => setOrgExpanded(!orgExpanded)}
            className="flex items-center gap-2 text-xs font-extrabold text-gray-600 dark:text-gray-300 uppercase tracking-widest hover:text-[#1b6b6b] transition-colors"
          >
            {orgExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Filiallar Ro'yxati ({schools.length})
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl shadow-md shadow-[#1b6b6b]/20 transition-all hover:scale-105"
          >
            <Plus size={13} />
            Yangi Filial
          </button>
        </div>

        {/* Filiallar Table */}
        {orgExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                  <th className="pl-12 pr-4 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ID</th>
                  <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Filial Nomi / Manzil</th>
                  <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">O'quvchilar</th>
                  <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Ustozlar</th>
                  <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Xodimlar</th>
                  <th className="px-4 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Kassa</th>
                  <th className="px-4 pr-8 py-4 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {schools.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-700/10 transition-colors">
                    {/* Tree line indicator */}
                    <td className="pl-8 pr-4 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-l-2 border-b-2 border-gray-200 dark:border-gray-600 rounded-bl-sm shrink-0" />
                        <span className="text-xs font-extrabold text-gray-400">#{s.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="font-extrabold text-gray-900 dark:text-white uppercase tracking-tight text-sm">{s.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1 font-bold">
                        <MapPin size={11} className="text-[#1b6b6b]" />
                        {s.address || 'Manzil kiritilmagan'}
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className="inline-flex px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                        {s.studentCount || 0} ta
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className="inline-flex px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-extrabold text-xs">
                        {s.teacherCount || 0} ta
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className="inline-flex px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
                        {s.userCount || 0} ta
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="font-extrabold text-gray-900 dark:text-white text-sm">{(s.revenue || 0).toLocaleString()} so'm</div>
                    </td>
                    <td className="px-4 pr-8 py-5 text-right">
                      <button
                        onClick={() => handleDeleteBranch(s.id, s.name)}
                        className="w-9 h-9 inline-flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-8 py-14 text-center text-gray-400 dark:text-gray-500 text-sm">
                      Hozircha hech qanday filial yaratilmagan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Branch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 animate-in zoom-in duration-300">

            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Filial Qo'shish</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Sariosiyo O'quv Markaziga yangi filial</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-6">

              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-[#1b6b6b] uppercase tracking-widest flex items-center gap-2">
                  <GitBranch size={14} />
                  Filial Ma'lumotlari
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Filial Nomi *</label>
                    <input
                      type="text"
                      required
                      placeholder="Masalan: Chilonzor Filliali"
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Manzil</label>
                    <input
                      type="text"
                      placeholder="Masalan: Chilonzor 9-daha"
                      value={schoolAddress}
                      onChange={e => setSchoolAddress(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                <h4 className="text-xs font-extrabold text-[#1b6b6b] uppercase tracking-widest flex items-center gap-2">
                  <User size={14} />
                  Filial Administratori
                </h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Ushbu filialga biriktiriluvchi bosh admin.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Ismi *</label>
                    <input
                      type="text"
                      required
                      placeholder="Masalan: Sardor Rahimov"
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Telefon Raqam</label>
                    <input
                      type="text"
                      placeholder="+998 90 123 45 67"
                      value={adminPhone}
                      onChange={e => setAdminPhone(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@filial.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Parol *</label>
                    <input
                      type="password"
                      required
                      placeholder="Parol kiritish"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-50 dark:border-gray-700/50">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all"
                >
                  Bekor Qilish
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all hover:scale-105 disabled:opacity-50"
                >
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
