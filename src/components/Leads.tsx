import React, { useState } from 'react';
import { MoreHorizontal, Plus, Search, Filter, Phone, Calendar, ArrowRight, X, SlidersHorizontal, Trash2, UserPlus, GraduationCap, MapPin, Award, BookOpen, Clock, Building } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { useLang } from '../context/LanguageContext';
import { Lead } from '../types';

const STAGES = [
  { id: 'yangi', name: 'Yangi', color: 'bg-sky-500', borderColor: 'border-sky-500', lightBgc: 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/30' },
  { id: 'boglanilmadi', name: "Bog'lanilmadi", color: 'bg-amber-500', borderColor: 'border-amber-500', lightBgc: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' },
  { id: 'oylayapti', name: "O'ylayapti", color: 'bg-violet-500', borderColor: 'border-violet-500', lightBgc: 'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-900/30' },
  { id: 'kelishdi', name: 'Kelishdi', color: 'bg-emerald-500', borderColor: 'border-emerald-500', lightBgc: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' },
  { id: 'tolov_qildi', name: "To'lov qildi", color: 'bg-rose-500', borderColor: 'border-rose-500', lightBgc: 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30' },
] as const;

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold   text-gray-400 mb-2";

const UZB_REGIONS: Record<string, string[]> = {
  "Surxondaryo": [
    "Sariosiyo", "Denov", "Uzun", "Sho'rchi", "Termiz", "Qumqo'rg'on",
    "Jarqo'rg'on", "Sherobod", "Boysun", "Muzrabot", "Angor", "Qiziriq",
    "Oltinsoy", "Bandixon"
  ],
  "Toshkent shahri": [
    "Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Yashnobod", "Mirobod",
    "Uchtepa", "Shayxontohur", "Olmazor", "Sergeli", "Yakkasaroy",
    "Bektemir", "Yangihayot"
  ],
  "Toshkent viloyati": [
    "Chirchiq", "Angren", "Olmaliq", "Bekobod", "Keles", "Zangiota",
    "Qibray", "Bo'stonliq", "Parkent", "Piskent", "O'rtachirchiq",
    "Yuqorichirchiq", "Quyichirchiq", "Oqqo'rg'on", "Bo'ka", "Yangiyo'l"
  ],
  "Samarqand": [
    "Samarqand shahri", "Bulung'ur", "Ishtixon", "Jomboy", "Kattaqo'rg'on",
    "Narpay", "Nurobod", "Oqdaryo", "Payariq", "Pastdarg'om", "Paxtachi",
    "Toyloq", "Qo'shrabot", "Urgut"
  ],
  "Farg'ona": [
    "Farg'ona shahri", "Marg'ilon", "Qo'qon", "Bog'dod", "Beshariq",
    "Buvayda", "Dang'ara", "Quva", "Rishton", "Toshloq", "Uchko'prik",
    "O'zbekiston", "Yozyovon", "So'x"
  ],
  "Andijon": [
    "Andijon shahri", "Asaka", "Baliqchi", "Buloqboshi", "Bo'ston",
    "Jalaquduq", "Izboskan", "Marhamat", "Oltinko'l", "Paxtaobod",
    "Ulug'nor", "Xo'jaobod", "Shahrixon", "Qo'rg'ontepa"
  ],
  "Namangan": [
    "Namangan shahri", "Kosonsoy", "Mingbuloq", "Pop", "To'raqo'rg'on",
    "Uychi", "Uchqo'rg'on", "Chortoq", "Chust", "Yangiqo'rg'on", "Davlatobod"
  ],
  "Qashqadaryo": [
    "Karshi shahri", "Dehqonobod", "Kamashi", "Kasbi", "Kitob",
    "Koson", "Ko'kdala", "Mirishkor", "Muborak", "Nishon",
    "Chiroqchi", "Shahrisabz", "Yakkabog'"
  ],
  "Buxoro": [
    "Buxoro shahri", "Gijduvon", "Jondor", "Kogon", "Kofirnihon",
    "Qorako'l", "Qoravulbozor", "Olot", "Peshku", "Romitan",
    "Shofirkon", "Vobkent"
  ],
  "Xorazm": [
    "Urganch shahri", "Xiva", "Bog'ot", "Gurlan", "Qo'shko'pir",
    "Shovot", "Toza bozor", "Xonqa", "Hazorasp", "Yangiariq", "Yangibozor"
  ],
  "Navoiy": [
    "Navoiy shahri", "Karmana", "Konimex", "Nurota", "Qiziltepa",
    "Tomdi", "Uchquduq", "Xatirchi"
  ],
  "Jizzax": [
    "Jizzax shahri", "Arnasoy", "Baxmal", "Do'stlik", "Forish",
    "G'allaorol", "Sharof Rashidov", "Mirzacho'l", "Paxtakor", "Yangiobod"
  ],
  "Sirdaryo": [
    "Guliston shahri", "Shirin", "Yangiyer", "Boyovut", "Oqoltin",
    "Sardoba", "Sayxunobod", "Sirdaryo tumani", "Xovost"
  ],
  "Qoraqalpog'iston": [
    "Nukus shahri", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala",
    "Kegeyli", "Mo'ynoq", "Qonliko'l", "Qo'ng'irot", "Shumanay",
    "Taxtako'pir", "To'rtko'l", "Xo'jayli"
  ]
};

export default function Leads() {
  const { leads, courses, groups, updateLead, addLead, deleteLead, addStudent } = useCRM();
    const confirm = useConfirm();
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
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    course: '',
    source: 'Instagram',
    privilegeType: 'None',
    certCategory: '',
    certSubject: '',
    certType: '',
    studentSchool: '',
    orgType: '',
    region: '',
    district: ''
  });
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
    photo: '',
    orgType: '',
    region: '',
    district: ''
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

  // Manba chiplari uchun sanoq. Manba filtrining o'zi hisobga olinmaydi, aks holda
  // chip bosilgach qolgan chiplar nolga tushib qolardi.
  const sourceCounts = (() => {
    const lowerQ = searchQuery.toLowerCase();
    const visible = leads.filter(lead => {
      const matchesSearch =
        (lead.name || '').toLowerCase().includes(lowerQ) ||
        (lead.phone || '').includes(searchQuery) ||
        (lead.course || '').toLowerCase().includes(lowerQ);
      const matchesCourse = !filters.course || lead.course === filters.course;
      return matchesSearch && matchesCourse;
    });
    const counts = new Map<string, number>();
    visible.forEach(l => counts.set(l.source || '—', (counts.get(l.source || '—') || 0) + 1));
    return {
      total: visible.length,
      list: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    };
  })();

  /** Bosqichdagi lidlarning taxminiy qiymati — kurs narxlari yig'indisi. */
  const stagePotential = (stageLeads: Lead[]) =>
    stageLeads.reduce((sum, l) => sum + (courses.find(c => c.name === l.course)?.price || 0), 0);

  const formatSum = (n: number) =>
    n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + ' mln' : n.toLocaleString();

  /** Lid ustunda necha kundan beri turgani — sovib qolganini ko'rsatish uchun. */
  const daysSince = (iso: string | Date) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days < 0 ? 0 : days;
  };

  /** Lidni ketma-ketlikdagi keyingi bosqichga o'tkazadi. */
  const advanceStage = (lead: Lead) => {
    const idx = STAGES.findIndex(st => st.name === lead.status);
    const next = STAGES[idx + 1];
    if (next) handleStatusChange(lead.id, next.name);
  };

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    addLead({
      ...newLead,
      status: 'Yangi',
      course: newLead.course || (courses.length > 0 ? courses[0].name : ''),
      createdAt: new Date().toISOString()
    });
    setIsModalOpen(false);
    setNewLead({
      name: '', phone: '', course: '', source: 'Instagram',
      privilegeType: 'None', certCategory: '', certSubject: '', certType: '',
      studentSchool: '', orgType: '', region: '', district: ''
    });
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
    if (await confirm(t('delete_lead_confirm'))) {
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
        comment: `QR formadan kelgan lid. Manba: ${selectedLead.source}. Kurs: ${selectedLead.course}`,
        privilegeType: selectedLead.privilegeType || 'None',
        certCategory: selectedLead.certCategory || '',
        certSubject: selectedLead.certSubject || '',
        certType: selectedLead.certType || '',
        orgType: conversionData.orgType || null,
        region: conversionData.region || null,
        district: conversionData.district || null,
        customPrices: {}
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
        photo: '',
        orgType: '',
        region: '',
        district: ''
      });
    } catch (err) {
      console.error("Talabaga o'tkazishda xatolik:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha. Avval kartochka ichida, gradientli ikonka kvadrati bilan
          turardi — ikonka hech qanday ma'no qo'shmasdi, kartochka esa sarlavhani
          sahifadan ajratib qo'yardi. */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">{t('leads_title')}</h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
              {t('leads_subtitle')} · <span className="num">{leads.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder={t('search_placeholder_students')}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl text-[13px] text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-colors w-52"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 ${showFilters ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800 text-gray-400 hover:border-[#1b6b6b] hover:text-[#1b6b6b]'}`}
            >
              <SlidersHorizontal size={15} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[13px] font-semibold shadow-sm shadow-[#1b6b6b]/20 transition-colors cursor-pointer shrink-0"
            >
              <Plus size={14} /> {t('add')}
            </button>
          </div>
      </div>

      {/* Manba bo'yicha tez filtr. Pastdagi "Filtrlar" paneli joyida qoladi —
          bu qator o'sha paneldagi manba tanlovi bilan bitta holatni bo'lishadi. */}
      <div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[12px] text-gray-400 shrink-0 mr-1">{t('by_source')}</span>
          <button
            onClick={() => setFilters({ ...filters, source: '' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 ${!filters.source
              ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white'
              : 'bg-gray-55 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-[#1b6b6b] hover:border-[#1b6b6b]'}`}
          >
            {t('all')} <span className="tabular-nums opacity-60">{sourceCounts.total}</span>
          </button>
          {sourceCounts.list.map(([src, count]) => (
            <button
              key={src}
              onClick={() => setFilters({ ...filters, source: filters.source === src ? '' : src })}
              title={src}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 max-w-[200px] ${filters.source === src
                ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white'
                : 'bg-gray-55 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-[#1b6b6b] hover:border-[#1b6b6b]'}`}
            >
              <span className="truncate">{src}</span>
              <span className="tabular-nums opacity-60 shrink-0">{count}</span>
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="mt-4 p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800/50 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>{t('by_course')}</label>
              <select
                value={filters.course}
                onChange={e => setFilters({...filters, course: e.target.value})}
                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer"
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
                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer"
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
                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer"
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
                className="w-full py-2.5 text-[11px] font-extrabold text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X size={12} /> {t('filter_clear')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Board Layout */}
      <div className="flex gap-3 overflow-x-auto pb-4 items-start custom-scrollbar">
        {STAGES.map((stage) => {
          const stageLeads = getLeadsByStatus(stage.name);
          return (
            /* Ustun avval 300px keng va min-h-[500px] edi: bitta kartali bosqichda
               pastda yarim ekran bo'sh joy qolar, beshinchi ustun esa ekranga
               sig'masdi. Endi eni torroq va balandligi kontentga qarab. */
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
              className="w-[264px] shrink-0 rounded-2xl bg-gray-55/70 dark:bg-gray-900/25 border border-gray-100 dark:border-gray-800/50 flex flex-col max-h-[76vh] overflow-hidden"
            >
              {/* Bosqich rangi ustun tepasida ingichka chiziq bo'lib turadi —
                  sarlavhadagi nuqta bilan ikki marta takrorlanmasin uchun. */}
              <div className={`h-0.5 w-full ${stage.color}`} />
              <div className="px-3 pt-3 pb-2 flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-[13px] truncate">{getStageLabel(stage.name)}</h3>
                  <span className="num text-[11px] font-medium text-gray-400 shrink-0">{stageLeads.length}</span>
                </div>
                {stageLeads.length > 0 && (
                  <span className="num text-[11px] font-medium text-gray-400 dark:text-gray-500 shrink-0">
                    {formatSum(stagePotential(stageLeads))}
                  </span>
                )}
              </div>

              <div className="px-3 pb-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
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
                    className="group/card bg-white dark:bg-gray-800 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-755 hover:border-[#1b6b6b]/40 dark:hover:border-[#1b6b6b]/50 transition-colors cursor-pointer"
                  >
                    {/* Ism eng muhim ma'lumot, shuning uchun kartaning tepasida.
                        Kurs nomi "birinchi" bo'lsa — bu joy to'ldirgichi, ko'rsatilmaydi. */}
                    <h4 className="font-semibold text-gray-900 dark:text-white text-[13px] leading-snug truncate">{lead.name}</h4>

                    <div className="text-[11px] text-gray-400">
                      {lead.phone && (
                        <p className="num text-[12px] text-gray-500 dark:text-gray-400 truncate">{lead.phone}</p>
                      )}

                      {/* Manba nomlari juda uzun bo'lishi mumkin ("Bir martalik QR
                          havola - vaqt: ertalab") — avval ular kartani uch qatorga
                          cho'zib yuborardi, endi bir qatorga kesiladi. */}
                      {(lead.source || (lead.course && lead.course !== 'birinchi')) && (
                        <div className="flex items-center gap-1 mt-2 flex-nowrap overflow-hidden">
                          {lead.course && lead.course !== 'birinchi' && (
                            <span className={`shrink-0 max-w-[45%] truncate text-[10px] font-medium px-1.5 py-0.5 rounded border ${stage.lightBgc}`}>
                              {lead.course}
                            </span>
                          )}
                          {lead.source && (
                            <span
                              title={lead.source}
                              className="min-w-0 truncate text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-55 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800"
                            >
                              {lead.source}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pastki qator: lid necha kundan beri turibdi, o'ngda tez
                          amallar. Amallar avval faqat hover'da ko'rinardi — sensorli
                          ekranda ular umuman topilmasdi, endi doim turadi. */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/50">
                        {(() => {
                          const age = daysSince(lead.createdAt);
                          if (age === null) return <span />;
                          const stale = age >= 3 && stage.name !== "To'lov qildi";
                          return (
                            <span className={`text-[11px] font-medium tabular-nums truncate ${stale ? 'text-rose-500' : 'text-gray-400 dark:text-gray-500'}`}>
                              {age === 0 ? 'Bugun' : age === 1 ? 'Kecha' : `${age} kundan beri`}
                            </span>
                          );
                        })()}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover/card:opacity-100 transition-opacity">
                          <a
                            href={lead.phone ? `tel:${lead.phone.replace(/\s/g, '')}` : undefined}
                            onClick={e => e.stopPropagation()}
                            title="Qo'ng'iroq qilish"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-[#1b6b6b] hover:text-white transition-colors"
                          >
                            <Phone size={13} />
                          </a>
                          {STAGES.findIndex(st => st.name === lead.status) < STAGES.length - 1 && (
                            <button
                              onClick={e => { e.stopPropagation(); advanceStage(lead); }}
                              title="Keyingi bosqichga o'tkazish"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-[#1b6b6b] hover:text-white transition-colors cursor-pointer"
                            >
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-gray-400 hover:text-[#1b6b6b] hover:bg-white dark:hover:bg-gray-800 transition-colors text-[12px] font-medium cursor-pointer"
                >
                  <Plus size={13} /> {t('add')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-800/50 shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-800/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{t('new_lead_title')}</h3>
                <p className="text-[11px] font-bold text-[#1b6b6b] mt-0.5">{t('lead_details_subtitle')}</p>
              </div>
              <button aria-label="Yopish" onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
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
              <div>
                <label className={lbl}>Ta'lim muassasasi turi</label>
                <select
                  className={inp}
                  value={newLead.orgType}
                  onChange={e => setNewLead({ ...newLead, orgType: e.target.value })}
                >
                  <option value="">Tanlang...</option>
                  <option value="Maktab">Maktab</option>
                  <option value="Bog'cha">Bog'cha</option>
                  <option value="Oliy o'quv yurti">Oliy o'quv yurti</option>
                  <option value="Kollej / Litsey">Kollej / Litsey</option>
                  <option value="Boshqa">Boshqa</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Muassasa nomi</label>
                <input type="text" placeholder="42-maktab" className={inp} value={newLead.studentSchool} onChange={e => setNewLead({ ...newLead, studentSchool: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Viloyat</label>
                  <select
                    className={inp}
                    value={newLead.region}
                    onChange={e => setNewLead({ ...newLead, region: e.target.value, district: '' })}
                  >
                    <option value="">Tanlang...</option>
                    {Object.keys(UZB_REGIONS).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tuman</label>
                  <select
                    className={inp}
                    value={newLead.district}
                    onChange={e => setNewLead({ ...newLead, district: e.target.value })}
                    disabled={!newLead.region}
                  >
                    <option value="">Tanlang...</option>
                    {newLead.region && UZB_REGIONS[newLead.region]?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Imtiyoz turi</label>
                <select
                  className={inp}
                  value={newLead.privilegeType}
                  onChange={e => setNewLead({
                    ...newLead,
                    privilegeType: e.target.value,
                    certCategory: e.target.value === 'Sertifikat' ? newLead.certCategory || 'Milliy' : '',
                    certSubject: e.target.value === 'Sertifikat' ? newLead.certSubject : '',
                    certType: e.target.value === 'Sertifikat' ? newLead.certType : ''
                  })}
                >
                  <option value="None">Mavjud emas</option>
                  <option value="Nogironligi bor">Nogironligi bor</option>
                  <option value="Harbiy oila">Harbiy oila</option>
                  <option value="Xotin-qizlar daftari">Xotin-qizlar daftari</option>
                  <option value="Sertifikat">Sertifikat</option>
                </select>
              </div>

              {newLead.privilegeType === 'Sertifikat' && (
                <div className="space-y-3 p-3 bg-gray-55 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div>
                    <label className={lbl}>Sertifikat toifasi</label>
                    <select
                      className={inp}
                      value={newLead.certCategory}
                      onChange={e => setNewLead({
                        ...newLead,
                        certCategory: e.target.value,
                        certSubject: e.target.value === 'Milliy' ? newLead.certSubject || 'Matematika' : '',
                        certType: e.target.value === 'Xalqaro' ? newLead.certType || 'IELTS' : ''
                      })}
                    >
                      <option value="Milliy">Milliy sertifikat</option>
                      <option value="Xalqaro">Xalqaro sertifikat</option>
                    </select>
                  </div>

                  {newLead.certCategory === 'Milliy' && (
                    <div>
                      <label className={lbl}>Sertifikat fani</label>
                      <select
                        className={inp}
                        value={newLead.certSubject}
                        onChange={e => setNewLead({ ...newLead, certSubject: e.target.value })}
                      >
                        <option value="">Tanlang...</option>
                        <option value="Matematika">Matematika</option>
                        <option value="Fizika">Fizika</option>
                        <option value="Kimyo">Kimyo</option>
                        <option value="Biologiya">Biologiya</option>
                        <option value="Tarix">Tarix</option>
                        <option value="Ingliz tili">Ingliz tili</option>
                        <option value="Nemis tili">Nemis tili</option>
                        <option value="Rus tili">Rus tili</option>
                        <option value="Ona tili">Ona tili</option>
                      </select>
                    </div>
                  )}

                  {newLead.certCategory === 'Xalqaro' && (
                    <div>
                      <label className={lbl}>Sertifikat turi</label>
                      <select
                        className={inp}
                        value={newLead.certType}
                        onChange={e => setNewLead({ ...newLead, certType: e.target.value })}
                      >
                        <option value="">Tanlang...</option>
                        <option value="IELTS">IELTS</option>
                        <option value="SAT">SAT</option>
                        <option value="TOEFL">TOEFL</option>
                        <option value="CEFR">CEFR</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                  {t('cancel')}
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Lead Details & Conversion Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-800/50 shadow-2xl w-full max-w-lg p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-800/50">
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{t('lead_details_title')}</h3>
                <p className="text-[11px] font-bold text-gray-400 mt-0.5">{t('registered_at')}{new Date(selectedLead.createdAt).toLocaleString()}</p>
              </div>
              <button aria-label="Yopish" onClick={() => setSelectedLead(null)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>

            {!isConverting ? (
              <div className="space-y-6">
                {selectedLead.photo && (
                  <div className="flex justify-center mb-2">
                    <div className="w-24 h-24 rounded-2xl border border-gray-150 dark:border-gray-800 overflow-hidden shadow-sm shrink-0">
                      <img src={selectedLead.photo} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                {/* Details list */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('student_name')}</span>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white">{selectedLead.name}</span>
                  </div>
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('student_phone')}</span>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Phone size={12} className="text-[#1b6b6b]" />
                      {selectedLead.phone}
                    </span>
                  </div>
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('selected_course')}</span>
                    <span className="text-xs font-extrabold text-[#1b6b6b]">{selectedLead.course}</span>
                  </div>
                  <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                    <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('lead_source')}</span>
                    <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.source}</span>
                  </div>
                  {selectedLead.birthDate && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('birth_date')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.birthDate}</span>
                    </div>
                  )}
                  {selectedLead.orgType && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">Muassasa turi</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.orgType}</span>
                    </div>
                  )}
                  {selectedLead.studentSchool && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">Muassasa nomi</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.studentSchool}</span>
                    </div>
                  )}
                  {(selectedLead.region || selectedLead.district) && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">Viloyat / Tuman</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                        {[selectedLead.region, selectedLead.district].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {(selectedLead.fatherName || selectedLead.fatherPhone) && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('father')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                        {selectedLead.fatherName || 'Ismsiz'} {selectedLead.fatherPhone ? `(${selectedLead.fatherPhone})` : ''}
                      </span>
                    </div>
                  )}
                  {(selectedLead.motherName || selectedLead.motherPhone) && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('mother')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                        {selectedLead.motherName || 'Ismsiz'} {selectedLead.motherPhone ? `(${selectedLead.motherPhone})` : ''}
                      </span>
                    </div>
                  )}
                  {selectedLead.address && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 col-span-2">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('address')}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">{selectedLead.address}</span>
                    </div>
                  )}
                  {selectedLead.notes && (
                    <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 col-span-2">
                      <span className="block text-[11px] font-bold text-gray-400 mb-1">{t('description')}</span>
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
                        className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
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
                    <h4 className="text-xs font-black text-gray-900 dark:text-white tracking-tight">{t('convert_to_student')}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{t('convert_to_student_hint')}</p>
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
                        photo: selectedLead.photo || '',
                        orgType: selectedLead.orgType || '',
                        region: selectedLead.region || '',
                        district: selectedLead.district || ''
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[11px] font-bold cursor-pointer shadow-md transition-all"
                  >
                    <UserPlus size={14} /> {t('convert')}
                  </button>
                </div>

                {/* Actions footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-55 dark:border-gray-800/50">
                  <button
                    type="button"
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 text-[11px] font-bold cursor-pointer"
                  >
                    <Trash2 size={14} /> {t('delete_lead')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-750 text-gray-700 dark:text-white text-[11px] font-bold rounded-xl cursor-pointer hover:bg-gray-200"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            ) : (
              /* Conversion Form (Step 2) */
              <form onSubmit={handleConvertToStudent} className="space-y-5">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[12px] font-semibold flex items-center gap-2">
                  <GraduationCap size={16} />
                  <span>{t('convert_form_hint')}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>{t('birth_date')}</label>
                    <input type="date" className={inp} value={conversionData.birthDate} onChange={e => setConversionData({ ...conversionData, birthDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl}>Ta'lim muassasasi turi</label>
                    <select
                      className={inp}
                      value={conversionData.orgType}
                      onChange={e => setConversionData({ ...conversionData, orgType: e.target.value })}
                    >
                      <option value="">Tanlang...</option>
                      <option value="Maktab">Maktab</option>
                      <option value="Bog'cha">Bog'cha</option>
                      <option value="Oliy o'quv yurti">Oliy o'quv yurti</option>
                      <option value="Kollej / Litsey">Kollej / Litsey</option>
                      <option value="Boshqa">Boshqa</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Muassasa nomi</label>
                    <input type="text" placeholder="42-maktab" className={inp} value={conversionData.studentSchool} onChange={e => setConversionData({ ...conversionData, studentSchool: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Viloyat</label>
                      <select
                        className={inp}
                        value={conversionData.region}
                        onChange={e => setConversionData({ ...conversionData, region: e.target.value, district: '' })}
                      >
                        <option value="">Tanlang...</option>
                        {Object.keys(UZB_REGIONS).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Tuman</label>
                      <select
                        className={inp}
                        value={conversionData.district}
                        onChange={e => setConversionData({ ...conversionData, district: e.target.value })}
                        disabled={!conversionData.region}
                      >
                        <option value="">Tanlang...</option>
                        {conversionData.region && UZB_REGIONS[conversionData.region]?.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>{t('group_class')}</label>
                    <select className={inp} value={conversionData.groupId} onChange={e => setConversionData({ ...conversionData, groupId: e.target.value })}>
                      <option value="">{t('do_not_assign_group')}</option>
                      {groups.map(g => {
                        const course = courses.find(c => c.id === g.courseId);
                        const cName = course?.name && course.name !== 'birinchi' ? ` (${course.name})` : '';
                        return <option key={g.id} value={g.id}>{g.name}{cName}</option>;
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

                <div className="border-t border-dashed border-gray-100 dark:border-gray-800/50 pt-4 mt-4 space-y-4">
                  <span className="block text-[11px] font-bold text-[#1b6b6b]">{t('parents_info_optional')}</span>
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

                <div className="flex gap-3 pt-4 border-t border-gray-55 dark:border-gray-800/50">
                  <button type="button" onClick={() => setIsConverting(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-750 text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200">
                    {t('back')}
                  </button>
                  <button type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-emerald-650/20 transition-all cursor-pointer">
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
