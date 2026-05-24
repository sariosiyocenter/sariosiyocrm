import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { Organization } from '../types';
import {
  Building2, Users, GraduationCap, Wallet, Plus, Trash2,
  MapPin, Phone, ChevronRight, X
} from 'lucide-react';

export default function SuperAdmin() {
  const { user, token, showNotification } = useCRM();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [fetching, setFetching] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgPhone, setOrgPhone] = useState('');

  const fetchOrgs = async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/organizations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setOrgs(await res.json());
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchOrgs(); }, []);

  if (user?.role !== 'SUPERADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-red-500 font-extrabold text-lg uppercase tracking-widest">Ruxsat etilmagan</div>
        <p className="text-gray-500 text-sm mt-2">Bu sahifaga faqat Super Admin kira oladi.</p>
      </div>
    );
  }

  const totalOrgs     = orgs.length;
  const totalStudents = orgs.reduce((a, o) => a + (o.studentCount || 0), 0);
  const totalTeachers = orgs.reduce((a, o) => a + (o.teacherCount || 0), 0);
  const totalRevenue  = orgs.reduce((a, o) => a + (o.revenue || 0), 0);

  const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orgName) return;
    try {
      setLoading(true);
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: orgName, address: orgAddress, phone: orgPhone })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik');
      showNotification('Yangi tashkilot muvaffaqiyatli yaratildi!', 'success');
      setOrgName(''); setOrgAddress(''); setOrgPhone('');
      setModalOpen(false);
      fetchOrgs();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`"${name}" tashkilotini va unga tegishli BARCHA filiallar, o'quvchilar va ma'lumotlarni o'chirib tashlamoqchimisiz?`)) return;
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Xatolik');
      showNotification("Tashkilot o'chirildi", 'success');
      fetchOrgs();
    } catch {
      showNotification("O'chirishda xatolik yuz berdi", 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Super Admin Boshqaruvi</h1>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Platformadagi barcha tashkilotlarni nazorat qilish</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all hover:scale-105"
        >
          <Plus size={15} />
          Yangi Tashkilot
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Tashkilotlar', value: totalOrgs, icon: Building2, color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' },
          { label: "O'quvchilar", value: totalStudents, icon: Users, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
          { label: "O'qituvchilar", value: totalTeachers, icon: GraduationCap, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
          { label: 'Umumiy Tushum', value: totalRevenue.toLocaleString() + " so'm", icon: Wallet, color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col justify-between h-[130px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{s.label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <span className="text-xl font-black text-gray-900 dark:text-white">{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* Organizations List */}
      <div>
        <h2 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-4">
          Tashkilotlar ro'yxati ({totalOrgs})
        </h2>

        {fetching ? (
          <div className="py-20 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-[#1b6b6b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-16 text-center">
            <Building2 size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 font-bold text-sm">Hozircha tashkilot yaratilmagan</p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#1b6b6b] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl"
            >
              <Plus size={13} /> Birinchi tashkilotni yarating
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {orgs.map(org => (
              <div
                key={org.id}
                onClick={() => navigate(`/org/${org.id}`)}
                className="group bg-white dark:bg-gray-800 rounded-[1.75rem] border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md hover:border-[#1b6b6b]/30 transition-all cursor-pointer"
              >
                {/* Org Card Header */}
                <div className="p-6 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1b6b6b] flex items-center justify-center shrink-0 shadow-md shadow-[#1b6b6b]/20">
                      <Building2 size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[9px] font-extrabold text-[#1b6b6b] uppercase tracking-widest mb-0.5">Tashkilot #{org.id}</div>
                      <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-base leading-tight">{org.name}</h3>
                      {org.address && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 font-bold">
                          <MapPin size={11} className="text-[#1b6b6b]" />
                          {org.address}
                        </div>
                      )}
                      {org.phone && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 font-bold">
                          <Phone size={11} className="text-gray-400" />
                          {org.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(org.id, org.name); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-[#1b6b6b] transition-colors" />
                  </div>
                </div>

                {/* Org Stats */}
                <div className="px-6 pb-6 grid grid-cols-4 gap-2">
                  {[
                    { label: 'Filial', value: org.schoolCount || 0, color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' },
                    { label: "O'quvchi", value: org.studentCount || 0, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
                    { label: 'Ustoz', value: org.teacherCount || 0, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
                    { label: 'Xodim', value: org.userCount || 0, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
                  ].map((s, i) => (
                    <div key={i} className={`rounded-xl px-3 py-2 text-center ${s.color}`}>
                      <div className="text-[9px] font-extrabold uppercase tracking-wider opacity-70">{s.label}</div>
                      <div className="text-sm font-black mt-0.5">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Org Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Tashkilot</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">O'quv markaz yoki tashkilot</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Tashkilot Nomi *</label>
                <input
                  type="text" required
                  placeholder="Masalan: Sariosiyo O'quv Markazi"
                  value={orgName} onChange={e => setOrgName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Manzil</label>
                <input
                  type="text"
                  placeholder="Masalan: Toshkent sh., Chilonzor"
                  value={orgAddress} onChange={e => setOrgAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Telefon</label>
                <input
                  type="text"
                  placeholder="+998 90 123 45 67"
                  value={orgPhone} onChange={e => setOrgPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all">
                  Bekor
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all disabled:opacity-50">
                  {loading ? 'Yaratilmoqda...' : 'Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
