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
  fatherName?: string | null;
  fatherPhone?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
  groups: any[];
  schoolId?: number;
}

interface MessageTemplate {
  id: number;
  name: string;
  body: string;
  category: string;
  isAuto: boolean;
  autoType?: 'BIRTHDAY' | 'DEBT_REMINDER' | null;
  autoChannel: 'SMS' | 'TELEGRAM' | 'BOTH';
  autoRecipient: 'PARENT' | 'STUDENT';
  autoConfig?: { dayOfMonth?: number; minDebt?: number } | null;
  autoTime?: string | null;
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
  eskizId?: string | null;
}

interface AutoRule {
  id?: number;
  name: string;
  type: string;
  enabled: boolean;
  body: string;
  channel: 'SMS' | 'TELEGRAM' | 'BOTH';
  recipientTo: 'PARENT' | 'STUDENT';
  time: string;
  config?: {
    dayOfMonth?: number;
    minDebt?: number;
  } | null;
}

const getTriggerTypeMeta = (type: string) => {
  switch (type) {
    case 'BIRTHDAY':
      return { icon: '🎂', label: "Tug'ilgan kun", color: 'bg-pink-100 dark:bg-pink-950/30 text-pink-500' };
    case 'DEBT_REMINDER':
      return { icon: '💸', label: 'Qarzdorlik', color: 'bg-amber-100 dark:bg-amber-950/30 text-amber-500' };
    case 'ABSENCE_REMINDER':
      return { icon: '🚫', label: 'Dars qoldirish', color: 'bg-rose-100 dark:bg-rose-950/30 text-rose-500' };
    case 'LEAD_WELCOME':
      return { icon: '📞', label: 'Yangi lid', color: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500' };
    case 'GROUP_WELCOME':
      return { icon: '🎉', label: "Guruhga qo'shilish", color: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-500' };
    case 'EXAM_RESULT':
      return { icon: '📝', label: 'Imtihon natijasi', color: 'bg-blue-100 dark:bg-blue-950/30 text-blue-500' };
    case 'PAYMENT_CONFIRM':
      return { icon: '💰', label: "To'lov tasdig'i", color: 'bg-teal-100 dark:bg-teal-950/30 text-teal-500' };
    case 'DAILY_SCORE':
      return { icon: '⭐️', label: 'Kunlik baho', color: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-500' };
    case 'TRANSPORT_NOTIFY':
      return { icon: '🚌', label: 'Transport', color: 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-500' };
    case 'COURSE_GRADUATION':
      return { icon: '🎓', label: 'Kurs bitiruvi', color: 'bg-violet-100 dark:bg-violet-950/30 text-violet-500' };
    case 'LATE_ARRIVAL':
      return { icon: '⏰', label: 'Kechikib keldi', color: 'bg-orange-100 dark:bg-orange-950/30 text-orange-500' };
    case 'EARLY_LEAVE':
      return { icon: '🚪', label: 'Erta ketdi', color: 'bg-purple-100 dark:bg-purple-950/30 text-purple-500' };
    default:
      return { icon: '⚙️', label: 'Boshqa', color: 'bg-slate-100 dark:bg-slate-950/30 text-slate-500' };
  }
};

export default function Messaging() {
  const { t } = useLang();
  const { students, groups, courses, selectedSchoolId, schools, teachers, users } = useCRM();

  const [activeTab, setActiveTab] = useState<'new' | 'templates' | 'auto' | 'history'>('new');
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [audience, setAudience] = useState<'STUDENTS' | 'TEACHERS' | 'STAFF'>('STUDENTS');

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
  const [useSmsFallback, setUseSmsFallback] = useState(true);
  const [recipientTo, setRecipientTo] = useState<'PARENT' | 'STUDENT' | 'FATHER' | 'MOTHER'>('PARENT');
  const [messageText, setMessageText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [showRecipientListModal, setShowRecipientListModal] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Record<string, boolean>>({});

  // Tab 2: Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    body: '',
    category: 'Umumiy'
  });

  // Tab 3: Auto Rules state
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [autoRuleModalOpen, setAutoRuleModalOpen] = useState(false);
  const [editingAutoRule, setEditingAutoRule] = useState<AutoRule | null>(null);
  const [autoRuleForm, setAutoRuleForm] = useState({
    name: '',
    type: 'BIRTHDAY',
    enabled: true,
    body: '',
    channel: 'BOTH' as 'SMS' | 'TELEGRAM' | 'BOTH',
    recipientTo: 'PARENT' as 'PARENT' | 'STUDENT',
    time: '09:00',
    minDebt: 0,
    dayOfMonth: 1
  });

  // Tab 4: History state
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [statusLogFilter, setStatusLogFilter] = useState('all');

  // Resend and checkbox states
  const [selectedLogIds, setSelectedLogIds] = useState<Record<number, boolean>>({});
  const [resendingLogs, setResendingLogs] = useState(false);
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [resendStartDate, setResendStartDate] = useState(getTodayStr());
  const [resendEndDate, setResendEndDate] = useState(getTodayStr());

  const handleResendLogs = async (useRange = false) => {
    setResendingLogs(true);
    try {
      const payload: any = {};
      if (useRange) {
        payload.startDate = resendStartDate;
        payload.endDate = resendEndDate;
      } else {
        const selectedIds = Object.keys(selectedLogIds)
          .filter(id => selectedLogIds[Number(id)])
          .map(Number);
        if (selectedIds.length === 0) {
          alert("Qayta yuborish uchun kamida bitta xabarni tanlang!");
          setResendingLogs(false);
          return;
        }
        payload.logIds = selectedIds;
      }

      const res = await fetch('/api/sms/resend-failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Qayta jo'natish yakunlandi! Jami: ${data.total}, Muvaffaqiyatli: ${data.successCount}, Xato: ${data.failCount}`);
        setSelectedLogIds({});
        fetchLogs();
      } else {
        alert("Xatolik: " + (data.error || "Xabarlarni qayta jo'natib bo'lmadi"));
      }
    } catch (e: any) {
      alert("Xatolik: " + e.message);
    } finally {
      setResendingLogs(false);
    }
  };

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
      const res = await fetch(`/api/messaging/templates?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setTemplates(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`/api/messaging/campaigns?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setCampaigns(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`/api/messaging/auto-rules?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setRules(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await fetch(`/api/sms/logs?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
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
  const resolveRecipientPhone = (st: any, target: string = recipientTo) => {
    if (audience !== 'STUDENTS') {
      return st.phone || '';
    }
    if (target === 'STUDENT') return st.phone;
    if (target === 'FATHER') return st.fatherPhone || st.phone;
    if (target === 'MOTHER') return st.motherPhone || st.phone;
    return st.fatherPhone || st.motherPhone || st.phone;
  };

  // Filter recipient list client-side based on filter panel and chosen audience
  const getFilteredRecipients = (): any[] => {
    if (audience === 'TEACHERS') {
      const list = (teachers || []) as any[];
      return list.filter(item => {
        // School check
        if (selectedSchoolId !== 0 && item.schoolId !== selectedSchoolId) return false;

        // Status
        if (filters.status !== 'all' && item.status !== filters.status) return false;

        // Aloqa kanali
        if (filters.contact === 'phone' && !item.phone) return false;
        if (filters.contact === 'telegram' && !item.telegramId) return false;
        if (filters.contact === 'no_telegram' && item.telegramId) return false;

        return true;
      });
    }

    if (audience === 'STAFF') {
      const list = (users || []) as any[];
      return list.filter(item => {
        // School check
        if (selectedSchoolId !== 0 && item.schoolId !== selectedSchoolId) return false;

        // Aloqa kanali
        if (filters.contact === 'phone' && !item.phone) return false;
        if (filters.contact === 'telegram' && !item.telegramId) return false;
        if (filters.contact === 'no_telegram' && item.telegramId) return false;

        return true;
      });
    }

    const list = (students || []) as Student[];
    return list.filter(st => {
      // School check
      if (selectedSchoolId !== 0 && st.schoolId !== selectedSchoolId) return false;

      // Status
      if (filters.status === 'active_group') {
        if (!['Faol', 'Sinov'].includes(st.status)) return false;
      } else if (filters.status === 'passive_group') {
        if (!['Passiv', 'Ketgan'].includes(st.status)) return false;
      } else if (filters.status !== 'all' && st.status !== filters.status) return false;

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
        if (recipientTo === 'PARENT') {
          if (!st.fatherTelegramId && !st.motherTelegramId) return false;
        } else if (recipientTo === 'FATHER') {
          if (!st.fatherTelegramId) return false;
        } else if (recipientTo === 'MOTHER') {
          if (!st.motherTelegramId) return false;
        } else {
          if (!st.telegramId) return false;
        }
      } else if (filters.contact === 'no_telegram') {
        if (recipientTo === 'PARENT') {
          if (st.fatherTelegramId || st.motherTelegramId) return false;
        } else if (recipientTo === 'FATHER') {
          if (st.fatherTelegramId) return false;
        } else if (recipientTo === 'MOTHER') {
          if (st.motherTelegramId) return false;
        } else {
          if (st.telegramId) return false;
        }
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

  const filteredRecipients = getFilteredRecipients();
  const filteredRecipientsKey = filteredRecipients.map(r => r.id).join(',') + recipientTo;

  // Expanded recipient entries — in PARENT mode each student becomes 1-2 rows
  type RecipientEntry = {
    key: string;
    studentId: number;
    displayName: string;
    displayPhone: string | null | undefined;
    telegramId: string | null | undefined;
    balance: number;
    gender: string;
    entryType: 'STUDENT' | 'FATHER' | 'MOTHER';
  };

  const recipientEntries: RecipientEntry[] = (() => {
    const entries: RecipientEntry[] = [];
    for (const st of filteredRecipients) {
      const balance = Number(st.balance || 0);
      if (recipientTo === 'PARENT') {
        // Father row — only if fatherPhone exists
        if (st.fatherPhone && st.fatherPhone.trim() !== '') {
          entries.push({
            key: `${st.id}-FATHER`,
            studentId: st.id,
            displayName: st.fatherName ? `${st.fatherName} (Otasi)` : `${st.name} (Otasi)`,
            displayPhone: st.fatherPhone,
            telegramId: st.fatherTelegramId,
            balance,
            gender: 'Erkak',
            entryType: 'FATHER',
          });
        }
        // Mother row — only if motherPhone exists
        if (st.motherPhone && st.motherPhone.trim() !== '') {
          entries.push({
            key: `${st.id}-MOTHER`,
            studentId: st.id,
            displayName: st.motherName ? `${st.motherName} (Onasi)` : `${st.name} (Onasi)`,
            displayPhone: st.motherPhone,
            telegramId: st.motherTelegramId,
            balance,
            gender: 'Ayol',
            entryType: 'MOTHER',
          });
        }
      } else if (recipientTo === 'FATHER') {
        // Father only — only if fatherPhone exists
        if (st.fatherPhone && st.fatherPhone.trim() !== '') {
          entries.push({
            key: `${st.id}`,
            studentId: st.id,
            displayName: st.fatherName ? `${st.fatherName} (Otasi)` : `${st.name} (Otasi)`,
            displayPhone: st.fatherPhone,
            telegramId: st.fatherTelegramId,
            balance,
            gender: 'Erkak',
            entryType: 'FATHER',
          });
        }
      } else if (recipientTo === 'MOTHER') {
        // Mother only — only if motherPhone exists
        if (st.motherPhone && st.motherPhone.trim() !== '') {
          entries.push({
            key: `${st.id}`,
            studentId: st.id,
            displayName: st.motherName ? `${st.motherName} (Onasi)` : `${st.name} (Onasi)`,
            displayPhone: st.motherPhone,
            telegramId: st.motherTelegramId,
            balance,
            gender: 'Ayol',
            entryType: 'MOTHER',
          });
        }
      } else {
        // Student/Teacher/Staff — standard logic
        const displayName = st.name;
        const displayPhone = st.phone;
        entries.push({
          key: `${st.id}`,
          studentId: st.id,
          displayName,
          displayPhone,
          telegramId: st.telegramId,
          balance,
          gender: st.gender,
          entryType: 'STUDENT',
        });
      }
    }
    return entries;
  })();

  useEffect(() => {
    const nextMap: Record<string, boolean> = {};
    recipientEntries.forEach(e => {
      nextMap[e.key] = true;
    });
    setSelectedRecipientIds(nextMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRecipientsKey]);

  const activeSelectedCount = recipientEntries.filter(e => selectedRecipientIds[e.key]).length;
  const activeSelectedTargetCount = activeSelectedCount;
  const allChecked = recipientEntries.length > 0 && recipientEntries.every(e => selectedRecipientIds[e.key]);
  const toggleAll = (checked: boolean) => {
    const nextMap: Record<string, boolean> = {};
    recipientEntries.forEach(e => {
      nextMap[e.key] = checked;
    });
    setSelectedRecipientIds(nextMap);
  };

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
    if (activeSelectedCount === 0) return "Tanlangan qabul qiluvchilar ro'yxati bo'sh. Kamida 1 ta qabul qiluvchini tanlang.";
    const entry = recipientEntries.find(e => selectedRecipientIds[e.key]);
    const st = entry ? filteredRecipients.find(r => r.id === entry.studentId) || filteredRecipients[0] : filteredRecipients[0];
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
    if (activeSelectedCount === 0) return;
    setIsSending(true);
    setConfirmModalOpen(false);
    try {
      // Build per-entry send list: [{studentId, recipientTo}]
      const sendList = recipientEntries
        .filter(e => selectedRecipientIds[e.key])
        .map(e => ({ studentId: e.studentId, recipientTo: e.entryType }));
      const studentIds = [...new Set(sendList.map(e => e.studentId))];
      const res = await fetch('/api/messaging/send-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          studentIds,
          sendList,
          audience,
          message: messageText,
          channel: channel === 'TELEGRAM' ? (useSmsFallback ? 'BOTH' : 'TELEGRAM') : channel,
          recipientTo,
          filters
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Kampaniya muvaffaqiyatli boshlandi! Xabarlar orqa fonda (background) yuborilmoqda.");
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

  // Auto Rule Modal Form actions
  const openAutoRuleModal = (r: AutoRule | null = null) => {
    if (r) {
      setEditingAutoRule(r);
      const cfg = r.config || {};
      setAutoRuleForm({
        name: r.name || '',
        type: r.type,
        enabled: !!r.enabled,
        body: r.body,
        channel: r.channel,
        recipientTo: r.recipientTo,
        time: r.time || '09:00',
        minDebt: cfg.minDebt || 0,
        dayOfMonth: cfg.dayOfMonth || 1
      });
    } else {
      setEditingAutoRule(null);
      setAutoRuleForm({
        name: '',
        type: 'BIRTHDAY',
        enabled: true,
        body: '',
        channel: 'BOTH',
        recipientTo: 'PARENT',
        time: '09:00',
        minDebt: 0,
        dayOfMonth: 1
      });
    }
    setAutoRuleModalOpen(true);
  };

  const handleSaveAutoRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoRuleForm.name.trim() || !autoRuleForm.body.trim()) return;
    try {
      const method = editingAutoRule ? 'PUT' : 'POST';
      const url = editingAutoRule ? `/api/messaging/auto-rules/${editingAutoRule.id}` : '/api/messaging/auto-rules';
      const payload = {
        name: autoRuleForm.name,
        type: autoRuleForm.type,
        enabled: autoRuleForm.enabled,
        body: autoRuleForm.body,
        channel: autoRuleForm.channel,
        recipientTo: autoRuleForm.recipientTo,
        time: autoRuleForm.time,
        config: autoRuleForm.type === 'DEBT_REMINDER' ? {
          dayOfMonth: autoRuleForm.dayOfMonth,
          minDebt: autoRuleForm.minDebt
        } : null
      };
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setAutoRuleModalOpen(false);
        fetchRules();
      } else {
        const err = await res.json();
        alert("Xatolik: " + err.error);
      }
    } catch (err: any) {
      alert("Xatolik yuz berdi: " + err.message);
    }
  };

  const handleToggleRuleEnabled = async (rule: AutoRule) => {
    try {
      const res = await fetch(`/api/messaging/auto-rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...rule, enabled: !rule.enabled })
      });
      if (res.ok) {
        fetchRules();
      } else {
        const err = await res.json();
        alert("Xatolik: " + err.error);
      }
    } catch (e: any) {
      alert("Xatolik: " + e.message);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm("Haqiqatan ham bu avtomatik qoidani o'chirmoqchisiz?")) return;
    try {
      const res = await fetch(`/api/messaging/auto-rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchRules();
      } else {
        const err = await res.json();
        alert("Qoidani o'chirishda xatolik: " + (err.error || "Noma'lum xato"));
      }
    } catch (e: any) {
      alert("Xatolik: " + e.message);
    }
  };

  // Template Modal Form actions
  const openTemplateModal = (t: MessageTemplate | null = null) => {
    if (t) {
      setEditingTemplate(t);
      setTemplateForm({
        name: t.name,
        body: t.body,
        category: t.category
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        body: '',
        category: 'Umumiy'
      });
    }
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.body.trim()) return;
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate ? `/api/messaging/templates/${editingTemplate.id}` : '/api/messaging/templates';
      const payload = {
        name: templateForm.name,
        body: templateForm.body,
        category: templateForm.category,
        isAuto: false,
        autoType: null,
        autoChannel: 'BOTH',
        autoRecipient: 'PARENT',
        autoTime: '09:00',
        autoConfig: null
      };
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
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
      if (res.ok) {
        fetchTemplates();
      } else {
        const err = await res.json();
        alert("Shablonni o'chirishda xatolik: " + (err.error || "Noma'lum xato"));
      }
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
  const failedLogsInDisplay = displayLogs.filter(log => log.status === 'FAILED');
  const allFailedChecked = failedLogsInDisplay.length > 0 && failedLogsInDisplay.every(log => selectedLogIds[log.id]);
  const toggleAllFailed = (checked: boolean) => {
    const nextMap = { ...selectedLogIds };
    failedLogsInDisplay.forEach(log => {
      nextMap[log.id] = checked;
    });
    setSelectedLogIds(nextMap);
  };

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

            {/* Audience selection */}
            <div>
              <label className={lbl}>Kimlarga yuborish (Auditoriya)</label>
              <div className="grid grid-cols-3 gap-2 bg-slate-55 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-3">
                <button
                  onClick={() => setAudience('STUDENTS')}
                  className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${audience === 'STUDENTS' ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                >
                  O'quvchilar
                </button>
                <button
                  onClick={() => setAudience('TEACHERS')}
                  className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${audience === 'TEACHERS' ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                >
                  O'qituvchilar
                </button>
                <button
                  onClick={() => setAudience('STAFF')}
                  className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${audience === 'STAFF' ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                >
                  Xodimlar
                </button>
              </div>
            </div>

            {/* Qabul qiluvchi tomon */}
            {audience === 'STUDENTS' && (
              <div>
                <label className={lbl}>Qabul qiluvchi tomon</label>
                <div className="grid grid-cols-4 gap-1 bg-slate-55 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
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
            )}

            {/* Form Fields */}
            {audience === 'STUDENTS' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>O'quvchi statusi</label>
                  <select
                    value={filters.status}
                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                    className={inp}
                  >
                    <option value="all">Barchasi</option>
                    <option value="active_group">✅ Faol o'quvchilar (Faol + Sinov)</option>
                    <option value="passive_group">🚪 Ketgan/Passiv o'quvchilar</option>
                    <option value="Faol">Faol</option>
                    <option value="Sinov">Sinov</option>
                    <option value="Passiv">Passiv</option>
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
                    <option value="no_telegram">Telegramga ulanmaganlar</option>
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
            ) : audience === 'TEACHERS' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>O'qituvchi statusi</label>
                  <select
                    value={filters.status}
                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                    className={inp}
                  >
                    <option value="all">Barchasi</option>
                    <option value="Faol">Faol</option>
                    <option value="Nofaol">Nofaol</option>
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
                    <option value="no_telegram">Telegramga ulanmaganlar</option>
                  </select>
                </div>
              </div>
            ) : null}

            {/* Recipient list inline */}
            <div className="space-y-3 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-800"
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Barchasi
                  </span>
                </div>
                <span className="text-[10px] font-black tabular-nums text-indigo-500">
                  {activeSelectedTargetCount} ta xabar / {filteredRecipients.length} ta o'quvchi
                </span>
              </div>

              {recipientEntries.length > 0 ? (
                <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/80 pr-1 border border-slate-100 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/40 dark:bg-slate-950/20">
                  {recipientEntries.map(entry => {
                    const isDebtor = entry.balance < 0;
                    return (
                      <div key={entry.key} className="py-2.5 flex items-center justify-between text-[11px] hover:bg-white dark:hover:bg-slate-800/40 px-2 rounded-xl transition-all">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={!!selectedRecipientIds[entry.key]}
                            onChange={(e) => {
                              setSelectedRecipientIds(prev => ({
                                ...prev,
                                [entry.key]: e.target.checked
                              }));
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-800"
                          />
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black uppercase ${entry.gender === 'Ayol' ? 'bg-pink-100 dark:bg-pink-950/30 text-pink-500' : 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-500'}`}>
                            {entry.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                              {entry.displayName}
                            </p>
                            <p className="text-[9px] font-bold tabular-nums">
                              {entry.displayPhone
                                ? <span className="text-slate-450 dark:text-slate-500">{entry.displayPhone}</span>
                                : <span className="text-rose-500">Raqam yo'q</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-right">
                          <span className={`text-[9px] font-bold tabular-nums ${isDebtor ? 'text-rose-500' : entry.balance > 0 ? 'text-emerald-500' : 'text-slate-450'}`}>
                            {entry.balance.toLocaleString()} s.
                          </span>
                          {entry.telegramId ? (
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
                <div className="grid grid-cols-2 gap-2 bg-slate-55 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setChannel('SMS')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${channel === 'SMS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel(useSmsFallback ? 'BOTH' : 'TELEGRAM')}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${channel !== 'SMS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Telegram
                  </button>
                </div>
                {channel !== 'SMS' && (
                  <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useSmsFallback}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseSmsFallback(checked);
                        setChannel(checked ? 'BOTH' : 'TELEGRAM');
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-800"
                    />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Telegramdan ro'yxatdan o'tmaganlarga SMS yuborilsin
                    </span>
                  </label>
                )}
              </div>


            </div>



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
                disabled={activeSelectedCount === 0 || !messageText.trim() || isSending}
                className={btnPrimary}
              >
                {isSending ? 'Yuborilmoqda...' : `Kampaniyani boshlash (${activeSelectedCount} ta)`}
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
                <div className="text-[9px] font-black uppercase tracking-widest pt-2 border-t border-dashed border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500">
                  <span>O'zgaruvchilar: {"{ism}"}, {"{qarz}"}, {"{balans}"}, {"{guruh}"}, {"{markaz}"}</span>
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
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Avtomatik yuborish qoidalari</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Tizim belgilangan kunlik qoidalar bo'yicha fonda SMS yoki Telegram tabriknoma va eslatmalarini jo'natadi</p>
            </div>
            <button onClick={() => openAutoRuleModal(null)} className={btnPrimary}>
              <Plus size={14} />
              Yangi qoida yaratish
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rules.map(rule => {
              const meta = getTriggerTypeMeta(rule.type);
              const isBirthday = rule.type === 'BIRTHDAY';
              const isDebt = rule.type === 'DEBT_REMINDER';
              return (
                <div key={rule.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition-all group">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${meta.color}`}>
                          {meta.icon}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-55 dark:bg-slate-800 text-slate-500 dark:text-slate-450 border border-slate-100 dark:border-slate-700">
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openAutoRuleModal(rule)} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer">
                          <Edit size={13} />
                        </button>
                        <button onClick={() => handleDeleteRule(rule.id!)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xs font-black text-slate-855 dark:text-white uppercase tracking-wide">{rule.name}</h3>

                    {/* Meta info block */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>Kanal: <span className="font-bold text-slate-700 dark:text-slate-300">{rule.channel}</span></div>
                      <div>Vaqt: <span className="font-bold text-slate-700 dark:text-slate-300">{rule.time || '09:00'}</span></div>
                      <div className="col-span-2">Kimga: <span className="font-bold text-slate-700 dark:text-slate-300">{rule.recipientTo === 'PARENT' ? 'Ota-onasi' : 'O\'quvchi'}</span></div>
                      {isDebt && rule.config && (
                        <>
                          <div>Kun: <span className="font-bold text-slate-700 dark:text-slate-300">{rule.config.dayOfMonth || 1}</span></div>
                          <div>Min qarz: <span className="font-bold text-rose-500">{(rule.config.minDebt || 0).toLocaleString()} UZS</span></div>
                        </>
                      )}
                    </div>

                    {/* Body text */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed line-clamp-3">
                      {rule.body}
                    </p>
                  </div>

                  {/* Switch toggle at the bottom */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Holati: {rule.enabled ? <span className="text-emerald-500">Faol</span> : <span className="text-slate-400">O'chirilgan</span>}
                    </span>
                    <button
                      onClick={() => handleToggleRuleEnabled(rule)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${rule.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
            {rules.length === 0 && (
              <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center">
                <Zap className="w-8 h-8 text-slate-200 dark:text-slate-750 mx-auto mb-3" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hozircha avtomatik qoidalar yaratilmagan</p>
              </div>
            )}
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

              {/* Resend actions bar */}
              <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border-b border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Xatoliklarni qayta jo'natish:</span>
                {Object.values(selectedLogIds).filter(Boolean).length > 0 ? (
                  <button
                    onClick={() => handleResendLogs(false)}
                    disabled={resendingLogs}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <RefreshCw size={12} className={resendingLogs ? 'animate-spin' : ''} />
                    Tanlanganlarni jo'natish ({Object.values(selectedLogIds).filter(Boolean).length})
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Sana bo'yicha:</span>
                    <input
                      type="date"
                      value={resendStartDate}
                      onChange={e => setResendStartDate(e.target.value)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                    <span className="text-[10px] font-bold text-slate-400">{"->"}</span>
                    <input
                      type="date"
                      value={resendEndDate}
                      onChange={e => setResendEndDate(e.target.value)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleResendLogs(true)}
                      disabled={resendingLogs}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <Send size={12} />
                      Ushbu oraliqdagi barcha xatolarni jo'natish
                    </button>
                  </div>
                )}
              </div>

              {/* Table wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-55 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800">
                      <th className="p-3 w-8">
                        <input
                          type="checkbox"
                          checked={allFailedChecked}
                          onChange={(e) => toggleAllFailed(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-800"
                          disabled={failedLogsInDisplay.length === 0}
                        />
                      </th>
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
                        <td className="p-3 w-8">
                          {log.status === 'FAILED' && (
                            <input
                              type="checkbox"
                              checked={!!selectedLogIds[log.id]}
                              onChange={(e) => {
                                setSelectedLogIds(prev => ({
                                  ...prev,
                                  [log.id]: e.target.checked
                                }));
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-800"
                            />
                          )}
                        </td>
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
                        <td colSpan={6} className="p-16 text-center text-slate-400">
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
                Ushbu xabar **{activeSelectedCount} ta** o'quvchi/ota-onaga **{channel === 'BOTH' || (channel === 'TELEGRAM' && useSmsFallback) ? 'Telegram va SMS' : channel}** kanali orqali yuboriladi. SMS jo'natish xizmati Eskiz hisobidan mablag' yechadi.
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">{activeSelectedCount}/{filteredRecipients.length} ta</span>
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
                O'zgaruvchilar: {"{ism}"}, {"{qarz}"}, {"{balans}"}, {"{guruh}"}, {"{markaz}"}
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

      {/* ===== MODAL: CREATE/EDIT AUTO RULE ===== */}
      {autoRuleModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setAutoRuleModalOpen(false)} />
          <form onSubmit={handleSaveAutoRule} className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">
              {editingAutoRule ? 'Avtomatik qoidani tahrirlash' : 'Yangi avtomatik qoida yaratish'}
            </h3>

            <div>
              <label className={lbl}>Qoida nomi *</label>
              <input
                type="text"
                required
                placeholder="Masalan: 15-kunlik qarz eslatmasi"
                value={autoRuleForm.name}
                onChange={e => setAutoRuleForm({ ...autoRuleForm, name: e.target.value })}
                className={inp}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Trigger turi *</label>
                <select
                  value={autoRuleForm.type}
                  onChange={e => setAutoRuleForm({ ...autoRuleForm, type: e.target.value })}
                  className={inp}
                >
                  <option value="BIRTHDAY">🎂 Tug'ilgan kun tabrigi</option>
                  <option value="DEBT_REMINDER">💸 Qarzdorlik eslatmasi</option>
                  <option value="ABSENCE_REMINDER">🚫 Dars qoldirganlik eslatmasi</option>
                  <option value="LEAD_WELCOME">📞 Yangi lid tabrigi</option>
                  <option value="GROUP_WELCOME">🎉 Yangi guruhga qo'shilish tabrigi</option>
                  <option value="EXAM_RESULT">📝 Imtihon natijalari e'loni</option>
                  <option value="PAYMENT_CONFIRM">💰 To'lov tasdiqlanishi tabrigi</option>
                  <option value="DAILY_SCORE">⭐️ Kunlik baholash hisoboti</option>
                  <option value="TRANSPORT_NOTIFY">🚌 Transport xabarnomasi</option>
                  <option value="COURSE_GRADUATION">🎓 Kursni bitirganlik tabrigi</option>
                  <option value="LATE_ARRIVAL">⏰ Darsga kechikkanlik eslatmasi</option>
                  <option value="EARLY_LEAVE">🚪 Darsdan erta ketganlik eslatmasi</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Jo'natish vaqti *</label>
                <select
                  value={autoRuleForm.time}
                  onChange={e => setAutoRuleForm({ ...autoRuleForm, time: e.target.value })}
                  className={inp}
                >
                  {Array.from({ length: 24 }).map((_, h) => {
                    const hourStr = `${String(h).padStart(2, '0')}:00`;
                    return <option key={hourStr} value={hourStr}>{hourStr}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Jo'natish kanali *</label>
                <select
                  value={autoRuleForm.channel}
                  onChange={e => setAutoRuleForm({ ...autoRuleForm, channel: e.target.value as any })}
                  className={inp}
                >
                  <option value="BOTH">Telegram va SMS</option>
                  <option value="SMS">Faqat SMS</option>
                  <option value="TELEGRAM">Faqat Telegram</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Qabul qiluvchi *</label>
                <select
                  value={autoRuleForm.recipientTo}
                  onChange={e => setAutoRuleForm({ ...autoRuleForm, recipientTo: e.target.value as any })}
                  className={inp}
                >
                  <option value="PARENT">Ota-onasi</option>
                  <option value="STUDENT">O'quvchi</option>
                </select>
              </div>
            </div>

            {autoRuleForm.type === 'DEBT_REMINDER' && (
              <div className="grid grid-cols-2 gap-3 bg-slate-55 dark:bg-slate-850 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <div>
                  <label className={lbl}>Oylik jo'natish kuni (1-31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={autoRuleForm.dayOfMonth}
                    onChange={e => setAutoRuleForm({ ...autoRuleForm, dayOfMonth: Number(e.target.value) })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Minimal qarz summasi</label>
                  <input
                    type="number"
                    value={autoRuleForm.minDebt}
                    onChange={e => setAutoRuleForm({ ...autoRuleForm, minDebt: Number(e.target.value) })}
                    className={inp}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={lbl}>Qoida xabari matni *</label>
                {templates.length > 0 && (
                  <select
                    onChange={e => {
                      if (!e.target.value) return;
                      const selected = templates.find(t => String(t.id) === e.target.value);
                      if (selected) {
                        setAutoRuleForm(prev => ({ ...prev, body: selected.body }));
                      }
                      e.target.value = "";
                    }}
                    className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-750 px-2 py-0.5 rounded outline-none cursor-pointer animate-in fade-in"
                  >
                    <option value="">Shablondan nusxalash...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                required
                rows={4}
                placeholder="Hurmatli {ism}, ..."
                value={autoRuleForm.body}
                onChange={e => setAutoRuleForm({ ...autoRuleForm, body: e.target.value })}
                className="w-full px-3 py-2 bg-slate-55 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all resize-none"
              />
              <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                O'zgaruvchilar: {"{ism}"}, {"{qarz}"}, {"{balans}"}, {"{guruh}"}, {"{markaz}"}, {"{imtihon_nomi}"}, {"{imtihon_ball}"}, {"{imtihon_foiz}"}, {"{to_lov_summa}"}, {"{bahosi}"}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setAutoRuleModalOpen(false)} className={btnSecondary}>
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
