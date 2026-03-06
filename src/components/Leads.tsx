import React, { useState } from 'react';
import { MoreHorizontal, Plus, Search, Filter, Calendar, Phone, MessageSquare, X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { Lead } from '../types';

const STAGES = [
  { id: 'yangi', name: 'Yangi', color: '#5C67F2' },
  { id: 'boglanilmadi', name: "Bog'lanilmadi", color: '#F59E0B' },
  { id: 'oylayapti', name: "O'ylayapti", color: '#10B981' },
  { id: 'kelishdi', name: 'Kelishdi', color: '#8B5CF6' },
  { id: 'tolov_qildi', name: "To'lov qildi", color: '#EF4444' },
] as const;



export default function Leads() {
  const { leads, courses, updateLead, addLead } = useCRM();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', course: '', source: 'Instagram' });

  const getLeadsByStatus = (status: string) => leads.filter(lead => lead.status === status);

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    addLead({ ...newLead, status: 'Yangi', course: newLead.course || (courses.length > 0 ? courses[0].name : '') });
    setIsModalOpen(false);
    setNewLead({ name: '', phone: '', course: '', source: 'Instagram' });
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Lidlar (Voronka)</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Qidirish..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#5C67F2] text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Yangi lid
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map(stage => (
            <div key={stage.id} className="w-72 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200/60 p-3 h-full">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }}></div>
                  <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">{stage.name}</h3>
                  <span className="bg-white border border-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-1">
                    {getLeadsByStatus(stage.name).length}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto min-h-[100px]">
                {getLeadsByStatus(stage.name).map(lead => (
                  <div key={lead.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                        {lead.course}
                      </span>
                      <select
                        className="text-[10px] bg-slate-50 border-none outline-none text-slate-400 font-bold uppercase cursor-pointer hover:text-indigo-500"
                        value={lead.status}
                        onChange={(e) => updateLead(lead.id, e.target.value as any)}
                      >
                        {STAGES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <h4 className="font-bold text-slate-800 text-[15px] mb-1">{lead.name}</h4>
                    <div className="flex flex-col gap-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        <span>{lead.source}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Qo'shish
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Yangi lid qo'shish</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ism familiya</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telefon</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Kurs</label>
                <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLead.course} onChange={e => setNewLead({ ...newLead, course: e.target.value })}>
                  <option value="">Tanlang</option>
                  {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-[#5C67F2] text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-all">
                SAQLASH
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
