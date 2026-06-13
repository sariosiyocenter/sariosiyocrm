import React, { useState } from 'react';
import { MoreHorizontal, Plus, Search, Filter, Phone, Calendar, ArrowRight, X, Sparkles, SlidersHorizontal, Trash2, UserPlus, GraduationCap, MapPin, Award, BookOpen, Clock, Building } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { Lead } from '../types';

const STAGES = [
  { id: 'yangi', name: 'Yangi', color: 'bg-sky-500', borderColor: 'border-sky-500', lightBgc: 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/30' },
  { id: 'boglanilmadi', name: "Bog'lanilmadi", color: 'bg-amber-500', borderColor: 'border-amber-500', lightBgc: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' },
  { id: 'oylayapti', name: "O'ylayapti", color: 'bg-violet-500', borderColor: 'border-violet-500', lightBgc: 'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-900/30' },
  { id: 'kelishdi', name: 'Kelishdi', color: 'bg-emerald-500', borderColor: 'border-emerald-500', lightBgc: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' },
  { id: 'tolov_qildi', name: "To'lov qildi", color: 'bg-rose-500', borderColor: 'border-rose-500', lightBgc: 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30' },
] as const;

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function Leads() {
  const { leads, courses, groups, updateLead, addLead, deleteLead, addStudent } = useCRM();
  const { t } = useLang();
  
  const getStageLabel = (name: string) => {
    if (name === 'Yangi') return t('lead_status_new');
    if (name === "Bog'lanilmadi") return t('lead_status_no_contact');
    if (name === "O'ylayapti") return t('lead_status_thinking');
    if (name === 'Kelishdi') return t('lead_status_agreed');
    if (name === "To'lov qildi") return t('lead_status_paid');
    return name;
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', course: '', source: 'Instagram' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected lead details & conversion state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionData, setConversionData] = useState({
    birthDate: '',
    address: '',
    studentSchool: '',
    groupId: '',
    balance: '0',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    photo: ''
  });

  const [filters, setFilters] = useState({
    course: '',
    source: '',
    dateRange: 'all' // all, today, week, month
  });

  const getLeadsByStatus = (status: string) => leads.filter(lead => {
    const lowerQ = searchQuery.toLowerCase();
    const matchesSearch = 
      (lead.name || '').toLowerCase().includes(lowerQ) || 
      (lead.phone || '').includes(searchQuery) ||
      (lead.course || '').toLowerCase().includes(lowerQ);
    
    const matchesCourse = !filters.course || lead.course === filters.course;
    const matchesSource = !filters.source || lead.source === filters.source;
    
    let matchesDate = true;
    if (filters.dateRange !== 'all') {
      const leadDate = new Date(lead.createdAt);
      const now = new Date();
      if (filters.dateRange === 'today') {
        matchesDate = leadDate.toDateString() === now.toDateString();
      } else if (filters.dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 864e5);
        matchesDate = leadDate >= weekAgo;
      } else if (filters.dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        matchesDate = leadDate >= monthAgo;
      }
    }

    return lead.status === status && matchesSearch && matchesCourse && matchesSource && matchesDate;
  });

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    addLead({ 
      ...newLead, 
      status: 'Yangi', 
      course: newLead.course || (courses.length > 0 ? courses[0].name : ''), 
      createdAt: new Date().toISOString() 
    });
    setIsModalOpen(false);
    setNewLead({ name: '', phone: '', course: '', source: 'Instagram' });
  };

  const handleStatusChange = async (leadId: number, newStatus: Lead['status']) => {
    try {
      await updateLead(leadId, newStatus);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error("Lid holatini yangilashda xatolik:", err);
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    if (window.confirm(t('delete_lead_confirm'))) {
      try {
        await deleteLead(leadId);
        setSelectedLead(null);
      } catch (err) {
        console.error("Lidni o'chirishda xatolik:", err);
      }
    }
  };

  const handleConvertToStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      const studentGroups = conversionData.groupId ? [parseInt(conversionData.groupId)] : [];
      
      // Create student
      await addStudent({
        name: selectedLead.name,
        phone: selectedLead.phone,
        birthDate: conversionData.birthDate,
        address: conversionData.address || "Kiritilmagan",
        status: 'Faol',
        joinedDate: new Date().toISOString().split('T')[0],
        balance: parseFloat(conversionData.balance) || 0,
        groups: studentGroups,
        fatherName: conversionData.fatherName,
        fatherPhone: conversionData.fatherPhone,
        motherName: conversionData.motherName,
        motherPhone: conversionData.motherPhone,
        studentSchool: conversionData.studentSchool,
        photo: conversionData.photo || null,
        comment: `QR formadan kelgan lid. Manba: ${selectedLead.source}. Kurs: ${selectedLead.course}`
      });

      // Remove the converted lead
      await deleteLead(selectedLead.id);
      
      // Reset state and close modal
      setSelectedLead(null);
      setIsConverting(false);
      setConversionData({
        birthDate: '',
        address: '',
        studentSchool: '',
        groupId: '',
        balance: '0',
        fatherName: '',
        fatherPhone: '',
        motherName: '',
        motherPhone: '',
        photo: ''
      });
    } catch (err) {
      console.error("Talabaga o'tkazishda xatolik:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight font-display">{t('leads_title')}</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {t('leads_subtitle')} • {leads.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder={t('search_placeholder_students')}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all w-52"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white' : 'bg-gray-55 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-[#1b6b6b] hover:text-[#1b6b6b]'}`}
            >
              <SlidersHorizontal size={15} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
            >
              <Plus size={14} /> {t('add')}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="px-6 pb-5 pt-4 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>{t('by_course')}</label>
              <select 
                value={filters.course}
                onChange={e => setFilters({...filters, course: e.target.value})}
                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer"
              >
                <option value="">{t('all')}</option>
                {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>{t('by_source')}</label>
              <select 
                value={filters.source}
                onChange={e => setFilters({...filters, source: e.target.value})}
                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer"
              >
                <option value="">{t('all')}</option>
                <option value="Instagram">Instagram</option>
                <option value="Telegram">Telegram</option>
                <option value="Facebook">Facebook</option>
                <option value="Tavsiya">Tavsiya</option>
                <option value="QR Ro'yxatdan o'tish">QR Kod</option>
              </select>
            </div>
            <div>
              <label className={lbl}>{t('by_time')}</label>
              <select 
                value={filters.dateRange}
                onChange={e => setFilters({...filters, dateRange: e.target.value})}
                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer"
              >
                <option value="all">{t('all_time')}</option>
                <option value="today">{t('today')}</option>
                <option value="week">{t('this_week')}</option>
                <option value="month">{t('this_month')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => setFilters({course: '', source: '', dateRange: 'all'})}
                className="w-full py-2.5 text-[10px] font-extrabold uppercase text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X size={12} /> {t('filter_clear')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Board Layout */}
      <div className="flex gap-6 overflow-x-auto pb-4 items-start custom-scrollbar">
        {STAGES.map((stage) => {
          const stageLeads = getLeadsByStatus(stage.name);
          return (
            <div 
              key={stage.id} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const leadIdStr = e.dataTransfer.getData("leadId");
                if (leadIdStr) {
                  const leadId = parseInt(leadIdStr);
                  if (!isNaN(leadId)) handleStatusChange(leadId, stage.name);
                }
              }}
              className="w-[300px] shrink-0 bg-gray-50/50 dark:bg-gray-900/10 border border-gray-100/50 dark:border-gray-800/30 rounded-3xl p-4 flex flex-col max-h-[80vh] min-h-[500px]"
            >
              <div className="flex items-center justify-between mb-4 px-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-widest">{getStageLabel(stage.name)}</h3>
                  <span className="bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-lg">
                    {stageLeads.length}
                  </span>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar pr-1">
                {stageLeads.map((lead) => (
                  <div 
                    key={lead.id} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("leadId", lead.id.toString());
                    }}
                    onClick={() => {
                      setSelectedLead(lead);
                      setIsConverting(false);
                    }}
                    className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-755 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider ${stage.lightBgc}`}>
                        {lead.course}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs mb-3 line-clamp-1 uppercase tracking-tight">{lead.name}</h4>
                    
                    <div className="space-y-2 text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-2 bg-gray-55 dark:bg-gray-900/50 p-2 rounded-xl border border-gray-100/30 dark:border-gray-700/30">
                        <Phone size={12} className="text-[#1b6b6b]" />
                        <span className="tabular-nums text-gray-900 dark:text-white">{lead.phone}</span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-50 dark:border-gray-700">
                        <span className="bg-[#1b6b6b]/10 text-[#1b6b6b] px-2 py-0.5 rounded-md text-[8px] font-extrabold">
                          {lead.source}
                        </span>
                        <span className="text-gray-400 dark:text-gray-600 text-[8px] flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white/40 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-400 hover:text-[#1b6b6b] hover:border-[#1b6b6b] hover:bg-white dark:hover:bg-gray-800 transition-all text-[9px] font-black uppercase tracking-widest cursor-pointer"
                >
                  <Plus size={14} /> {t('add')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('new_lead_title')}</h3>
                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('lead_details_subtitle')}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className={lbl}>{t('student_name')} *</label>
                <input required type="text" placeholder="Sirojiddin Aliyev" className={inp} value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>{t('student_phone')} *</label>
                <input required type="text" placeholder="+998 90 123 45 67" className={inp} value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>{t('course')} *</label>
                <select required className={inp} value={newLead.course} onChange={e => setNewLead({ ...newLead, course: e.target.value })}>
                  <option value="" disabled>{t('select_placeholder')}</option>
                  {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>{t('lead_source')} *</label>
                <select required className={inp} value={newLead.source} onChange={e => setNewLead({ ...newLead, source: e.target.value })}>
                  <option value="Instagram">Instagram</option>
                  <option value="Telegram">Telegram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Tavsiya">Tavsiya</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                  {t('cancel')}
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Lead Details & Conversion Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-lg p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('lead_details_title')}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('registered_at')}{new Date(selectedLead.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>

            {!isConverting ? (
              <div className="space-y-6">
                {selectedLead.photo && (
                  <div className="flex justify-center mb-2">
                    <div className="w-24 h-24 rounded-3xl border border-gray-150 dark:border-gray-700 overflow-hidden shadow-sm shrink-0">
                      <img src={selectedLead.photo} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                {/* Details list */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('student_name')}</span>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white">{selectedLead.name}</span>
                  </div>
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('student_phone')}</span>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Phone size={12} className="text-[#1b6b6b]" />
                      {selectedLead.phone}
                    </span>
                  </div>
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('selected_course')}</span>
                    <span className="text-xs font-extrabold text-[#1b6b6b]">{selectedLead.course}</span>
                  </div>
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('lead_source')}</span>
                    <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.source}</span>
                  </div>
                  {selectedLead.birthDate && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('birth_date')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.birthDate}</span>
                    </div>
                  )}
                  {selectedLead.studentSchool && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('school_kindergarten')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.studentSchool}</span>
                    </div>
                  )}
                  {(selectedLead.fatherName || selectedLead.fatherPhone) && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('father')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                        {selectedLead.fatherName || 'Ismsiz'} {selectedLead.fatherPhone ? `(${selectedLead.fatherPhone})` : ''}
                      </span>
                    </div>
                  )}
                  {(selectedLead.motherName || selectedLead.motherPhone) && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('mother')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                        {selectedLead.motherName || 'Ismsiz'} {selectedLead.motherPhone ? `(${selectedLead.motherPhone})` : ''}
                      </span>
                    </div>
                  )}
                  {selectedLead.address && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 col-span-2">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('address')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.address}</span>
                    </div>
                  )}
                  {selectedLead.notes && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 col-span-2">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('description')}</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedLead.notes}</span>
                    </div>
                  )}
                </div>

                {/* Status selector */}
                <div>
                  <label className={lbl}>{t('lead_funnel_status')}</label>
                  <div className="flex flex-wrap gap-2">
                    {STAGES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleStatusChange(selectedLead.id, s.name)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          selectedLead.status === s.name
                            ? `${s.color} text-white border-transparent shadow-md`
                            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-755 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        {getStageLabel(s.name)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversion Prompt */}
                <div className="p-4 rounded-2xl bg-[#1b6b6b]/5 border border-[#1b6b6b]/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('convert_to_student')}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t('convert_to_student_hint')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsConverting(true);
                      // Filter group suggestion by matching course name
                      const matchingGroup = groups.find(g => {
                        const c = courses.find(course => course.id === g.courseId);
                        return c && c.name.toLowerCase() === selectedLead.course.toLowerCase();
                      });
                      setConversionData({
                        birthDate: selectedLead.birthDate || '',
                        address: selectedLead.address || '',
                        studentSchool: selectedLead.studentSchool || '',
                        groupId: matchingGroup ? matchingGroup.id.toString() : '',
                        balance: '0',
                        fatherName: selectedLead.fatherName || '',
                        fatherPhone: selectedLead.fatherPhone || '',
                        motherName: selectedLead.motherName || '',
                        motherPhone: selectedLead.motherPhone || '',
                        photo: selectedLead.photo || ''
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-md transition-all"
                  >
                    <UserPlus size={14} /> {t('convert')}
                  </button>
                </div>

                {/* Actions footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-55 dark:border-gray-700/50">
                  <button
                    type="button"
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <Trash2 size={14} /> {t('delete_lead')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-750 text-gray-700 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer hover:bg-gray-200"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            ) : (
              /* Conversion Form (Step 2) */
              <form onSubmit={handleConvertToStudent} className="space-y-5">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                  <GraduationCap size={16} />
                  <span>{t('convert_form_hint')}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>{t('birth_date')}</label>
                    <input type="date" className={inp} value={conversionData.birthDate} onChange={e => setConversionData({ ...conversionData, birthDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl}>{t('school_kindergarten')}</label>
                    <input type="text" placeholder="42-maktab" className={inp} value={conversionData.studentSchool} onChange={e => setConversionData({ ...conversionData, studentSchool: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>{t('group_class')}</label>
                    <select className={inp} value={conversionData.groupId} onChange={e => setConversionData({ ...conversionData, groupId: e.target.value })}>
                      <option value="">{t('do_not_assign_group')}</option>
                      {groups.map(g => {
                        const course = courses.find(c => c.id === g.courseId);
                        return <option key={g.id} value={g.id}>{g.name} ({course?.name || 'Noma\'lum'})</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>{t('initial_balance')}</label>
                    <input type="number" placeholder="0" className={inp} value={conversionData.balance} onChange={e => setConversionData({ ...conversionData, balance: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className={lbl}>{t('address')}</label>
                  <input type="text" placeholder="Sariosiyo tumani, ... ko'chasi" className={inp} value={conversionData.address} onChange={e => setConversionData({ ...conversionData, address: e.target.value })} />
                </div>

                <div className="border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4 mt-4 space-y-4">
                  <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider">{t('parents_info_optional')}</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>{t('father_name')}</label>
                      <input type="text" placeholder={t('father_name')} className={inp} value={conversionData.fatherName} onChange={e => setConversionData({ ...conversionData, fatherName: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>{t('father_phone')}</label>
                      <input type="tel" placeholder="+998" className={inp} value={conversionData.fatherPhone} onChange={e => setConversionData({ ...conversionData, fatherPhone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>{t('mother_name')}</label>
                      <input type="text" placeholder={t('mother_name')} className={inp} value={conversionData.motherName} onChange={e => setConversionData({ ...conversionData, motherName: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}>{t('mother_phone')}</label>
                      <input type="tel" placeholder="+998" className={inp} value={conversionData.motherPhone} onChange={e => setConversionData({ ...conversionData, motherPhone: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-55 dark:border-gray-700/50">
                  <button type="button" onClick={() => setIsConverting(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-750 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200">
                    {t('back')}
                  </button>
                  <button type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-650/20 transition-all cursor-pointer">
                    {t('confirm_convert')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
