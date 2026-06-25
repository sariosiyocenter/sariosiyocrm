import React, { useState, useEffect } from 'react';
import { 
  Send, FileText, Settings, History, Search, RefreshCw, Zap, CheckCircle, 
  XCircle, Clock, Filter, Plus, Trash2, Edit, AlertCircle, HelpCircle, User, Info, Check, MessageSquare
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';

interface Student {
  id: number;
  name: string;
  phone: string;
  birthDate: string;
  status: string;
  balance: number;
  gender: string;
  telegramId?: string | null;
  fatherPhone?: string | null;
  motherPhone?: string | null;
  groups: any[];
}

interface MessageTemplate {
  id: number;
  name: string;
  body: string;
  category: string;
}

interface MessageCampaign {
  id: number;
  message: string;
  channel: string;
  recipientTo: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

interface SmsLog {
  id: number;
  toPhone: string;
  toName?: string | null;
  message: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  type: string;
  errorMsg?: string | null;
  channel: string;
  campaignId?: number | null;
  sentAt: string;
}

interface AutoRule {
  id?: number;
  type: 'BIRTHDAY' | 'DEBT_REMINDER';
  enabled: boolean;
  body: string;
  channel: 'SMS' | 'TELEGRAM' | 'BOTH';
  recipientTo: 'PARENT' | 'STUDENT';
  config?: {
    dayOfMonth?: number;
    minDebt?: number;
  } | null;
}

export default function Messaging() {
  const { t } = useLang();
  const { students, groups, courses, selectedSchoolId, schools } = useCRM();
  
  const [activeTab, setActiveTab] = useState<'new' | 'templates' | 'auto' | 'history'>('new');
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Tab 1: New Message state
  const [filters, setFilters] = useState({
    status: 'all',
    groupId: 'all',
    courseId: 'all',
    gender: 'all',
    balanceType: 'all', // all, debtors, advance
    minDebt: 0,
    birthday: 'all', // all, today, week, month
    contact: 'all', // all, phone, telegram
  });
  
  const [channel, setChannel] = useState<'SMS' | 'TELEGRAM' | 'BOTH'>('SMS');
  const [recipientTo, setRecipientTo] = useState<'PARENT' | 'STUDENT'>('PARENT');
  const [messageText, setMessageText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [showRecipientListModal, setShowRecipientListModal] = useState(false);
  
  // Tab 2: Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', body: '', category: 'Umumiy' });
  
  // Tab 3: Auto Rules state
  const [rules, setRules] = useState<AutoRule[]>([
    { type: 'BIRTHDAY', enabled: false, body: '', channel: 'BOTH', recipientTo: 'PARENT' },
    { type: 'DEBT_REMINDER', enabled: false, body: '', channel: 'BOTH', recipientTo: 'PARENT', config: { dayOfMonth: 1, minDebt: 0 } }
  ]);
  const [savingRuleType, setSavingRuleType] = useState<string | null>(null);
  
  // Tab 4: History state
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [statusLogFilter, setStatusLogFilter] = useState('all');
  
  // CSS Classes
  const inp = "w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all";
  const lbl = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const btnPrimary = "flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50";
  const btnSecondary = "flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer";
  const btnDanger = "flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer";
  const btnOutline = "flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider transition-all cursor-pointer";

  useEffect(() => {
    fetchTemplates();
    fetchCampaigns();
    fetchRules();
    fetchLogs();
  }, [selectedSchoolId]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/messaging/templates', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setTemplates(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/messaging/campaigns', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setCampaigns(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/messaging/auto-rules', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        const updatedRules = rules.map(r => {
          const match = data.find((d: any) => d.type === r.type);
          return match ? { ...r, ...match } : r;
        });
        setRules(updatedRules);
      }
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await fetch('/api/sms/logs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
  };

  const handleTestConnection = async () => {
    try {
      const res = await fetch('/api/sms/test-connection', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        alert("Eskiz API muvaffaqiyatli bog'landi! Token boshlanishi: " + data.token.substring(0, 10) + "...");
      } else {
        alert("Bog'lanishda xato: " + data.error);
      }
    } catch (err: any) {
      alert("Bog'lanishda xato: " + err.message);
    }
  };

  const handleCheckStatus = async (id: number) => {
    try {
      const res = await fetch(`/api/sms/check-status/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const updatedLog = await res.json();
      setLogs(prev => prev.map(log => log.id === id ? updatedLog : log));
      if (updatedLog.status === 'SENT') {
        alert("Xabar yetkazildi!");
      } else {
        try {
          const err = JSON.parse(updatedLog.errorMsg || '{}');
          alert("Holat: " + (err.message || updatedLog.status));
        } catch (e) {
          alert("Holat: " + updatedLog.status);
        }
      }
    } catch (err: any) {
      alert("Statusni tekshirishda xatolik: " + err.message);
    }
  };

  // Helper: Resolve Phone number like backend
  const resolveRecipientPhone = (st: Student, target: string = recipientTo) => {
    if (target === 'STUDENT') return st.phone;
    if (target === 'FATHER') return st.fatherPhone || st.phone;
    if (target === 'MOTHER') return st.motherPhone || st.phone;
    return st.fatherPhone || st.motherPhone || st.phone;
  };

  // Filter student list client-side based on filter panel
  const getFilteredStudents = (): Student[] => {
    const list = (students || []) as Student[];
    return list.filter(st => {
      // School check
      if (selectedSchoolId !== 0 && st.schoolId !== selectedSchoolId) return false;
      
      // Status
      if (filters.status !== 'all' && st.status !== filters.status) return false;
      
      // Course
      if (filters.courseId !== 'all') {
        const hasCourse = (st.groups || []).some(g => {
          const groupIdVal = typeof g === 'object' && g !== null ? g.id : Number(g);
          const groupRel = (groups || []).find(gr => gr.id === groupIdVal);
          return groupRel?.courseId === Number(filters.courseId);
        });
        if (!hasCourse) return false;
      }

      // Group
      if (filters.groupId !== 'all') {
        const hasGroup = (st.groups || []).some(g => {
          const groupIdVal = typeof g === 'object' && g !== null ? g.id : Number(g);
          return groupIdVal === Number(filters.groupId);
        });
        if (!hasGroup) return false;
      }

      // Gender
      if (filters.gender !== 'all' && st.gender !== filters.gender) return false;

      // Balance
      const bal = Number(st.balance || 0);
      if (filters.balanceType === 'debtors') {
        if (bal >= -Number(filters.minDebt)) return false;
      } else if (filters.balanceType === 'advance') {
        if (bal <= 0) return false;
      }

      // Birthday
      if (filters.birthday !== 'all') {
        if (!st.birthDate) return false;
        try {
          const birth = new Date(st.birthDate);
          const today = new Date();
          if (isNaN(birth.getTime())) return false;
          
          if (filters.birthday === 'today') {
            if (birth.getMonth() !== today.getMonth() || birth.getDate() !== today.getDate()) return false;
          } else if (filters.birthday === 'week') {
            const birthDayOfYear = getDayOfYear(birth);
            const todayDayOfYear = getDayOfYear(today);
            const diff = Math.abs(birthDayOfYear - todayDayOfYear);
            if (diff > 7) return false;
          } else if (filters.birthday === 'month') {
            if (birth.getMonth() !== today.getMonth()) return false;
          }
        } catch (_) { return false; }
      }

      // Contact Type
      if (filters.contact === 'phone') {
        if (!st.phone && !st.fatherPhone && !st.motherPhone) return false;
      } else if (filters.contact === 'telegram') {
        if (!st.telegramId) return false;
      }

      return true;
    });
  };

  const getDayOfYear = (d: Date) => {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  const filteredRecipients = getFilteredStudents();

  // Character Counter and SMS Parts calculator
  const getSmsPartInfo = (text: string) => {
    const len = text.length;
    // Check if Unicode (contains cyrillic characters or custom symbols)
    const isUnicode = /[^\u0000-\u007F]/.test(text);
    let parts = 1;
    let limit = isUnicode ? 70 : 160;
    
    if (len > limit) {
      const multiLimit = isUnicode ? 67 : 153;
      parts = Math.ceil(len / multiLimit);
    }
    
    return {
      length: len,
      isUnicode,
      parts,
      limit
    };
  };

  const charInfo = getSmsPartInfo(messageText);

  // Template placeholders replacement mockup for Preview panel
  const getPersonalizedPreview = () => {
    if (filteredRecipients.length === 0) return "O'quvchilar ro'yxati bo'sh. Filtrni tekshiring.";
    const st = filteredRecipients[0];
    const balance = Number(st.balance || 0);
    const debt = balance < 0 ? Math.abs(balance) : 0;
    const groupNames = (st.groups || [])
      .map(g => {
        const groupIdVal = typeof g === 'object' && g !== null ? g.id : Number(g);
        return (groups || []).find(gr => gr.id === groupIdVal)?.name;
      })
      .filter(Boolean)
      .join(', ') || 'Noma\'lum Guruh';
    const schoolName = schools.find(s => s.id === (selectedSchoolId || st.schoolId))?.name || 'Quantum Edu';

    return messageText
      .replace(/\{ism\}/gi, st.name)
      .replace(/\{qarz\}/gi, debt.toLocaleString() + " so'm")
      .replace(/\{balans\}/gi, balance.toLocaleString() + " so'm")
      .replace(/\{guruh\}/gi, groupNames)
      .replace(/\{markaz\}/gi, schoolName);
  };

  const insertVariable = (variable: string) => {
    setMessageText(prev => prev + variable);
  };

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const temp = templates.find(t => t.id === Number(id));
    if (temp) setMessageText(temp.body);
  };

  // Send batch request
  const handleSendBatch = async () => {
    if (filteredRecipients.length === 0) return;
    setIsSending(true);
    setConfirmModalOpen(false);
    try {
      const studentIds = filteredRecipients.map(r => r.id);
      const res = await fetch('/api/messaging/send-batch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          studentIds,
          message: messageText,
          channel,
          recipientTo,
          filters
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Kampaniya boshlandi! Muvaffaqiyatli: ${data.sentCount}, Xato: ${data.failedCount}`);
        setMessageText('');
        setSelectedTemplateId('');
        fetchCampaigns();
        fetchLogs();
      } else {
        alert("Xato: " + (data.error || "Kampaniyani yuborib bo'lmadi"));
      }
    } catch (e: any) {
      alert("Xatolik yuz berdi: " + e.message);
    } finally {
      setIsSending(false);
    }
  };

  // Rule Save handler
  const handleSaveRule = async (rule: AutoRule) => {
    setSavingRuleType(rule.type);
    try {
      const res = await fetch(`/api/messaging/auto-rules/${rule.type}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(rule)
      });
      if (res.ok) {
        alert("Avtomatik qoida muvaffaqiyatli saqlandi!");
        fetchRules();
      } else {
        const err = await res.json();
        alert("Xatolik: " + err.error);
      }
    } catch (e: any) {
      alert("Xato: " + e.message);
    } finally {
      setSavingRuleType(null);
    }
  };

  // Template Modal Form actions
  const openTemplateModal = (t: MessageTemplate | null = null) => {
    if (t) {
      setEditingTemplate(t);
      setTemplateForm({ name: t.name, body: t.body, category: t.category });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', body: '', category: 'Umumiy' });
    }
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.body.trim()) return;
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate ? `/api/messaging/templates/${editingTemplate.id}` : '/api/messaging/templates';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(templateForm)
      });
      if (res.ok) {
        setTemplateModalOpen(false);
        fetchTemplates();
      } else {
        const err = await res.json();
        alert("Xatolik: " + err.error);
      }
    } catch (err: any) {
      alert("Xatolik yuz berdi: " + err.message);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Haqiqatan ham bu shablonni o'chirmoqchisiz?")) return;
    try {
      const res = await fetch(`/api/messaging/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchTemplates();
    } catch (e: any) { alert("Xatolik: " + e.message); }
  };

  // History Tab: Filter logs by selected campaign ID
  const getFilteredLogs = () => {
    return logs.filter(log => {
      const matchesCampaign = selectedCampaignId === null || log.campaignId === selectedCampaignId;
      const sQuery = searchLogQuery.trim().toLowerCase();
      const matchesSearch = !sQuery || 
        log.toPhone.includes(sQuery) || 
        (log.toName || '').toLowerCase().includes(sQuery) || 
        log.message.toLowerCase().includes(sQuery);
      const matchesStatus = statusLogFilter === 'all' || log.status.toLowerCase() === statusLogFilter.toLowerCase();
      return matchesCampaign && matchesSearch && matchesStatus;
    });
  };

  const displayLogs = getFilteredLogs();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            {t('nav_messaging')}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
            O'quvchilar va ota-onalarga ommaviy SMS va Telegram xabarnomalar moduli
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-55 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-100 dark:border-slate-700/50">
          <button 
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'new' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Yangi xabar
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'templates' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Shablonlar
          </button>
          <button 
            onClick={() => setActiveTab('auto')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'auto' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Avtomatik
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Tarix
          </button>
        </div>
      </div>

      {/* ===== TAB 1: NEW MESSAGE ===== */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Filters (4 Cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-dashed border-slate-100 dark:border-slate-800 pb-3">
              <Filter className="w-4 h-4 text-indigo-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Qabul qiluvchi filtrlari</h2>
            </div>
            
            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>O'quvchi statusi</label>
                <select
                  value={filters.status}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}
                  className={inp}
                >
                  <option value="all">Barchasi</option>
                  <option value="Faol">Faol</option>
                  <option value="Sinov">Sinov</option>
                  <option value="Muzlatilgan">Muzlatilgan</option>
                  <option value="Ketgan">Ketgan</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Kurs bo'yicha</label>
                <select
                  value={filters.courseId}
                  onChange={e => setFilters({ ...filters, courseId: e.target.value, groupId: 'all' })}
                  className={inp}
                >
                  <option value="all">Barcha kurslar</option>
                  {(courses || []).filter(c => c.name !== 'birinchi').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className={lbl}>Guruh bo'yicha</label>
                <select
                  value={filters.groupId}
                  onChange={e => setFilters({ ...filters, groupId: e.target.value })}
                  className={inp}
                >
                  <option value="all">Barcha guruhlar</option>
                  {(groups || []).filter(g => filters.courseId === 'all' || g.courseId === Number(filters.courseId)).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}>Balans holati</label>
                <select
                  value={filters.balanceType}
                  onChange={e => setFilters({ ...filters, balanceType: e.target.value })}
                  className={inp}
                >
                  <option value="all">Barchasi</option>
                  <option value="debtors">Qarzdorlar</option>
                  <option value="advance">Avansdagi o'quvchilar</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Minimal qarz summasi</label>
                <input
                  type="number"
                  disabled={filters.balanceType !== 'debtors'}
                  placeholder="Summa..."
                  value={filters.minDebt}
                  onChange={e => setFilters({ ...filters, minDebt: Number(e.target.value) })}
                  className={inp}
                />
              </div>

              <div>
                <label className={lbl}>Tug'ilgan kun</label>
                <select
                  value={filters.birthday}
                  onChange={e => setFilters({ ...filters, birthday: e.target.value })}
                  className={inp}
                >
                  <option value="all">Filtrsiz</option>
                  <option value="today">Bugun tug'ilganlar</option>
                  <option value="week">Shu hafta tug'ilganlar</option>
                  <option value="month">Shu oy tug'ilganlar</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Aloqa kanali</label>
                <select
                  value={filters.contact}
                  onChange={e => setFilters({ ...filters, contact: e.target.value })}
                  className={inp}
                >
                  <option value="all">Filtrsiz</option>
                  <option value="phone">Telefoni borlar</option>
                  <option value="telegram">TelegramId ulanganlar</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Jinsi</label>
                <select
                  value={filters.gender}
                  onChange={e => setFilters({ ...filters, gender: e.target.value })}
                  className={inp}
                >
                  <option value="all">Barchasi</option>
                  <option value="Erkak">Erkak</option>
                  <option value="Ayol">Ayol</option>
                </select>
              </div>
            </div>

            {/* Recipient list inline */}
            <div className="space-y-3 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  Tanlangan qabul qiluvchilar ({filteredRecipients.length} ta)
                </h4>
              </div>

              {filteredRecipients.length > 0 ? (
                <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/80 pr-1 border border-slate-100 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/40 dark:bg-slate-950/20">
                  {filteredRecipients.map(st => {
                    const balance = Number(st.balance || 0);
                    const isDebtor = balance < 0;
                    return (
                      <div key={st.id} className="py-2.5 flex items-center justify-between text-[11px] hover:bg-white dark:hover:bg-slate-800/40 px-2 rounded-xl transition-all">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black uppercase ${
                            st.gender === 'Ayol' ? 'bg-pink-100 dark:bg-pink-950/30 text-pink-500' : 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-500'
                          }`}>
                            {st.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{st.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                              {resolveRecipientPhone(st, recipientTo) || 'Raqam kiritilmagan'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-right">
                          <span className={`text-[9px] font-bold tabular-nums ${isDebtor ? 'text-rose-500' : balance > 0 ? 'text-emerald-500' : 'text-slate-450'}`}>
                            {balance.toLocaleString()} s.
                          </span>
                          {st.telegramId ? (
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/25 text-sky-500 border border-sky-100/40 dark:border-sky-900/25">TG</span>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/25 text-purple-500 border border-purple-100/40 dark:border-purple-900/25">SMS</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center bg-slate-50/40 dark:bg-slate-950/20 text-[10px] font-bold uppercase tracking-wider text-slate-405 dark:text-slate-505">
                  Filtr bo'yicha o'quvchi topilmadi
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Campaign Builder (7 Cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-dashed border-slate-100 dark:border-slate-800 pb-3">
              <Send className="w-4 h-4 text-indigo-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Xabar yuborish paneli</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Jo'natish kanali</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-55 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <button 
                    onClick={() => setChannel('SMS')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${channel === 'SMS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    SMS
                  </button>
                  <button 
                    onClick={() => setChannel('TELEGRAM')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${channel === 'TELEGRAM' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Telegram
                  </button>
                  <button 
                    onClick={() => setChannel('BOTH')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${channel === 'BOTH' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Ikkalasi
                  </button>
                </div>
              </div>

              <div>
                <label className={lbl}>Qabul qiluvchi tomon</label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-55 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <button 
                    onClick={() => setRecipientTo('STUDENT')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${recipientTo === 'STUDENT' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    O'quvchi
                  </button>
                  <button 
                    onClick={() => setRecipientTo('FATHER')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${recipientTo === 'FATHER' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Otasi
                  </button>
                  <button 
                    onClick={() => setRecipientTo('MOTHER')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${recipientTo === 'MOTHER' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Onasi
                  </button>
                  <button 
                    onClick={() => setRecipientTo('PARENT')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${recipientTo === 'PARENT' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Ota-ona
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Fallback Warning */}
            {(channel === 'TELEGRAM' || channel === 'BOTH') && (
              <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/40 p-3.5 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold leading-normal">
                  <span className="uppercase font-black text-amber-600 block mb-0.5">Zaxira mantiqi (Smart Fallback):</span>
                  Tanlangan qabul qiluvchilar orasida Telegram ulagichini faollashtirmagan o'quvchilarga xabar avtomatik ravishda **SMS kanali** orqali yuboriladi.
                </div>
              </div>
            )}

            {/* Template select dropdown */}
            <div>
              <label className={lbl}>Shablondan foydalanish</label>
              <select
                value={selectedTemplateId}
                onChange={e => handleTemplateChange(e.target.value)}
                className={inp}
              >
                <option value="">-- Erkin matn yozish --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            </div>

            {/* Variable Injectors */}
            <div>
              <label className={lbl}>O'zgaruvchi qo'shish</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => insertVariable('{ism}')} className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">ism</button>
                <button type="button" onClick={() => insertVariable('{qarz}')} className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">qarz</button>
                <button type="button" onClick={() => insertVariable('{balans}')} className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">balans</button>
                <button type="button" onClick={() => insertVariable('{guruh}')} className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">guruh</button>
                <button type="button" onClick={() => insertVariable('{markaz}')} className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">markaz</button>
              </div>
            </div>

            {/* Message input */}
            <div>
              <label className={lbl}>Xabar matni</label>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={5}
                placeholder="Xabar matnini bu yerga yozing..."
                className="w-full px-4 py-3 bg-slate-55 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
              />
              
              {/* Length statistics */}
              <div className="flex justify-between items-center mt-2 px-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <span>Kodlash: {charInfo.isUnicode ? 'Unicode (Kirill)' : 'GSM-7 (Lotin)'}</span>
                <span>Belgilar: {charInfo.length} / SMS qismlari: {charInfo.parts}</span>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="bg-slate-55 dark:bg-slate-800/40 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                <FileText size={12} />
                <span>Birinchi o'quvchida shablon ko'rinishi (Preview)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {getPersonalizedPreview()}
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                disabled={filteredRecipients.length === 0 || !messageText.trim() || isSending}
                className={btnPrimary}
              >
                {isSending ? 'Yuborilmoqda...' : `Kampaniyani boshlash (${filteredRecipients.length} ta)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB 2: TEMPLATES ===== */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Shablonlar kutubxonasi</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Xabarlar yozishda vaqtni tejash uchun tayyor andozalar</p>
            </div>
            <button onClick={() => openTemplateModal(null)} className={btnPrimary}>
              <Plus size={14} />
              Shablon yaratish
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(t => (
              <div key={t.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition-all group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                      {t.category}
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openTemplateModal(t)} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer">
                        <Edit size={13} />
                      </button>
                      <button onClick={() => handleDeleteTemplate(t.id)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-slate-850 dark:text-white">{t.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed line-clamp-4">
                    {t.body}
                  </p>
                </div>
                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                  O'zgaruvchilar bor
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center">
                <FileText className="w-8 h-8 text-slate-200 dark:text-slate-750 mx-auto mb-3" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hozircha shablonlar yaratilmagan</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB 3: AUTO RULES ===== */}
      {activeTab === 'auto' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Avtomatik yuborish qoidalari</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Tizim belgilangan kunlik qoidalar bo'yicha fonda SMS yoki Telegram tabriknoma va eslatmalarini jo'natadi</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {rules.map((rule, idx) => {
              const isBirthday = rule.type === 'BIRTHDAY';
              return (
                <div key={rule.type} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
                  {/* Card Title */}
                  <div className="flex items-center justify-between border-b border-dashed border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isBirthday ? 'bg-pink-50 dark:bg-pink-950/20 text-pink-500' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-500'}`}>
                        {isBirthday ? '🎂' : '💸'}
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                          {isBirthday ? 'Tug\'ilgan kun tabrigi' : 'Qarzdorlik eslatmasi'}
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {isBirthday ? 'BIRTHDAY RULE' : 'DEBT REMINDER RULE'}
                        </p>
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <button
                      onClick={() => {
                        const updated = [...rules];
                        updated[idx].enabled = !rule.enabled;
                        setRules(updated);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${rule.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Channel selectors */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Jo'natish kanali</label>
                      <select
                        value={rule.channel}
                        onChange={e => {
                          const updated = [...rules];
                          updated[idx].channel = e.target.value as any;
                          setRules(updated);
                        }}
                        className={inp}
                      >
                        <option value="SMS">Faqat SMS</option>
                        <option value="TELEGRAM">Faqat Telegram</option>
                        <option value="BOTH">Telegram va SMS</option>
                      </select>
                    </div>

                    <div>
                      <label className={lbl}>Qabul qiluvchi</label>
                      <select
                        value={rule.recipientTo}
                        onChange={e => {
                          const updated = [...rules];
                          updated[idx].recipientTo = e.target.value as any;
                          setRules(updated);
                        }}
                        className={inp}
                      >
                        <option value="PARENT">Ota-onasi</option>
                        <option value="STUDENT">O'quvchining o'zi</option>
                      </select>
                    </div>
                  </div>

                  {/* Rule Specific Settings */}
                  {!isBirthday && rule.config && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-55 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <div>
                        <label className={lbl}>Oylik jo'natish kuni</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={rule.config.dayOfMonth || 1}
                          onChange={e => {
                            const updated = [...rules];
                            updated[idx].config = { ...rule.config, dayOfMonth: Number(e.target.value) };
                            setRules(updated);
                          }}
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={lbl}>Minimal qarz summasi</label>
                        <input
                          type="number"
                          value={rule.config.minDebt || 0}
                          onChange={e => {
                            const updated = [...rules];
                            updated[idx].config = { ...rule.config, minDebt: Number(e.target.value) };
                            setRules(updated);
                          }}
                          className={inp}
                        />
                      </div>
                    </div>
                  )}

                  {/* Rule body text */}
                  <div>
                    <label className={lbl}>Xabar shabloni matni</label>
                    <textarea
                      value={rule.body}
                      onChange={e => {
                        const updated = [...rules];
                        updated[idx].body = e.target.value;
                        setRules(updated);
                      }}
                      rows={4}
                      placeholder="Qolip matnini kiriting..."
                      className="w-full px-4 py-3 bg-slate-55 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-indigo-500 transition-all resize-none"
                    />
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5">
                      O'zgaruvchilar: `{"{ism}"}`, `{"{qarz}"}`, `{"{balans}"}`, `{"{guruh}"}`, `{"{markaz}"}`
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => handleSaveRule(rule)}
                      disabled={savingRuleType === rule.type}
                      className={btnPrimary}
                    >
                      {savingRuleType === rule.type ? 'Saqlanmoqda...' : 'Qoidani saqlash'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== TAB 4: HISTORY ===== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Header statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jami loglar</span>
              <p className="text-xl font-black text-slate-800 dark:text-white mt-1 tabular-nums">{logs.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Muvaffaqiyatli</span>
              <p className="text-xl font-black text-emerald-500 mt-1 tabular-nums">{logs.filter(l => l.status === 'SENT').length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Xatolik yuz bergan</span>
              <p className="text-xl font-black text-rose-500 mt-1 tabular-nums">{logs.filter(l => l.status === 'FAILED').length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kutilmoqda (Pending)</span>
              <p className="text-xl font-black text-amber-500 mt-1 tabular-nums">{logs.filter(l => l.status === 'PENDING').length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Campaign History list (5 Cols) */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-dashed border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Ommaviy kampaniyalar</h3>
                {selectedCampaignId !== null && (
                  <button onClick={() => setSelectedCampaignId(null)} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline cursor-pointer">Filtrni ochish</button>
                )}
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {campaigns.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${selectedCampaignId === c.id ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60 shadow-sm' : 'bg-slate-55 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/50 dark:hover:bg-slate-750'}`}
                  >
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      <span className="bg-indigo-50 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded text-indigo-650">{c.channel}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-350 font-semibold mt-1.5 line-clamp-2 leading-relaxed">
                      {c.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-dashed border-slate-200/50 dark:border-slate-700/50 text-[10px] font-bold text-slate-500 tabular-nums">
                      <span>Jami: {c.totalCount}</span>
                      <span className="text-emerald-550">Yuborildi: {c.sentCount}</span>
                      <span className="text-rose-550">Xato: {c.failedCount}</span>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    Kampaniyalar tarixi bo'sh.
                  </div>
                )}
              </div>
            </div>

            {/* Individual logs grid (8 Cols) */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Header actions */}
              <div className="p-5 flex flex-col md:flex-row gap-4 justify-between items-center border-b border-dashed border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Xabar yuborish jurnali</h3>
                  {selectedCampaignId !== null && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                      Kampaniya #{selectedCampaignId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleTestConnection}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  >
                    <Zap size={12} />
                    Ulanishni tekshirish
                  </button>
                  <button 
                    onClick={fetchLogs}
                    className="p-1.5 bg-slate-55 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-450 hover:text-indigo-500 rounded-lg transition-colors cursor-pointer"
                    disabled={logsLoading}
                  >
                    <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table search filters */}
              <div className="p-4 bg-slate-55 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Qidiruv (telefon, xabar matni)..."
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <Filter size={14} className="text-slate-400" />
                  <select 
                    value={statusLogFilter}
                    onChange={e => setStatusLogFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-indigo-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="all">Barcha holatlar</option>
                    <option value="sent">Muvaffaqiyatli</option>
                    <option value="failed">Xatolik</option>
                    <option value="pending">Kutilmoqda</option>
                  </select>
                </div>
              </div>

              {/* Table wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-55 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800">
                      <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Sana</th>
                      <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Qabul qiluvchi</th>
                      <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Kanal</th>
                      <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Xabar matni</th>
                      <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all text-slate-700 dark:text-slate-300">
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-850 dark:text-white tabular-nums">
                              {new Date(log.sentAt).toLocaleDateString()}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                              {new Date(log.sentAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-slate-850 dark:text-white">{log.toName || 'Noma\'lum'}</span>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{log.toPhone}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${log.channel === 'TELEGRAM' ? 'bg-sky-50 dark:bg-sky-950/20 text-sky-500' : 'bg-purple-50 dark:bg-purple-950/20 text-purple-500'}`}>
                            {log.channel}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="text-[11px] text-slate-650 dark:text-slate-350 max-w-sm line-clamp-2 leading-relaxed" title={log.message}>
                            {log.message}
                          </p>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {log.status === 'SENT' ? (
                              <div className="inline-flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                                <CheckCircle size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">OK</span>
                              </div>
                            ) : log.status === 'FAILED' ? (
                              <div 
                                className="inline-flex items-center gap-1 text-rose-500 bg-rose-50 dark:bg-rose-955/20 px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900/30 cursor-help"
                                title={log.errorMsg || 'Xatolik'}
                              >
                                <XCircle size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">XATO</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-955/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30">
                                <Clock size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">KUTISH</span>
                              </div>
                            )}

                            {log.channel === 'SMS' && log.eskizId && (
                              <button 
                                onClick={() => handleCheckStatus(log.id)}
                                className="p-1 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                                title="Eskiz holatini tekshirish"
                              >
                                <RefreshCw size={10} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-16 text-center text-slate-400">
                          Hech qanday jurnal yozuvi topilmadi.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: CONFIRM SEND BATCH ===== */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Kampaniyani tasdiqlaysizmi?</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Ushbu xabar **{filteredRecipients.length} ta** o'quvchi/ota-onaga **{channel === 'BOTH' ? 'SMS va Telegram' : channel}** kanali orqali yuboriladi. SMS jo'natish xizmati Eskiz hisobidan mablag' yechadi.
              </p>
            </div>

            <div className="bg-slate-55 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <span className={lbl}>Xabar shablon ko'rinishi</span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-350 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                {getPersonalizedPreview()}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmModalOpen(false)} className={btnSecondary}>
                Bekor qilish
              </button>
              <button onClick={handleSendBatch} className={btnPrimary}>
                Ha, yuborilsin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: RECIPIENT LIST ===== */}
      {showRecipientListModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowRecipientListModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-dashed border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Qabul qiluvchilar ro'yxati</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">{filteredRecipients.length} ta</span>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {filteredRecipients.map(st => (
                <div key={st.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-850 dark:text-white">{st.name}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5 tabular-nums">
                      Tel: {resolveRecipientPhone(st, recipientTo) || 'Raqam kiritilmagan'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {st.telegramId ? (
                      <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/20 text-sky-500 border border-sky-100 dark:border-sky-900/30">Telegram</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/20 text-purple-500 border border-purple-100 dark:border-purple-900/30">SMS Faqat</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setShowRecipientListModal(false)} className={btnSecondary}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: CREATE/EDIT TEMPLATE ===== */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setTemplateModalOpen(false)} />
          <form onSubmit={handleSaveTemplate} className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">
              {editingTemplate ? 'Shablonni tahrirlash' : 'Yangi shablon yaratish'}
            </h3>

            <div>
              <label className={lbl}>Shablon nomi *</label>
              <input
                type="text"
                required
                placeholder="Masalan: To'lov eslatmasi"
                value={templateForm.name}
                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                className={inp}
              />
            </div>

            <div>
              <label className={lbl}>Tur (Kategoriya)</label>
              <select
                value={templateForm.category}
                onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                className={inp}
              >
                <option value="Umumiy">Umumiy</option>
                <option value="Qarzdorlik">Qarzdorlik</option>
                <option value="Tug'ilgan kun">Tug'ilgan kun</option>
                <option value="Eslatma">Eslatma</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Shablon matni *</label>
              <textarea
                required
                rows={5}
                placeholder="Hurmatli {ism}, ..."
                value={templateForm.body}
                onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })}
                className="w-full px-3 py-2 bg-slate-55 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all resize-none"
              />
              <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                O'zgaruvchilar: `{"{ism}"}`, `{"{qarz}"}`, `{"{balans}"}`, `{"{guruh}"}`, `{"{markaz}"}`
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setTemplateModalOpen(false)} className={btnSecondary}>
                Bekor qilish
              </button>
              <button type="submit" className={btnPrimary}>
                Saqlash
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
