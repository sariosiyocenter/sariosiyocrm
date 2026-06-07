import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { Organization } from '../types';
import {
  Building2, Users, GraduationCap, Wallet, Plus,
  MapPin, Phone, ChevronRight, X, ClipboardList, Users2,
  Settings, UserPlus, Calendar, Edit3, LayoutDashboard, Lock, Unlock, Trash2
} from 'lucide-react';

interface SaaSLead {
  id: number;
  name: string;
  phone: string;
  centerName: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  sellerId: number | null;
  seller?: { id: number; name: string; email: string };
}

interface Seller {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export default function SuperAdmin() {
  const { user, token, showNotification } = useCRM();
  const navigate = useNavigate();

  const isSuper = user?.role === 'SUPERADMIN';
  const isSeller = user?.role === 'SELLER';

  const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'leads' | 'sellers'>(isSuper ? 'overview' : 'leads');

  // --- Orgs State ---
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [fetchingOrgs, setFetchingOrgs] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [orgFilterStatus, setOrgFilterStatus] = useState<'ALL' | 'FAOL' | 'SINOV' | 'MUZLATILGAN'>('ALL');

  // --- Org Admin fields ---
  const [orgAdminName, setOrgAdminName] = useState('');
  const [orgAdminEmail, setOrgAdminEmail] = useState('');
  const [orgAdminPassword, setOrgAdminPassword] = useState('');
  const [orgMaxSchools, setOrgMaxSchools] = useState(3);


  // --- Subscription & Organization Edit Modal State ---
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [updatingSub, setUpdatingSub] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [subName, setSubName] = useState('');
  const [subAddress, setSubAddress] = useState('');
  const [subPhone, setSubPhone] = useState('');
  const [subStatus, setSubStatus] = useState('Sinov');
  const [subExpiresAt, setSubExpiresAt] = useState('');
  const [subMaxSchools, setSubMaxSchools] = useState(3);
  const [subAdminName, setSubAdminName] = useState('');
  const [subAdminEmail, setSubAdminEmail] = useState('');
  const [subAdminPhone, setSubAdminPhone] = useState('');
  const [subAdminPassword, setSubAdminPassword] = useState('');

