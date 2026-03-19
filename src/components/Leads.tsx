import React, { useState } from 'react';
import { MoreHorizontal, Plus, Search, Filter, Phone, Calendar, ArrowRight, X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { Lead } from '../types';

const STAGES = [
  { id: 'yangi', name: 'Yangi', color: 'bg-sky-500', borderColor: 'border-sky-500', lightBgc: 'bg-sky-50 dark:bg-sky-900/30' },
  { id: 'boglanilmadi', name: "Bog'lanilmadi", color: 'bg-amber-500', borderColor: 'border-amber-500', lightBgc: 'bg-amber-50 dark:bg-amber-900/30' },
  { id: 'oylayapti', name: "O'ylayapti", color: 'bg-blue-500', borderColor: 'border-blue-500', lightBgc: 'bg-blue-50 dark:bg-blue-900/30' },
  { id: 'kelishdi', name: 'Kelishdi', color: 'bg-emerald-500', borderColor: 'border-emerald-500', lightBgc: 'bg-emerald-50 dark:bg-emerald-900/30' },
  { id: 'tolov_qildi', name: "To'lov qildi", color: 'bg-rose-500', borderColor: 'border-rose-500', lightBgc: 'bg-rose-50 dark:bg-rose-900/30' },
] as const;

export default function Leads() {
  const { leads, courses, updateLead, addLead } = useCRM();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', course: '', source: 'Instagram' });
  const [searchQuery, setSearchQuery] = useState('');
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
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
    addLead({ ...newLead, status: 'Yangi', course: newLead.course || (courses.length > 0 ? courses[0].name : ''), createdAt: new Date().toISOString() });
    setIsModalOpen(false);
    setNewLead({ name: '', phone: '', course: '', source: 'Instagram' });
  };

  return (
    <div className="flex flex-col h-full relative space-y-8 animate-in fade-in duration-700 pb-8">
      <div className="flex items-center justify-between">
          <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Lidlar (CRM)</h1>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Potensial mijozlar va sotuv voronkasi</p>
          </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none overflow-hidden transition-all">
        <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <button 
              className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/30 flex items-center gap-3 group"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              Yangi Lid
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-3 px-8 py-4 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest transition-all group shadow-sm border ${
                showFilters 
                ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800' 
                : 'bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Filter size={18} className={showFilters ? 'text-sky-500' : 'group-hover:text-sky-500 transition-colors'} />
              {showFilters ? 'Filterni yopish' : 'Filterlar'}
            </button>
          </div>
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="relative group w-full lg:w-[450px]">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
                <input
                type="text"
                placeholder="Ism yoki telefon orqali qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-gray-400/60 dark:text-white text-gray-900 shadow-inner"
              />
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="px-8 pb-8 pt-2 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-3">
              <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Kurs bo'yicha</label>
              <select 
                value={filters.course}
                onChange={e => setFilters({...filters, course: e.target.value})}
                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white appearance-none cursor-pointer"
              >
                <option value="">Barchasi</option>
                {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Manba bo'yicha</label>
              <select 
                value={filters.source}
                onChange={e => setFilters({...filters, source: e.target.value})}
                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white appearance-none cursor-pointer"
              >
                <option value="">Barchasi</option>
                <option value="Instagram">Instagram</option>
                <option value="Telegram">Telegram</option>
                <option value="Facebook">Facebook</option>
                <option value="Tavsiya">Tavsiya</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Vaqt bo'yicha</label>
              <select 
                value={filters.dateRange}
                onChange={e => setFilters({...filters, dateRange: e.target.value})}
                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">Barcha vaqt</option>
                <option value="today">Bugun</option>
                <option value="week">Shu hafta</option>
                <option value="month">Shu oy</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <button 
                onClick={() => setFilters({course: '', source: '', dateRange: 'all'})}
                className="w-full py-3.5 text-[9px] font-extrabold uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
              >
                <X size={14} />
                Tozalash
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar">
        <div className="flex gap-8 h-full min-w-max pb-4">
          {STAGES.map((stage, idx) => (
            <div key={stage.id} 
              className="w-[340px] flex flex-col bg-gray-50/30 dark:bg-gray-900/20 border border-gray-100/50 dark:border-gray-800/30 rounded-[2.5rem] p-6 h-full shadow-inner animate-in slide-in-from-right-4 duration-500"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-4">
                  <div className={`w-3.5 h-3.5 rounded-full ${stage.color} shadow-lg shadow-${stage.color.split('-')[1]}-500/20 ring-4 ring-${stage.color.split('-')[1]}-500/10`} />
                  <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-widest">{stage.name}</h3>
                  <span className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-extrabold px-3 py-1 rounded-xl shadow-sm tabular-nums">
                    {getLeadsByStatus(stage.name).length}
                  </span>
                </div>
                <button className="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 rounded-xl text-gray-300 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-5 overflow-y-auto min-h-[150px] custom-scrollbar pr-2 flex-1 pb-4">
                {getLeadsByStatus(stage.name).map((lead, lIdx) => (
                  <div key={lead.id} 
                    className="bg-white dark:bg-gray-800 p-6 rounded-[1.75rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:shadow-sky-500/10 hover:border-sky-300 dark:hover:border-sky-600 transition-all group/card cursor-pointer animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{ animationDelay: `${lIdx * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[9px] font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-widest ${stage.lightBgc} text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700/50 shadow-inner`}>
                        {lead.course}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-4 group-hover/card:text-sky-600 dark:group-hover/card:text-sky-400 transition-colors line-clamp-1 uppercase tracking-tight">{lead.name}</h4>
                    
                    <div className="space-y-3 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100/50 dark:border-gray-700/50">
                        <Phone size={14} className="text-sky-500" />
                        <span className="tabular-nums text-gray-900 dark:text-white">{lead.phone}</span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-dashed border-gray-100 dark:border-gray-700 mt-2">
                         <span className="flex items-center gap-2 bg-sky-50/50 dark:bg-sky-900/30 px-3 py-1.5 rounded-xl border border-sky-100/50 dark:border-sky-800 text-sky-600 dark:text-sky-400">
                            {lead.source}
                         </span>
                         <span className="flex items-center gap-2 text-gray-400 dark:text-gray-600">
                            <Calendar size={12} />
                            {new Date(lead.createdAt).toLocaleDateString()}
                         </span>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-3 py-5 bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-[1.75rem] text-gray-400 dark:text-gray-600 hover:text-sky-500 dark:hover:text-sky-400 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50/30 dark:hover:bg-sky-900/10 transition-all text-[10px] font-bold uppercase tracking-widest mt-2 shadow-sm"
                >
                  <Plus size={20} />
                  Lid Qo'shish
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yangi Lid</h2>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Yangi potensial mijoz ma'lumotlari</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ism Familiya <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="Masalan: Anvarov Sanjar" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400/60 dark:text-white text-gray-900 shadow-inner"
                  value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefon Raqami <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="+998" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400/60 dark:text-white text-gray-900 shadow-inner"
                  value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Kurs <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select required className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none appearance-none transition-all cursor-pointer text-gray-900 dark:text-white shadow-inner"
                    value={newLead.course} onChange={e => setNewLead({ ...newLead, course: e.target.value })}>
                    <option value="" disabled>Tanlang</option>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <ArrowRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
                </div>
              </div>
              
              <div className="pt-10 flex items-center justify-end gap-5 mt-6 border-t border-dashed border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                  Bekor Qilish
                </button>
                <button type="submit" className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20">
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
