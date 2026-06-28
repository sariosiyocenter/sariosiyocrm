import React, { useState, useEffect } from 'react';
import { Search, Plus, FileSpreadsheet, MoreVertical, X, Image as ImageIcon, MapPin, GraduationCap, QrCode, Trash2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PhotoCapture from './PhotoCapture';
import MapPicker from './MapPicker';
import { compressImage } from '../lib/image';
import * as XLSX from 'xlsx';

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

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

export default function Students() {
    const { students, groups, teachers, transports, addStudent, deleteStudent, importStudents, selectedSchoolId } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({
        name: '', phone: '', address: '', birthDate: '', location: '', photo: '',
        gender: 'Erkak' as 'Erkak' | 'Ayol',
        fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
        transportId: '' as string | number,
        studentSchool: '',
        selectedPrivileges: [] as string[],
        certCategory: '',
        certSubject: '',
        certType: '',
        certScore: '',
        orgType: '',
        region: '',
        district: '',
        selectedGroupIds: [] as number[],
        certificates: [] as Array<{ category: 'Milliy' | 'Xalqaro'; subject?: string; type?: string; score?: string }>
    });

    const addCertificate = () => {
        setNewStudent(prev => ({
            ...prev,
            certificates: [
                ...prev.certificates,
                { category: 'Milliy', subject: 'Matematika', score: '' }
            ]
        }));
    };

    const removeCertificate = (index: number) => {
        setNewStudent(prev => ({
            ...prev,
            certificates: prev.certificates.filter((_, i) => i !== index)
        }));
    };

    const updateCertificate = (index: number, key: string, value: string) => {
        setNewStudent(prev => ({
            ...prev,
            certificates: prev.certificates.map((c, i) => {
                if (i !== index) return c;
                const updated = { ...c, [key]: value };
                if (key === 'category') {
                    if (value === 'Milliy') {
                        delete updated.type;
                        updated.subject = 'Matematika';
                    } else {
                        delete updated.subject;
                        updated.type = 'IELTS';
                    }
                }
                return updated;
            })
        }));
    };
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [search, setSearch] = useState('');
    
    // Link creation states
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [applyUrl, setApplyUrl] = useState('');

    const LINK_ROTATE_MS = 30 * 60 * 1000;

    useEffect(() => {
        if (!isLinkModalOpen || !selectedSchoolId) {
            setApplyUrl('');
            setQrCodeDataUrl('');
            return;
        }

        let cancelled = false;

        const generateLink = async () => {
            try {
                const authToken = localStorage.getItem('token');
                const res = await fetch(`/api/public/schools/${selectedSchoolId}/tokens`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await res.json();
                if (cancelled || !data.token) return;

                const url = `${window.location.origin}/apply/${selectedSchoolId}?token=${data.token}`;
                setApplyUrl(url);

                const QRCodeLib = await import('qrcode');
                const QRCode = QRCodeLib.default || QRCodeLib;
                const qrUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
                if (!cancelled) setQrCodeDataUrl(qrUrl);
            } catch (err) {
                console.error(err);
            }
        };

        generateLink();
        const interval = setInterval(generateLink, LINK_ROTATE_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [isLinkModalOpen, selectedSchoolId]);

    const copyLinkToClipboard = () => {
        if (!applyUrl) return;
        navigator.clipboard.writeText(applyUrl)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch(err => console.error("Havolani nusxalashda xatolik:", err));
    };

    const [filters, setFilters] = useState({
        status: '',
        groupId: '',
        balanceStatus: 'all',
        dateRange: 'all',
        orgType: '',
        muassasaSearch: '',
        region: '',
        district: '',
        location: '',
        missingInfo: ''
    });

    const [activeMenu, setActiveMenu] = useState<{
        id: number;
        coords: { top: number; left: number };
    } | null>(null);
    const [studentToDelete, setStudentToDelete] = useState<{ id: number; name: string } | null>(null);

    const handleDeleteStudent = async (id: number, name: string) => {
        setStudentToDelete({ id, name });
    };

    const confirmDeleteStudent = async () => {
        if (!studentToDelete) return;
        try {
            await deleteStudent(studentToDelete.id);
            setStudentToDelete(null);
        } catch (err) {
            console.error("Delete student failed", err);
            alert("O'chirishda xatolik yuz berdi");
        }
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsAdding(true);
            await addStudent({
                ...newStudent,
                status: 'Faol',
                joinedDate: new Date().toISOString().split('T')[0],
                balance: 0,
                groups: newStudent.selectedGroupIds,
                transportId: newStudent.transportId ? Number(newStudent.transportId) : null,
                studentSchool: newStudent.studentSchool,
                privilegeType: newStudent.selectedPrivileges.length ? newStudent.selectedPrivileges.join(',') : 'None',
                certCategory: newStudent.certCategory,
                certSubject: newStudent.certSubject,
                certType: newStudent.certType,
                certScore: newStudent.certScore,
                orgType: newStudent.orgType,
                region: newStudent.region,
                district: newStudent.district,
                customPrices: {},
                certificates: newStudent.certificates
            });
            setIsModalOpen(false);
            setNewStudent({
                name: '', phone: '', address: '', birthDate: '', location: '', photo: '',
                gender: 'Erkak',
                fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
                transportId: '',
                studentSchool: '',
                selectedPrivileges: [],
                certCategory: '',
                certSubject: '',
                certType: '',
                certScore: '',
                orgType: '',
                region: '',
                district: '',
                selectedGroupIds: [],
                certificates: []
            });
        } catch (err) {
            console.error("Add student failed", err);
        } finally {
            setIsAdding(false);
        }
    };

    const handleExport = () => {
        try {
            if (filteredStudents.length === 0) {
                alert("Eksport qilish uchun o'quvchilar mavjud emas!");
                return;
            }

            const exportData = filteredStudents.map(student => {
                const groupNames = groups
                    .filter(g => (student.groups || []).includes(g.id))
                    .map(g => g.name)
                    .join(', ');

                return {
                    "F.I.SH.": student.name,
                    "Telefon": student.phone,
                    "Jins": student.gender || 'Erkak',
                    "Tug'ilgan sana": student.birthDate || '',
                    "Ta'lim muassasasi turi": student.orgType || '',
                    "Muassasa nomi": student.studentSchool || '',
                    "Viloyat": student.region || '',
                    "Tuman": student.district || '',
                    "Manzil (ko'cha, uy)": student.address || '',
                    "Holati": student.status || 'Faol',
                    "A'zo bo'lgan sana": student.joinedDate || '',
                    "Balans (UZS)": student.balance || 0,
                    "Kurslar": groupNames || 'Kurslarsiz',
                    "Otasining ismi": student.fatherName || '',
                    "Otasining telefoni": student.fatherPhone || '',
                    "Onasining ismi": student.motherName || '',
                    "Onasining telefoni": student.motherPhone || ''
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "O'quvchilar");
            
            const maxW = exportData.reduce((w, row) => {
                Object.keys(row).forEach((key, colIdx) => {
                    const cellVal = String(row[key as keyof typeof row] || '');
                    const cellLen = cellVal.length;
                    const keyLen = key.length;
                    const maxLen = Math.max(cellLen, keyLen);
                    w[colIdx] = Math.max(w[colIdx] || 10, maxLen + 2);
                });
                return w;
            }, [] as number[]);
            worksheet['!cols'] = maxW.map(w => ({ wch: w }));

            XLSX.writeFile(workbook, `Sariosiyo_CRM_Oquvchilar_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error("Export failed", err);
            alert("Eksport qilishda xatolik yuz berdi");
        }
    };

    const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        try {
            setIsImporting(true);
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const workbook = XLSX.read(bstr, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

                    if (rawData.length === 0) {
                        alert("Fayl ichida ma'lumot topilmadi!");
                        setIsImporting(false);
                        return;
                    }

                    const mappedStudents = rawData.map((row: any) => {
                        const name = row["F.I.SH."] || row["F.I.SH"] || row["name"] || row["Name"] || row["Ism Familiya"] || row["Ism"];
                        const phone = row["Telefon"] || row["phone"] || row["Phone"] || row["Telefon raqami"] || row["Tel"];
                        const birthDate = row["Tug'ilgan sana"] || row["birthDate"] || row["Birth Date"] || row["Tug'ilgan yili"];
                        const orgType = row["Ta'lim muassasasi turi"] || row["orgType"] || row["Muassasa turi"] || '';
                        const studentSchool = row["Muassasa nomi"] || row["Maktab/Bog'cha"] || row["Maktab"] || row["Bog'cha"] || row["studentSchool"] || row["School"];
                        const region = row["Viloyat"] || row["region"] || '';
                        const district = row["Tuman"] || row["district"] || '';
                        const address = row["Manzil (ko'cha, uy)"] || row["Yashash manzili"] || row["address"] || row["Address"] || row["Manzil"];
                        const status = row["Holati"] || row["status"] || row["Status"] || "Faol";
                        const joinedDate = row["A'zo bo'lgan sana"] || row["joinedDate"] || row["Joined Date"] || new Date().toISOString().split('T')[0];
                        const balance = row["Balans (UZS)"] || row["balance"] || row["Balance"] || 0;
                        const gender = row["Jins"] || row["gender"] || row["Gender"] || 'Erkak';
                        const fatherName = row["Otasining ismi"] || row["fatherName"] || row["Father Name"];
                        const fatherPhone = row["Otasining telefoni"] || row["fatherPhone"] || row["Father Phone"];
                        const motherName = row["Onasining ismi"] || row["motherName"] || row["Mother Name"];
                        const motherPhone = row["Onasining telefoni"] || row["motherPhone"] || row["Mother Phone"];

                        return {
                            name,
                            phone,
                            gender: ['Erkak','Ayol'].includes(String(gender)) ? String(gender) : 'Erkak',
                            birthDate: birthDate ? String(birthDate) : '',
                            orgType: orgType ? String(orgType) : '',
                            studentSchool: studentSchool ? String(studentSchool) : '',
                            region: region ? String(region) : '',
                            district: district ? String(district) : '',
                            address: address ? String(address) : '',
                            status: status ? String(status) : 'Faol',
                            joinedDate: joinedDate ? String(joinedDate) : new Date().toISOString().split('T')[0],
                            balance: balance ? Number(balance) : 0,
                            fatherName: fatherName ? String(fatherName) : '',
                            fatherPhone: fatherPhone ? String(fatherPhone) : '',
                            motherName: motherName ? String(motherName) : '',
                            motherPhone: motherPhone ? String(motherPhone) : ''
                        };
                    }).filter(s => s.name && s.phone);

                    if (mappedStudents.length === 0) {
                        alert("Import qilish uchun yaroqli ma'lumot topilmadi! (F.I.SH. va Telefon ustunlari bo'lishi shart)");
                        setIsImporting(false);
                        return;
                    }

                    if (window.confirm(`${mappedStudents.length} ta o'quvchini import qilishni tasdiqlaysizmi?`)) {
                        await importStudents(mappedStudents);
                    }
                } catch (err: any) {
                    console.error("Error parsing excel", err);
                    alert("Faylni o'qishda xatolik: " + err.message);
                } finally {
                    setIsImporting(false);
                }
            };
            reader.readAsBinaryString(file);
        } catch (err: any) {
            console.error("FileReader error", err);
            alert("FileReader ishga tushirishda xatolik: " + err.message);
            setIsImporting(false);
        }
    };

    const handleRemoveBg = async () => {
        if (!newStudent.photo) return;
        try {
            setIsRemovingBg(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/utils/remove-bg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ image: newStudent.photo })
            });
            const data = await response.json();
            if (data.success) {
                setNewStudent({ ...newStudent, photo: data.image });
            } else {
                alert("Xatolik: " + data.error);
            }
        } catch (err) {
            console.error("BG Removal failed", err);
            alert("Xatolik yuz berdi");
        } finally {
            setIsRemovingBg(false);
        }
    };

    const getStudentGroups = (studentGroupIds: number[]) => {
        return groups.filter(g => (studentGroupIds || []).includes(g.id)).map(g => {
            const teacher = teachers.find(t => t.id === g.teacherId);
            return {
                ...g, teacherName: teacher?.name || "Noma'lum"
            };
        });
    }

    const filteredStudents = students.filter(s => {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = (s.name || '').toLowerCase().includes(lowerSearch) ||
               (s.phone || '').toLowerCase().includes(lowerSearch) ||
               (s.studentSchool || '').toLowerCase().includes(lowerSearch);
        
        const matchesStatus = !filters.status || s.status === filters.status;
        const matchesGroup = !filters.groupId || (s.groups || []).includes(Number(filters.groupId));
        const matchesOrgType = !filters.orgType || s.orgType === filters.orgType;
        const matchesMuassasa = !filters.muassasaSearch || (s.studentSchool || '').toLowerCase().includes(filters.muassasaSearch.toLowerCase());
        const matchesRegion = !filters.region || s.region === filters.region;
        const matchesDistrict = !filters.district || s.district === filters.district;
        const matchesLocation = !filters.location || s.location === filters.location;
        
        let matchesBalance = true;
        if (filters.balanceStatus === 'debt') matchesBalance = (s.balance || 0) < 0;
        else if (filters.balanceStatus === 'positive') matchesBalance = (s.balance || 0) >= 0;

        let matchesDate = true;
        if (filters.dateRange !== 'all') {
            const date = new Date(s.joinedDate);
            const now = new Date();
            if (filters.dateRange === 'today') matchesDate = date.toDateString() === now.toDateString();
            else if (filters.dateRange === 'week') matchesDate = (now.getTime() - date.getTime()) < 7 * 864e5;
            else if (filters.dateRange === 'month') matchesDate = (now.getTime() - date.getTime()) < 30 * 864e5;
        }

        let matchesMissingInfo = true;
        if (filters.missingInfo === 'fatherName') {
            matchesMissingInfo = !s.fatherName || s.fatherName.trim() === '';
        } else if (filters.missingInfo === 'fatherPhone') {
            matchesMissingInfo = !s.fatherPhone || s.fatherPhone.trim() === '';
        } else if (filters.missingInfo === 'studentSchool') {
            matchesMissingInfo = !s.studentSchool || s.studentSchool.trim() === '';
        } else if (filters.missingInfo === 'photo') {
            matchesMissingInfo = !s.photo || s.photo.trim() === '';
        } else if (filters.missingInfo === 'no_telegram') {
            matchesMissingInfo = (!s.telegramId || s.telegramId.trim() === '') &&
                                 (!s.fatherTelegramId || s.fatherTelegramId.trim() === '') &&
                                 (!s.motherTelegramId || s.motherTelegramId.trim() === '');
        } else if (filters.missingInfo === 'parent_no_telegram') {
            const fatherMissing = !!s.fatherPhone && (!s.fatherTelegramId || s.fatherTelegramId.trim() === '');
            const motherMissing = !!s.motherPhone && (!s.motherTelegramId || s.motherTelegramId.trim() === '');
            matchesMissingInfo = fatherMissing || motherMissing;
        }

        return matchesSearch && matchesStatus && matchesGroup && matchesBalance && matchesDate && matchesOrgType && matchesMuassasa && matchesRegion && matchesDistrict && matchesLocation && matchesMissingInfo;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <GraduationCap size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('students_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('students_count_summary').replace('{total}', String(students.length)).replace('{found}', String(filteredStudents.length))}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer"
                        >
                            <FileSpreadsheet size={14} /> {t('export')}
                        </button>
                        <button 
                            onClick={() => document.getElementById('import-excel-input')?.click()}
                            disabled={isImporting}
                            className="flex items-center gap-2 px-3 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                        >
                            <FileSpreadsheet size={14} /> {t('import')}
                        </button>
                        <input type="file" id="import-excel-input" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportChange} />
                        {selectedSchoolId !== 0 && (
                            <button
                                onClick={() => setIsLinkModalOpen(true)}
                                className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                            >
                                <QrCode size={14} /> {t('create_link')}
                            </button>
                        )}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add')}
                        </button>
                    </div>
                </div>

                <div className="px-6 pb-5 pt-3 border-t border-gray-50 dark:border-gray-700/50 space-y-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder_students')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-3">
                        <div>
                            <label className={lbl}>{t('filter_status')}</label>
                            <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                <option value="Faol">{t('status_active')}</option>
                                <option value="Passiv">{t('status_passive')}</option>
                                <option value="Muzlatilgan">{t('status_frozen')}</option>
                                <option value="Sertifikatli">{t('status_certified')}</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>{t('filter_group')}</label>
                            <select value={filters.groupId} onChange={e => setFilters({...filters, groupId: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>{t('filter_balance')}</label>
                            <select value={filters.balanceStatus} onChange={e => setFilters({...filters, balanceStatus: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="all">{t('all')}</option>
                                <option value="debt">{t('debtors')}</option>
                                <option value="positive">{t('paid_students')}</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Muassasa turi</label>
                            <select value={filters.orgType} onChange={e => setFilters({...filters, orgType: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                <option value="Maktab">Maktab</option>
                                <option value="Prezident maktabi">Prezident maktabi</option>
                                <option value="Kollej / Litsey">Kollej / Litsey</option>
                                <option value="Oliy o'quv yurti">Oliy o'quv yurti</option>
                                <option value="Boshqa">Boshqa</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Muassasa nomi</label>
                            <input
                                type="text"
                                value={filters.muassasaSearch}
                                onChange={e => setFilters({...filters, muassasaSearch: e.target.value})}
                                placeholder="Masalan: 42-maktab"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                            />
                        </div>
                        <div>
                            <label className={lbl}>Viloyat</label>
                            <select value={filters.region} onChange={e => setFilters({...filters, region: e.target.value, district: ''})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {Object.keys(UZB_REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Tuman</label>
                            <select value={filters.district} onChange={e => setFilters({...filters, district: e.target.value})}
                                disabled={!filters.region}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer disabled:opacity-50">
                                <option value="">Barchasi</option>
                                {filters.region && UZB_REGIONS[filters.region]?.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`${lbl} text-rose-500`}>{t('filter_defects')}</label>
                            <select value={filters.missingInfo} onChange={e => setFilters({...filters, missingInfo: e.target.value})}
                                className="w-full px-3 py-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-xl text-[10px] font-bold text-rose-700 dark:text-rose-400 outline-none focus:border-rose-500 transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                <option value="fatherName">{t('defect_father_name').replace('{count}', String(students.filter(s => !s.fatherName || s.fatherName.trim() === '').length))}</option>
                                <option value="fatherPhone">{t('defect_father_phone').replace('{count}', String(students.filter(s => !s.fatherPhone || s.fatherPhone.trim() === '').length))}</option>
                                <option value="studentSchool">{t('defect_school').replace('{count}', String(students.filter(s => !s.studentSchool || s.studentSchool.trim() === '').length))}</option>
                                <option value="photo">{t('defect_photo').replace('{count}', String(students.filter(s => !s.photo || s.photo.trim() === '').length))}</option>
                                <option value="no_telegram">{t('defect_no_telegram').replace('{count}', String(students.filter(s => (!s.telegramId || s.telegramId.trim() === '') && (!s.fatherTelegramId || s.fatherTelegramId.trim() === '') && (!s.motherTelegramId || s.motherTelegramId.trim() === '')).length))}</option>
                                <option value="parent_no_telegram">{t('defect_parent_no_telegram').replace('{count}', String(students.filter(s => (!!s.fatherPhone && (!s.fatherTelegramId || s.fatherTelegramId.trim() === '')) || (!!s.motherPhone && (!s.motherTelegramId || s.motherTelegramId.trim() === ''))).length))}</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => { setSearch(''); setFilters({status: '', groupId: '', balanceStatus: 'all', dateRange: 'all', orgType: '', muassasaSearch: '', region: '', district: '', location: '', missingInfo: ''}); }}
                                className="w-full py-2 text-[10px] font-extrabold uppercase text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer">
                                <X size={12} /> {t('filter_clear')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table layout */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">ID</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('student')}</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{t('student_phone')}</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('student_groups')}</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">{t('student_balance')}</th>
                                <th className="p-4 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/students/${student.id}`)}>
                                    <td className="p-4 text-[10px] font-extrabold text-gray-400 text-center tabular-nums">#{student.id}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[#1b6b6b] font-bold text-xs shadow-inner overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                                                {student.photo ? (
                                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                                ) : student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors">{student.name}</p>
                                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wider">{t('date')}: {student.joinedDate}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-[10px] font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700 tabular-nums">
                                            {student.phone}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {getStudentGroups(student.groups || []).map(g => (
                                                <span key={g.id} className="px-2 py-0.5 bg-[#1b6b6b]/10 text-[#1b6b6b] rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                                                    {g.name}
                                                </span>
                                            ))}
                                            {(student.groups || []).length === 0 && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">{t('no_group')}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${
                                                student.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                student.status === 'Sinov' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400' :
                                                student.status === 'Muzlatilgan' ? 'bg-sky-50 text-sky-650 border-sky-100 dark:bg-sky-950/20 dark:text-sky-455' :
                                                student.status === 'Passiv' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400' :
                                                student.status === 'Bitiruvchi' ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400' :
                                                student.status === 'Sertifikatli' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400' :
                                                'bg-gray-55 text-gray-400 border-gray-100 dark:bg-gray-900/50'
                                            }`}>
                                                {student.status === 'Faol' ? t('status_active') : 
                                                 student.status === 'Arxiv' ? t('status_archive') : 
                                                 student.status === 'Sinov' ? t('status_test') : 
                                                 student.status === 'Muzlatilgan' ? t('status_frozen') :
                                                 student.status === 'Passiv' ? t('status_passive') :
                                                 student.status === 'Bitiruvchi' ? t('status_graduated') :
                                                 student.status === 'Sertifikatli' ? t('status_certified') :
                                                 student.status}
                                            </span>
                                            <span className={`text-xs font-extrabold tabular-nums ${student.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {student.balance.toLocaleString()} UZS
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={(e) => {
                                            if (activeMenu?.id === student.id) {
                                                setActiveMenu(null);
                                            } else {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setActiveMenu({
                                                    id: student.id,
                                                    coords: {
                                                        top: rect.bottom,
                                                        left: rect.right
                                                    }
                                                });
                                            }
                                        }}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] overflow-y-auto">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    
                    {/* Centering Wrapper */}
                    <div className="flex min-h-full items-center justify-center p-4">
                        {/* Modal Panel */}
                        <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-lg p-8 transform transition-all">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                                <div className="text-left">
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('new_student_title')}</h3>
                                    <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('student_details_subtitle')}</p>
                                </div>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleAddStudent} className="space-y-4 text-left">
                                <div>
                                    <label className={lbl}>{t('full_name')}</label>
                                    <input required type="text" placeholder="Jasur Alimov" className={inp} value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl}>{t('student_phone')} *</label>
                                        <input required type="tel" placeholder="+998" className={inp} value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl}>{t('birth_date')}</label>
                                        <input type="date" className={inp} value={newStudent.birthDate} onChange={e => setNewStudent({ ...newStudent, birthDate: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className={lbl}>Jins</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Erkak', 'Ayol'] as const).map(g => (
                                            <button key={g} type="button"
                                                onClick={() => setNewStudent({ ...newStudent, gender: g })}
                                                className={`py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all border cursor-pointer ${newStudent.gender === g ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow' : 'bg-gray-50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-700 text-gray-400 hover:text-gray-600'}`}>
                                                {g === 'Erkak' ? '♂ Erkak' : '♀ Ayol'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl}>Ta'lim muassasasi turi</label>
                                        <select
                                            value={newStudent.orgType}
                                            onChange={e => setNewStudent({...newStudent, orgType: e.target.value})}
                                            className={inp}
                                        >
                                            <option value="">Tanlang...</option>
                                            <option value="Maktab">Maktab</option>
                                            <option value="Prezident maktabi">Prezident maktabi</option>
                                            <option value="Kollej / Litsey">Kollej / Litsey</option>
                                            <option value="Oliy o'quv yurti">Oliy o'quv yurti</option>
                                            <option value="Boshqa">Boshqa</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={lbl}>Muassasa nomi</label>
                                        <input type="text" placeholder="42-maktab" className={inp} value={newStudent.studentSchool} onChange={e => setNewStudent({ ...newStudent, studentSchool: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl}>Viloyat</label>
                                        <select
                                            value={newStudent.region}
                                            onChange={e => setNewStudent({...newStudent, region: e.target.value, district: ''})}
                                            className={inp}
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
                                            value={newStudent.district}
                                            onChange={e => setNewStudent({...newStudent, district: e.target.value})}
                                            className={inp}
                                            disabled={!newStudent.region}
                                        >
                                            <option value="">Tanlang...</option>
                                            {newStudent.region && UZB_REGIONS[newStudent.region]?.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl}>{t('transport')}</label>
                                        <select className={inp} value={newStudent.transportId} onChange={e => setNewStudent({...newStudent, transportId: e.target.value})}>
                                            <option value="">{t('not_needed')}</option>
                                            {transports.map(tr => <option key={tr.id} value={tr.id}>{tr.name} ({tr.number})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={lbl}>Manzil (ko'cha, uy)</label>
                                        <input type="text" placeholder="Navruz ko'chasi, 12-uy" className={inp} value={newStudent.address} onChange={e => setNewStudent({ ...newStudent, address: e.target.value })} />
                                    </div>
                                </div>
                                <button type="button" onClick={() => setIsMapOpen(true)}
                                    className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${newStudent.location ? 'bg-[#1b6b6b]/10 text-[#1b6b6b] border-[#1b6b6b]' : 'bg-gray-55 dark:bg-gray-900 border-gray-100 hover:bg-gray-100'}`}>
                                    <MapPin size={14} /> {newStudent.location ? t('marked_on_map') : t('select_from_map')}
                                </button>
                                <div>
                                    <label className={lbl}>Imtiyoz turi (bir nechtasini tanlash mumkin)</label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {['Nogironligi bor', 'Harbiy oila', 'Xotin-qizlar daftari', 'Sertifikat'].map(priv => {
                                            const checked = newStudent.selectedPrivileges.includes(priv);
                                            return (
                                                <button
                                                    key={priv}
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = checked
                                                            ? newStudent.selectedPrivileges.filter(p => p !== priv)
                                                            : [...newStudent.selectedPrivileges, priv];
                                                        setNewStudent({
                                                            ...newStudent,
                                                            selectedPrivileges: updated,
                                                            certCategory: updated.includes('Sertifikat') ? (newStudent.certCategory || 'Milliy') : '',
                                                            certSubject: updated.includes('Sertifikat') ? newStudent.certSubject : '',
                                                            certType: updated.includes('Sertifikat') ? newStudent.certType : ''
                                                        });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border-2 transition-all cursor-pointer ${
                                                        checked
                                                            ? 'bg-[#1b6b6b] text-white border-[#1b6b6b] shadow-lg shadow-[#1b6b6b]/30'
                                                            : 'bg-transparent text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 hover:border-[#1b6b6b] hover:text-[#1b6b6b]'
                                                    }`}
                                                >
                                                    {checked ? '✓ ' : ''}{priv}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {newStudent.selectedPrivileges.includes('Sertifikat') && (
                                    <div className="space-y-3 p-3 bg-gray-55 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <div>
                                            <label className={lbl}>Sertifikat toifasi</label>
                                            <select 
                                                value={newStudent.certCategory} 
                                                onChange={e => setNewStudent({
                                                    ...newStudent, 
                                                    certCategory: e.target.value,
                                                    certSubject: e.target.value === 'Milliy' ? newStudent.certSubject || 'Matematika' : '',
                                                    certType: e.target.value === 'Xalqaro' ? newStudent.certType || 'IELTS' : ''
                                                })} 
                                                className={inp}
                                            >
                                                <option value="Milliy">Milliy sertifikat</option>
                                                <option value="Xalqaro">Xalqaro sertifikat</option>
                                            </select>
                                        </div>

                                        {newStudent.certCategory === 'Milliy' && (
                                            <div>
                                                <label className={lbl}>Sertifikat fani</label>
                                                <select 
                                                    value={newStudent.certSubject} 
                                                    onChange={e => setNewStudent({...newStudent, certSubject: e.target.value})} 
                                                    className={inp}
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

                                        {newStudent.certCategory === 'Xalqaro' && (
                                            <div>
                                                <label className={lbl}>Sertifikat turi</label>
                                                <select
                                                    value={newStudent.certType}
                                                    onChange={e => setNewStudent({...newStudent, certType: e.target.value})}
                                                    className={inp}
                                                >
                                                    <option value="">Tanlang...</option>
                                                    <option value="IELTS">IELTS</option>
                                                    <option value="SAT">SAT</option>
                                                    <option value="TOEFL">TOEFL</option>
                                                    <option value="CEFR">CEFR</option>
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <label className={lbl}>Ball / Foiz</label>
                                            <input
                                                type="text"
                                                value={newStudent.certScore}
                                                onChange={e => setNewStudent({...newStudent, certScore: e.target.value})}
                                                placeholder={newStudent.certCategory === 'Xalqaro' ? 'Misol: 7.5 yoki 1450' : 'Misol: 94.8%'}
                                                className={inp}
                                            />
                                        </div>

                                        {/* Dynamic multi-certificates array */}
                                        <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-3 mt-3 space-y-3">
                                            <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">Qo'shimcha Sertifikatlar</span>
                                            {newStudent.certificates.map((cert, index) => (
                                                <div key={index} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3 relative">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeCertificate(index)}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                    
                                                    <div>
                                                        <label className={lbl}>Sertifikat toifasi</label>
                                                        <select
                                                            value={cert.category}
                                                            onChange={e => updateCertificate(index, 'category', e.target.value)}
                                                            className={inp}
                                                        >
                                                            <option value="Milliy">Milliy sertifikat</option>
                                                            <option value="Xalqaro">Xalqaro sertifikat</option>
                                                        </select>
                                                    </div>

                                                    {cert.category === 'Milliy' && (
                                                        <div>
                                                            <label className={lbl}>Sertifikat fani</label>
                                                            <select
                                                                value={cert.subject || ''}
                                                                onChange={e => updateCertificate(index, 'subject', e.target.value)}
                                                                className={inp}
                                                            >
                                                                <option value="Matematika">Matematika</option>
                                                                <option value="Fizika">Fizika</option>
                                                                <option value="Kimyo">Kimyo</option>
                                                                <option value="Biologiya">Biologiya</option>
                                                                <option value="Tarix">Tarix</option>
                                                                <option value="Ingliz tili">Ingliz tili</option>
                                                                <option value="Nemis tili">Nemis tili</option>
                                                                <option value="Rus tili">Rus tili</option>
                                                                <option value="Ona tili">Ona tili</option>
                                                                <option value="Boshqa">Boshqa</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {cert.category === 'Xalqaro' && (
                                                        <div>
                                                            <label className={lbl}>Sertifikat turi</label>
                                                            <select
                                                                value={cert.type || ''}
                                                                onChange={e => updateCertificate(index, 'type', e.target.value)}
                                                                className={inp}
                                                            >
                                                                <option value="IELTS">IELTS</option>
                                                                <option value="SAT">SAT</option>
                                                                <option value="TOEFL">TOEFL</option>
                                                                <option value="CEFR">CEFR</option>
                                                                <option value="Boshqa">Boshqa</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className={lbl}>Ball / Foiz</label>
                                                        <input
                                                            type="text"
                                                            placeholder={cert.category === 'Xalqaro' ? 'Misol: 7.5 yoki 1450' : 'Misol: 94.8%'}
                                                            value={cert.score || ''}
                                                            onChange={e => updateCertificate(index, 'score', e.target.value)}
                                                            className={inp}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <button
                                                type="button"
                                                onClick={addCertificate}
                                                className="w-full py-2.5 bg-white dark:bg-slate-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#1b6b6b] hover:bg-teal-50/10 dark:hover:bg-teal-900/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <Plus size={13} />
                                                Sertifikat qo'shish
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-4 mt-4 space-y-3">
                                    <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">Kursga qo'shish</span>
                                    {groups.length === 0 ? (
                                        <p className="text-[10px] text-gray-400 italic">Kurslar mavjud emas</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {groups.map(g => {
                                                const selected = newStudent.selectedGroupIds.includes(g.id);
                                                return (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = selected
                                                                ? newStudent.selectedGroupIds.filter(id => id !== g.id)
                                                                : [...newStudent.selectedGroupIds, g.id];
                                                            setNewStudent({...newStudent, selectedGroupIds: updated});
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border-2 transition-all cursor-pointer ${
                                                            selected
                                                                ? 'bg-[#1b6b6b] text-white border-[#1b6b6b] shadow-lg shadow-[#1b6b6b]/30'
                                                                : 'bg-transparent text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 hover:border-[#1b6b6b] hover:text-[#1b6b6b]'
                                                        }`}
                                                    >
                                                        {selected ? '✓ ' : '+ '}{g.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">{t('parent_info')}</span>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={lbl}>{t('father_name')}</label>
                                            <input type="text" placeholder="FISH" className={inp} value={newStudent.fatherName} onChange={e => setNewStudent({ ...newStudent, fatherName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={lbl}>{t('father_phone')}</label>
                                            <input type="tel" placeholder="+998" className={inp} value={newStudent.fatherPhone} onChange={e => setNewStudent({ ...newStudent, fatherPhone: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={lbl}>{t('mother_name')}</label>
                                            <input type="text" placeholder="FISH" className={inp} value={newStudent.motherName} onChange={e => setNewStudent({ ...newStudent, motherName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={lbl}>{t('mother_phone')}</label>
                                            <input type="tel" placeholder="+998" className={inp} value={newStudent.motherPhone} onChange={e => setNewStudent({ ...newStudent, motherPhone: e.target.value })} />
                                        </div>
                                    </div>
                                </div>


                                <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">{t('photo_label')}</span>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-2xl bg-gray-55 dark:bg-gray-900 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                            {newStudent.photo ? <img src={newStudent.photo} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-300" />}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                 <label className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-100 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 text-[10px] font-bold uppercase tracking-wider">
                                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                         const file = e.target.files?.[0];
                                                         if (file) {
                                                             const reader = new FileReader();
                                                             reader.onloadend = async () => {
                                                                 const compressed = await compressImage(reader.result as string);
                                                                 setNewStudent({ ...newStudent, photo: compressed });
                                                             };
                                                             reader.readAsDataURL(file);
                                                         }
                                                     }} />
                                                     {t('photo_from_file')}
                                                 </label>
                                                <button type="button" onClick={() => setIsPhotoModalOpen(true)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-55 text-[10px] font-bold uppercase tracking-wider cursor-pointer">
                                                    {t('photo_camera')}
                                                </button>
                                            </div>
                                            {newStudent.photo && (
                                                <button type="button" onClick={handleRemoveBg} disabled={isRemovingBg}
                                                    className="w-full py-2 bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400 rounded-xl border border-violet-100 dark:border-violet-900 text-[9px] font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer">
                                                    {t('clear_bg')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                        {t('cancel')}
                                    </button>
                                    <button type="submit" disabled={isAdding}
                                        className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer disabled:opacity-50">
                                        {isAdding ? t('saving') : t('save')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {isPhotoModalOpen && (
                <PhotoCapture
                    onCapture={async (photo) => {
                        const compressed = await compressImage(photo);
                        setNewStudent({ ...newStudent, photo: compressed });
                    }}
                    onClose={() => setIsPhotoModalOpen(false)}
                />
            )}

            {isMapOpen && (
                <MapPicker 
                    initialLocation={newStudent.location}
                    onSelect={(loc) => setNewStudent({ ...newStudent, location: loc })}
                    onClose={() => setIsMapOpen(false)}
                />
            )}

            {studentToDelete && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setStudentToDelete(null)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center border border-gray-100 dark:border-gray-700">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">{t('delete_confirm_title')}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-6">
                            {t('delete_confirm_desc').replace('{name}', studentToDelete.name)}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setStudentToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer">
                                {t('cancel')}
                            </button>
                            <button onClick={confirmDeleteStudent} className="flex-1 py-2.5 bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer">
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isLinkModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsLinkModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-150 dark:border-gray-700/50">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('reception_link')}</h3>
                            <button onClick={() => setIsLinkModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-2">
                            {t('reception_link_desc')}
                        </p>
                        <p className="text-[9px] font-bold text-amber-500 leading-relaxed mb-6 normal-case">
                            {t('reception_link_rotate')}
                        </p>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 dark:border-gray-200 w-fit mx-auto mb-6 shadow-sm">
                            {qrCodeDataUrl ? (
                                <img src={qrCodeDataUrl} alt="QR Code" className="w-[180px] h-[180px] block" />
                            ) : (
                                <div className="w-[180px] h-[180px] flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-[#1b6b6b] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 bg-gray-55 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-750">
                                <span className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-wider shrink-0">{t('link')}:</span>
                                <input
                                    readOnly
                                    type="text"
                                    value={applyUrl || t('loading')}
                                    className="bg-transparent border-none text-[10px] font-extrabold text-gray-700 dark:text-white outline-none w-full select-all"
                                />
                            </div>
                            <button
                                onClick={copyLinkToClipboard}
                                className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                                    copySuccess 
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/10' 
                                        : 'bg-[#1b6b6b] hover:bg-[#155252] text-white shadow-lg shadow-[#1b6b6b]/15'
                                }`}
                            >
                                {copySuccess ? t('copied') : t('copy_link')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeMenu && (
                <>
                    <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setActiveMenu(null)} />
                    <div 
                        style={{ 
                            position: 'fixed', 
                            top: `${activeMenu.coords.top + 4}px`, 
                            left: `${activeMenu.coords.left - 128}px`,
                        }}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl py-1 w-32 z-50 text-left animate-in slide-in-from-top-1 duration-150"
                    >
                        <button onClick={() => { setActiveMenu(null); navigate(`/students/${activeMenu.id}`); }}
                            className="w-full text-left px-4 py-2 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-55 dark:hover:bg-gray-700 uppercase tracking-widest cursor-pointer">
                            {t('details')}
                        </button>
                        <button onClick={() => { setActiveMenu(null); handleDeleteStudent(activeMenu.id, students.find(s => s.id === activeMenu.id)?.name || ''); }}
                            className="w-full text-left px-4 py-2 text-[10px] font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/30 uppercase tracking-widest cursor-pointer">
                            {t('delete')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