  // --- Leads State ---
  const [leads, setLeads] = useState<SaaSLead[]>([]);
  const [fetchingLeads, setFetchingLeads] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SaaSLead | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadCenter, setLeadCenter] = useState('');
  const [leadStatus, setLeadStatus] = useState('Yangi');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadSellerId, setLeadSellerId] = useState<string>('');

  // --- Sellers State ---
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [fetchingSellers, setFetchingSellers] = useState(false);
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [creatingSeller, setCreatingSeller] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');

  // --- Search / Filters ---
  const [leadSearch, setLeadSearch] = useState('');
  const [leadFilterStatus, setLeadFilterStatus] = useState('all');

  // --- API Functions ---
  const fetchOrgs = async () => {
    if (!isSuper) return;
    try {
      setFetchingOrgs(true);
      const res = await fetch('/api/organizations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setOrgs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingOrgs(false);
    }
  };

  const fetchLeads = async () => {
    try {
      setFetchingLeads(true);
      const res = await fetch('/api/saas-leads', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLeads(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingLeads(false);
    }
  };

  const fetchSellers = async () => {
    if (!isSuper) return;
    try {
      setFetchingSellers(true);
      const res = await fetch('/api/sellers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSellers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingSellers(false);
    }
  };

  useEffect(() => {
    if (isSuper) {
      fetchOrgs();
      fetchSellers();
    }
    fetchLeads();
  }, [token]);

  // --- Action Handlers ---
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgAdminEmail || !orgAdminPassword) return;
    try {
      setCreatingOrg(true);
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: orgName,
          address: orgAddress,
          phone: orgPhone,
          adminName: orgAdminName,
          adminEmail: orgAdminEmail,
          adminPassword: orgAdminPassword,
          maxSchools: orgMaxSchools,
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik');
      showNotification('Yangi tashkilot va admin muvaffaqiyatli yaratildi!', 'success');
      setOrgName(''); setOrgAddress(''); setOrgPhone('');
      setOrgAdminName(''); setOrgAdminEmail(''); setOrgAdminPassword(''); setOrgMaxSchools(3);
      setOrgModalOpen(false);
      fetchOrgs();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleDeleteOrg = async (id: number, name: string) => {
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

  const handleToggleBlockOrg = async (org: Organization) => {
    const isBlocked = org.status === 'Muzlatilgan';
    const newStatus = isBlocked ? 'Faol' : 'Muzlatilgan';
    try {
      const res = await fetch(`/api/organizations/${org.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          status: newStatus,
          expiresAt: org.expiresAt || null,
          maxSchools: org.maxSchools || 3
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik');
      showNotification(`Tashkilot ${isBlocked ? 'faollashtirildi ✅' : 'muzlatildi 🔒'}`, isBlocked ? 'success' : 'error');
      fetchOrgs();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };



  const handleOpenSubscription = (org: any) => {
    setSelectedOrg(org);
    setSubName(org.name || '');
    setSubAddress(org.address || '');
    setSubPhone(org.phone || '');
    setSubStatus(org.status || 'Sinov');
    setSubExpiresAt(org.expiresAt ? new Date(org.expiresAt).toISOString().split('T')[0] : '');
    setSubMaxSchools(org.maxSchools || 3);
    setSubAdminName(org.adminName || '');
    setSubAdminEmail(org.adminEmail || '');
    setSubAdminPhone(org.adminPhone || '');
    setSubAdminPassword('');
    setSubModalOpen(true);
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      setUpdatingSub(true);
      const res = await fetch(`/api/organizations/${selectedOrg.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: subName,
          address: subAddress,
          phone: subPhone,
          status: subStatus,
          expiresAt: subExpiresAt || null,
          maxSchools: Number(subMaxSchools),
          adminName: subAdminName,
          adminEmail: subAdminEmail,
          adminPhone: subAdminPhone,
          adminPassword: subAdminPassword || undefined
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik');
      showNotification('Tashkilot ma\'lumotlari yangilandi!', 'success');
      setSubModalOpen(false);
      fetchOrgs();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setUpdatingSub(false);
    }
  };

  const handleOpenLeadModal = (lead: SaaSLead | null = null) => {
    if (lead) {
      setSelectedLead(lead);
      setLeadName(lead.name);
      setLeadPhone(lead.phone);
      setLeadCenter(lead.centerName || '');
      setLeadStatus(lead.status);
      setLeadNotes(lead.notes || '');
      setLeadSellerId(lead.sellerId ? String(lead.sellerId) : '');
    } else {
      setSelectedLead(null);
      setLeadName('');
      setLeadPhone('');
      setLeadCenter('');
      setLeadStatus('Yangi');
      setLeadNotes('');
      setLeadSellerId('');
    }
    setLeadModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadPhone) return;
    try {
      setSavingLead(true);
      const url = selectedLead ? `/api/saas-leads/${selectedLead.id}` : '/api/saas-leads';
      const method = selectedLead ? 'PUT' : 'POST';

      const payload: any = {
        name: leadName,
        phone: leadPhone,
        centerName: leadCenter || null,
        status: leadStatus,
        notes: leadNotes || null
      };

      if (isSuper) {
        payload.sellerId = leadSellerId ? Number(leadSellerId) : null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik');
      showNotification(selectedLead ? 'Lid yangilandi' : 'Yangi lid qo\'shildi', 'success');
      setLeadModalOpen(false);
      fetchLeads();
      if (isSuper) fetchSellers(); // Refresh seller stats
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSavingLead(false);
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (!window.confirm('Ushbu lidni o\'chirib tashlamoqchimisiz?')) return;
    try {
      const res = await fetch(`/api/saas-leads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Xatolik');
      showNotification("Lid o'chirildi", 'success');
      fetchLeads();
      if (isSuper) fetchSellers();
    } catch {
      showNotification("O'chirishda xatolik yuz berdi", 'error');
    }
  };

  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerName || !sellerEmail || !sellerPassword) return;
    try {
      setCreatingSeller(true);
      const res = await fetch('/api/sellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: sellerName,
          email: sellerEmail,
          password: sellerPassword,
          phone: sellerPhone || null
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik');
      showNotification('Yangi sotuvchi agent yaratildi!', 'success');
      setSellerName(''); setSellerEmail(''); setSellerPhone(''); setSellerPassword('');
      setSellerModalOpen(false);
      fetchSellers();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setCreatingSeller(false);
    }
  };

  // --- SaaS Metrics (20 key metrics) ---
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter(o => o.status === 'Faol').length;
  const trialOrgs = orgs.filter(o => o.status === 'Sinov').length;
  const frozenOrgs = orgs.filter(o => o.status === 'Muzlatilgan').length;
  const totalSchools = orgs.reduce((a, o) => a + (o.schoolCount || 0), 0);
  const avgSchoolsPerOrg = orgs.length > 0 ? (totalSchools / orgs.length).toFixed(1) : '0';
  const mrr = activeOrgs * 500000;
  const arr = mrr * 12;
  const conversionTrialToActive = (trialOrgs + activeOrgs) > 0 ? ((activeOrgs / (trialOrgs + activeOrgs)) * 100).toFixed(1) + '%' : '0%';
  
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter(l => l.status === 'Yangi').length;
  const contactedLeadsCount = leads.filter(l => l.status === 'Bog\'lanildi').length;
  const wonLeadsCount = leads.filter(l => l.status === 'Sotildi').length;
  const lostLeadsCount = leads.filter(l => l.status === 'Rad etildi').length;
  const leadWonRate = totalLeadsCount > 0 ? ((wonLeadsCount / totalLeadsCount) * 100).toFixed(1) + '%' : '0%';
  
  const totalSellers = sellers.length;
  const totalPlatformStudents = orgs.reduce((a, o) => a + (o.studentCount || 0), 0);
  const totalPlatformTeachers = orgs.reduce((a, o) => a + (o.teacherCount || 0), 0);
  const totalPlatformUsers = orgs.reduce((a, o) => a + (o.userCount || 0), 0);
  const avgMaxSchoolsLimit = orgs.length > 0 ? (orgs.reduce((a, o) => a + (o.maxSchools || 3), 0) / orgs.length).toFixed(1) : '3';

  // --- Filtered Orgs ---
  const filteredOrgs = orgs.filter(org => {
    const s = orgSearch.toLowerCase();
    const matchesSearch = org.name.toLowerCase().includes(s) || 
                          (org.address && org.address.toLowerCase().includes(s)) ||
                          (org.phone && org.phone.toLowerCase().includes(s));
    
    let matchesStatus = true;
    if (orgFilterStatus === 'FAOL') matchesStatus = org.status === 'Faol';
    if (orgFilterStatus === 'SINOV') matchesStatus = org.status === 'Sinov' || !org.status;
    if (orgFilterStatus === 'MUZLATILGAN') matchesStatus = org.status === 'Muzlatilgan';

    return matchesSearch && matchesStatus;
  });

  // --- Filtered Leads ---
  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      l.phone.includes(leadSearch) ||
      (l.centerName && l.centerName.toLowerCase().includes(leadSearch.toLowerCase()));
    const matchesStatus = leadFilterStatus === 'all' || l.status === leadFilterStatus;
    return matchesSearch && matchesStatus;
  });

  // If not superadmin and not seller, show unauthorized
  if (!isSuper && !isSeller) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-red-500 font-extrabold text-lg uppercase tracking-widest">Ruxsat etilmagan</div>
        <p className="text-gray-500 text-sm mt-2">Bu sahifaga faqat Super Admin yoki Sotuvchi kira oladi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
            {isSuper ? 'Super Admin Boshqaruvi' : 'Sotuvchi Dashboard'}
          </h1>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
            {isSuper ? 'Platformadagi barcha tashkilotlar, lidlar va sotuvchilarni nazorat qilish' : 'Sizga biriktirilgan sotuv lidlarini boshqarish'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'orgs' && isSuper && (
            <button
              onClick={() => setOrgModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all hover:scale-105 cursor-pointer"
            >
              <Plus size={15} />
              Yangi Tashkilot
            </button>
          )}
          {activeTab === 'leads' && (
            <button
              onClick={() => handleOpenLeadModal(null)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 cursor-pointer"
            >
              <Plus size={15} />
              Yangi Lid Qo'shish
            </button>
          )}
          {activeTab === 'sellers' && isSuper && (
            <button
              onClick={() => setSellerModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-violet-500/20 transition-all hover:scale-105 cursor-pointer"
            >
              <UserPlus size={15} />
              Yangi Sotuvchi
            </button>
          )}
        </div>
      </div>

      {/* Tab Selector */}
      {isSuper && (
        <div className="flex border-b border-gray-100 dark:border-gray-700/50 gap-2 pb-px">
          {[
            { id: 'overview', label: 'Boshqaruv Paneli', icon: LayoutDashboard },
            { id: 'orgs', label: 'Tashkilotlar', icon: Building2 },
            { id: 'leads', label: 'CRM Sotuv Lidleari', icon: ClipboardList },
            { id: 'sellers', label: 'Sotuvchilar (Agentlar)', icon: Users2 },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                  active
                    ? 'border-[#1b6b6b] text-[#1b6b6b] dark:text-[#2eb8b8]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW: Overview (Dashboard) */}
      {activeTab === 'overview' && isSuper && (
        <div className="space-y-8">
          {/* SaaS Business Metrics Dashboard */}
          <div className="space-y-6 bg-gray-50/40 dark:bg-gray-900/30 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800">
            <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2">
              SaaS Tizimi Ko'rsatkichlari (KPIs)
            </h2>
            
            <div className="space-y-8">
              {/* Group 1: Biznes va Obuna */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Biznes va Obuna Metrikalari
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'MRR (Oylik Tushum)', value: mrr.toLocaleString() + ' UZS', icon: Wallet, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400' },
                    { label: 'ARR (Yillik Tushum)', value: arr.toLocaleString() + ' UZS', icon: Wallet, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400' },
                    { label: 'Trial -> Active Conversion', value: conversionTrialToActive, icon: GraduationCap, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/20 dark:text-violet-400' },
                    { label: 'O\'rtacha Filial Limiti', value: avgMaxSchoolsLimit + ' ta', icon: Building2, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400' },
                    { label: 'Sotuvchilar (Agentlar)', value: totalSellers + ' ta', icon: Users2, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400' },
                  ].map((m, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 flex flex-col justify-between h-[100px] shadow-sm hover:shadow transition-all duration-300">
                      <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">{m.label}</span>
                      <div className="flex items-end justify-between mt-1.5">
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-none tracking-tight">{m.value}</span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                          <m.icon size={13} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2: Sotuv Lidleari Boshqaruvi */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Sotuv va Lidlar Metrikalari
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  {[
                    { label: 'Jami Lidlar', value: totalLeadsCount + ' ta', icon: ClipboardList, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400' },
                    { label: 'Yangi Lidlar', value: newLeadsCount + ' ta', icon: ClipboardList, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400' },
                    { label: 'Bog\'lanilgan', value: contactedLeadsCount + ' ta', icon: Phone, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400' },
                    { label: 'Sotilgan (Won)', value: wonLeadsCount + ' ta', icon: Wallet, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400' },
                    { label: 'Rad etilgan (Lost)', value: lostLeadsCount + ' ta', icon: X, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400' },
                    { label: 'Lead Conversion Rate', value: leadWonRate, icon: GraduationCap, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/20 dark:text-violet-400' },
                  ].map((m, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 flex flex-col justify-between h-[100px] shadow-sm hover:shadow transition-all duration-300">
                      <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">{m.label}</span>
                      <div className="flex items-end justify-between mt-1.5">
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-none tracking-tight">{m.value}</span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                          <m.icon size={13} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 3: Tashkilotlar Holati */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Tashkilotlar Holati Metrikalari
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Jami Tashkilotlar', value: totalOrgs + ' ta', icon: Building2, color: 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400' },
                    { label: 'Faol Tashkilotlar', value: activeOrgs + ' ta', icon: Building2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400' },
                    { label: 'Trial Tashkilotlar', value: trialOrgs + ' ta', icon: Building2, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400' },
                    { label: 'Muzlatilganlar', value: frozenOrgs + ' ta', icon: Building2, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400' },
                  ].map((m, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 flex flex-col justify-between h-[100px] shadow-sm hover:shadow transition-all duration-300">
                      <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">{m.label}</span>
                      <div className="flex items-end justify-between mt-1.5">
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-none tracking-tight">{m.value}</span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                          <m.icon size={13} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 4: Platformadan Foydalanish */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> Platforma Foydalanish Metrikalari
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Jami Filiallar', value: totalSchools + ' ta', icon: Building2, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400' },
                    { label: 'O\'rtacha Filiallar / Org', value: avgSchoolsPerOrg, icon: Building2, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400' },
                    { label: 'Jami O\'quvchilar', value: totalPlatformStudents.toLocaleString() + ' ta', icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400' },
                    { label: 'Jami O\'qituvchilar', value: totalPlatformTeachers.toLocaleString() + ' ta', icon: GraduationCap, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/20 dark:text-violet-400' },
                    { label: 'Jami Foydalanuvchilar', value: totalPlatformUsers.toLocaleString() + ' ta', icon: Users2, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400' },
                  ].map((m, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 flex flex-col justify-between h-[100px] shadow-sm hover:shadow transition-all duration-300">
                      <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">{m.label}</span>
                      <div className="flex items-end justify-between mt-1.5">
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-none tracking-tight">{m.value}</span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                          <m.icon size={13} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Organizations */}
      {activeTab === 'orgs' && isSuper && (
        <div className="space-y-8">
          {/* Org list */}
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                Tashkilotlar ro'yxati ({filteredOrgs.length})
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Qidirish (nomi, manzil, telefon)..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none w-64 shadow-sm focus:border-emerald-500 transition-all"
                />
                <select
                  value={orgFilterStatus}
                  onChange={(e) => setOrgFilterStatus(e.target.value as any)}
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer shadow-sm focus:border-emerald-500 transition-all"
                >
                  <option value="ALL">Barchasi</option>
                  <option value="FAOL">Faol Tashkilotlar</option>
                  <option value="SINOV">Sinov Muddatidagilar</option>
                  <option value="MUZLATILGAN">Muzlatilganlar (Bloklangan)</option>
                </select>
              </div>
            </div>

            {fetchingOrgs ? (
              <div className="py-20 flex items-center justify-center">
                <div className="w-8 h-8 border-[3px] border-[#1b6b6b] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-16 text-center">
                <Building2 size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
                <p className="text-gray-400 font-bold text-sm">Hozircha tashkilot topilmadi</p>
                <button
                  onClick={() => setOrgModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#1b6b6b] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl cursor-pointer"
                >
                  <Plus size={13} /> Yangi tashkilot yarating
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {filteredOrgs.map(org => {
                  const statusColors: Record<string, string> = {
                    Faol: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400',
                    Sinov: 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400',
                    Muzlatilgan: 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400'
                  };
                  return (
                    <div
                      key={org.id}
                      onClick={() => navigate(`/org/${org.id}`)}
                      className="group bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:border-[#1b6b6b]/30 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
                    >
                      {/* Left: Info */}
                      <div className="flex items-center gap-5 min-w-[280px]">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2b9b9b] flex items-center justify-center shrink-0 shadow-lg shadow-[#1b6b6b]/15 group-hover:scale-105 transition-transform duration-300">
                          <Building2 size={24} className="text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold text-[#1b6b6b] dark:text-[#2b9b9b] uppercase tracking-widest">Tashkilot #{org.id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider ${statusColors[org.status || 'Sinov']}`}>
                              {org.status || 'Sinov'}
                            </span>
                          </div>
                          <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-base group-hover:text-[#1b6b6b] transition-colors">{org.name}</h3>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400 font-bold items-center">
                            {org.address && (
                              <div className="flex items-center gap-1">
                                <MapPin size={11} className="text-gray-400" />
                                {org.address}
                              </div>
                            )}
                            {org.phone && (
                              <div className="flex items-center gap-1">
                                <Phone size={11} className="text-gray-400" />
                                {org.phone}
                              </div>
                            )}
                            {(org as any).adminEmail && (
                              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                <span className="font-extrabold text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">Admin:</span>
                                <span className="text-[#1b6b6b] dark:text-[#2b9b9b]">{(org as any).adminEmail}</span>
                                {(org as any).adminPhone && <span className="text-[10px] opacity-75">({(org as any).adminPhone})</span>}
                              </div>
                            )}
                          </div>
                          {org.expiresAt && (
                             <div className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-wider flex items-center gap-1">
                               <Calendar size={12} className="text-gray-400" />
                               {new Date(org.createdAt).toLocaleDateString()} → {new Date(org.expiresAt).toLocaleDateString()}
                             </div>
                           )}
                           {!org.expiresAt && org.createdAt && (
                             <div className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-wider flex items-center gap-1">
                               <Calendar size={12} className="text-gray-400" />
                               Boshlangan: {new Date(org.createdAt).toLocaleDateString()}
                             </div>
                           )}
                        </div>
                      </div>

                      {/* Middle: Stats Row */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {[
                          { label: 'Filial', value: `${org.schoolCount || 0} / ${org.maxSchools || 3}`, color: 'bg-sky-50/70 text-sky-600 border-sky-100/50 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30' },
                          { label: "O'quvchi", value: org.studentCount || 0, color: 'bg-emerald-50/70 text-emerald-600 border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' },
                          { label: 'Ustoz', value: org.teacherCount || 0, color: 'bg-violet-50/70 text-violet-600 border-violet-100/50 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30' },
                          { label: 'Xodim', value: org.userCount || 0, color: 'bg-amber-50/70 text-amber-600 border-amber-100/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' },
                        ].map((s, i) => (
                          <div key={i} className={`rounded-2xl px-5 py-2.5 border text-center min-w-[85px] flex flex-col justify-center ${s.color}`}>
                            <div className="text-[9px] font-extrabold uppercase tracking-wider opacity-70 leading-none">{s.label}</div>
                            <div className="text-sm font-black mt-1 leading-none">{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700/30">
                          <button
                            onClick={e => { e.stopPropagation(); handleToggleBlockOrg(org); }}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-sm border ${
                              org.status === 'Muzlatilgan' 
                                ? 'text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 border-transparent hover:border-amber-100 dark:hover:border-amber-900'
                                : 'text-gray-400 hover:text-rose-500 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 border-transparent hover:border-rose-100 dark:hover:border-rose-900'
                            }`}
                            title={org.status === 'Muzlatilgan' ? "Faollashtirish" : "Muzlatish (Bloklash)"}
                          >
                            {org.status === 'Muzlatilgan' ? <Unlock size={16} /> : <Lock size={16} />}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleOpenSubscription(org); }}
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-sky-500 hover:bg-sky-100/50 dark:hover:bg-sky-950/40 rounded-xl transition-all cursor-pointer shadow-sm border border-transparent hover:border-sky-100 dark:hover:border-sky-900"
                            title="Tarifni sozlash"
                          >
                            <Settings size={16} />
                          </button>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center border border-gray-100 dark:border-gray-700/30 group-hover:bg-[#1b6b6b]/10 group-hover:border-[#1b6b6b]/20 transition-all">
                          <ChevronRight size={20} className="text-gray-400 group-hover:text-[#1b6b6b] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: CRM Sales Leads */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Lid nomi, tel yoki markaz..."
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                className="w-full pl-5 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'Yangi', 'Bog\'lanildi', 'Sotildi', 'Rad etildi'].map(st => (
                <button
                  key={st}
                  onClick={() => setLeadFilterStatus(st)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    leadFilterStatus === st
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
                      : 'bg-gray-50 dark:bg-gray-900/50 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {st === 'all' ? 'Barchasi' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Lead list */}
          {fetchingLeads ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-16 text-center">
              <ClipboardList size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
              <p className="text-gray-400 font-bold text-sm">Sotuv lidlari topilmadi</p>
              <button
                onClick={() => handleOpenLeadModal(null)}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-xs font-extrabold uppercase tracking-widest rounded-xl cursor-pointer"
              >
                <Plus size={13} /> Birinchi lidni qo'shing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLeads.map(lead => {
                const statusColors: Record<string, string> = {
                  Yangi: 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-400',
                  'Bog\'lanildi': 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400',
                  Sotildi: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400',
                  'Rad etildi': 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400'
                };

                return (
                  <div
                    key={lead.id}
                    className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${statusColors[lead.status]}`}>
                          {lead.status}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenLeadModal(lead)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-base leading-tight mb-2">
                        {lead.name}
                      </h3>

                      <div className="space-y-1.5 mb-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-gray-400" />
                          <span>{lead.phone}</span>
                        </div>
                        {lead.centerName && (
                          <div className="flex items-center gap-1.5">
                            <Building2 size={12} className="text-gray-400" />
                            <span>Markaz: {lead.centerName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-gray-400" />
                          <span>Qo'shildi: {new Date(lead.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {lead.notes && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 mb-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 border border-gray-100/55 dark:border-gray-800">
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Izoh / Eslatma:</div>
                          {lead.notes}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-50 dark:border-gray-700/50 pt-4 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                      <span>Sotuvchi agent:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-black">
                        {lead.seller ? lead.seller.name : 'Biriktirilmagan'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: Sellers list */}
      {activeTab === 'sellers' && isSuper && (
        <div className="space-y-6">
          {fetchingSellers ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sellers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-16 text-center">
              <Users2 size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
              <p className="text-gray-400 font-bold text-sm">Hozircha sotuvchi agentlar yo'q</p>
              <button
                onClick={() => setSellerModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-xs font-extrabold uppercase tracking-widest rounded-xl cursor-pointer"
              >
                <Plus size={13} /> Birinchi agentni qo'shing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sellers.map(sel => (
                <div
                  key={sel.id}
                  className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                        <Users2 size={20} />
                      </div>
                      <span className="px-2.5 py-0.5 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/50 text-violet-600 dark:text-violet-400 rounded-full text-[9px] font-black uppercase tracking-wider">
                        Agent
                      </span>
                    </div>

                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-base leading-tight mb-1">
                      {sel.name}
                    </h3>
                    <p className="text-xs font-bold text-gray-400 mb-4">{sel.email}</p>

                    <div className="space-y-1 text-xs font-bold text-gray-500 dark:text-gray-400 mb-6">
                      {sel.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-gray-400" />
                          <span>{sel.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" />
                        <span>Ro'yxatdan o'tdi: {new Date(sel.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Block */}
                  <div className="border-t border-gray-50 dark:border-gray-700/50 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-2 border border-gray-100/50 dark:border-gray-700/20">
                        <div className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">Jami Lidlar</div>
                        <div className="text-sm font-black text-gray-800 dark:text-white">{sel.totalLeads}</div>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl p-2 border border-emerald-100/30 dark:border-emerald-900/10">
                        <div className="text-[8px] font-extrabold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">Sotildi</div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{sel.convertedLeads}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                      <span>Konversiya:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-violet-600 dark:text-violet-400 font-black">{sel.conversionRate}%</span>
                        <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${sel.conversionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Create Org */}
      {orgModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setOrgModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Tashkilot</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">O'quv markaz yoki tashkilot</p>
              </div>
              <button onClick={() => setOrgModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-5">
              {/* Tashkilot ma'lumotlari */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#1b6b6b] uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={13} /> Tashkilot Ma'lumotlari
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Tashkilot Nomi *</label>
                    <input
                      type="text" required
                      placeholder="Masalan: Sariosiyo O'quv Markazi"
                      value={orgName} onChange={e => setOrgName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Manzil</label>
                    <input
                      type="text"
                      placeholder="Masalan: Toshkent sh., Chilonzor"
                      value={orgAddress} onChange={e => setOrgAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Telefon</label>
                    <input
                      type="text"
                      placeholder="+998 90 123 45 67"
                      value={orgPhone} onChange={e => setOrgPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Filial Limiti</label>
                    <input
                      type="number" min={1} max={50}
                      value={orgMaxSchools} onChange={e => setOrgMaxSchools(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Admin ma'lumotlari */}
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <UserPlus size={13} /> Admin Hisobi *
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Ismi</label>
                    <input
                      type="text"
                      placeholder="Sardor Rahimov"
                      value={orgAdminName} onChange={e => setOrgAdminName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Email *</label>
                    <input
                      type="email" required
                      placeholder="admin@sariosiyo.uz"
                      value={orgAdminEmail} onChange={e => setOrgAdminEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Parol *</label>
                    <input
                      type="password" required
                      placeholder="••••••••"
                      value={orgAdminPassword} onChange={e => setOrgAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOrgModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer">
                  Bekor
                </button>
                <button type="submit" disabled={creatingOrg}
                  className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all disabled:opacity-50 cursor-pointer">
                  {creatingOrg ? 'Yaratilmoqda...' : 'Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Organization & Admin */}
      {subModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSubModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Tashkilot va Admin Sozlamalari</h3>
                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{selectedOrg.name} tahrirlash</p>
              </div>
              <button onClick={() => setSubModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateSubscription} className="space-y-6">
              {/* Section 1: Organization Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-50 dark:border-gray-700/30">Tashkilot Ma'lumotlari</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Tashkilot Nomi *</label>
                    <input
                      type="text" required
                      value={subName}
                      onChange={e => setSubName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Telefon Raqami</label>
                    <input
                      type="text"
                      value={subPhone}
                      onChange={e => setSubPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Manzil</label>
                  <input
                    type="text"
                    value={subAddress}
                    onChange={e => setSubAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                  />
                </div>
              </div>

              {/* Section 2: Subscription Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-50 dark:border-gray-700/30">Obuna Sozlamalari</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Holati</label>
                    <select
                      value={subStatus}
                      onChange={e => setSubStatus(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    >
                      <option value="Sinov">Sinov (Trial)</option>
                      <option value="Faol">Faol (Active)</option>
                      <option value="Muzlatilgan">Muzlatilgan (Suspended)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Ruxsat Muddati (Expires At)</label>
                    <input
                      type="date"
                      value={subExpiresAt}
                      onChange={e => setSubExpiresAt(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Maksimal Filial Limiti</label>
                    <input
                      type="number" required min={1}
                      value={subMaxSchools}
                      onChange={e => setSubMaxSchools(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Admin Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-50 dark:border-gray-700/30">Admin Akkaunti Ma'lumotlari</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Ismi *</label>
                    <input
                      type="text" required
                      value={subAdminName}
                      onChange={e => setSubAdminName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Telefoni</label>
                    <input
                      type="text"
                      value={subAdminPhone}
                      onChange={e => setSubAdminPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Admin Email (Login) *</label>
                    <input
                      type="email" required
                      value={subAdminEmail}
                      onChange={e => setSubAdminEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Yangi Parol (O'zgartirish uchun to'ldiring)</label>
                    <input
                      type="password"
                      placeholder="Faqat o'zgartirish uchun..."
                      value={subAdminPassword}
                      onChange={e => setSubAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                <button type="button" onClick={() => setSubModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer">
                  Bekor
                </button>
                <button type="submit" disabled={updatingSub}
                  className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all disabled:opacity-50 cursor-pointer">
                  {updatingSub ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Save Lead */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setLeadModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {selectedLead ? 'Lidni Tahrirlash' : 'Yangi Lid'}
                </h3>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">CRM Xarid qilish istagida bo'lgan mijoz</p>
              </div>
              <button onClick={() => setLeadModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Mijoz Ismi *</label>
                <input
                  type="text" required
                  placeholder="Masalan: Jamshid Aliyev"
                  value={leadName} onChange={e => setLeadName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Telefon Raqami *</label>
                <input
                  type="text" required
                  placeholder="Masalan: +998 90 999 88 77"
                  value={leadPhone} onChange={e => setLeadPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">O'quv Markaz Nomi</label>
                <input
                  type="text"
                  placeholder="Masalan: Quantum Academy"
                  value={leadCenter} onChange={e => setLeadCenter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Holati</label>
                  <select
                    value={leadStatus}
                    onChange={e => setLeadStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="Yangi">Yangi</option>
                    <option value="Bog'lanildi">Bog'lanildi</option>
                    <option value="Sotildi">Sotildi</option>
                    <option value="Rad etildi">Rad etildi</option>
                  </select>
                </div>
                {isSuper && (
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Sotuvchi Agent</label>
                    <select
                      value={leadSellerId}
                      onChange={e => setLeadSellerId(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                    >
                      <option value="">Tanlanmagan</option>
                      {sellers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Eslatmalar / Izohlar</label>
                <textarea
                  placeholder="Uchrashuv vaqti yoki alohida istaklar..."
                  value={leadNotes} onChange={e => setLeadNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setLeadModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer">
                  Bekor
                </button>
                <button type="submit" disabled={savingLead}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer">
                  {savingLead ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Seller */}
      {sellerModalOpen && isSuper && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSellerModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Sotuvchi Agent</h3>
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mt-0.5">CRM Tizimini sotadigan xodim</p>
              </div>
              <button onClick={() => setSellerModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSeller} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Ism Familiya *</label>
                <input
                  type="text" required
                  placeholder="Masalan: Sardor Komilov"
                  value={sellerName} onChange={e => setSellerName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-violet-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Email *</label>
                <input
                  type="email" required
                  placeholder="sardor@saraosiyo.uz"
                  value={sellerEmail} onChange={e => setSellerEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-violet-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Telefon</label>
                <input
                  type="text"
                  placeholder="+998 93 111 22 33"
                  value={sellerPhone} onChange={e => setSellerPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-violet-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Parol *</label>
                <input
                  type="password" required
                  placeholder="••••••••"
                  value={sellerPassword} onChange={e => setSellerPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-violet-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSellerModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer">
                  Bekor
                </button>
                <button type="submit" disabled={creatingSeller}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 cursor-pointer">
                  {creatingSeller ? 'Yaratilmoqda...' : 'Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
