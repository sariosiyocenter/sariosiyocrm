import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, FileSpreadsheet, MoreVertical, X, Image as ImageIcon, MapPin, GraduationCap, QrCode, Trash2, SlidersHorizontal } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { useLang } from '../context/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { displayName } from '../lib/displayName';
import PhotoCapture from './PhotoCapture';
import MapPicker from './MapPicker';
import { compressImage } from '../lib/image';
import * as XLSX from 'xlsx';

const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] text-matn-xira mb-1.5";

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
    const { students, groups, teachers, transports, attendances, addStudent, deleteStudent, importStudents, selectedSchoolId, showNotification } = useCRM();
    const confirm = useConfirm();
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
    const [page, setPage] = useState(1);

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

    const [quickFilter, setQuickFilter] = useState<'all' | 'qarzdor' | 'kelmayotgan' | 'faol' | 'arxiv'>('all');
    /** Kengaytirilgan filtrlar yopiq turadi: sakkizta ochiladigan ro'yxat doim
     *  ochiq bo'lganda ekranning uchdan birini egallar, lekin ularning deyarli
     *  hammasida "Barchasi" tanlangan bo'lardi. Tugmada nechta filtr yoqilgani
     *  ko'rinib turadi, ya'ni yopiq holatda ham hech narsa yashirin qolmaydi. */
    const [showFilters, setShowFilters] = useState(false);

    const DEFAULT_FILTERS = {
        status: '', groupId: '', balanceStatus: 'all', dateRange: 'all', orgType: '',
        muassasaSearch: '', region: '', district: '', location: '', missingInfo: '',
    };

    /** Tez filtr chiplari uchun sanoq. Ular joriy filtrga bog'liq emas —
     *  aks holda bitta chip bosilgach qolganlari nolga tushib qolardi. */
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const lastSeen = (id: number) => {
        const ds = (attendances || []).filter(a => a.studentId === id && a.status === 'Keldi').map(a => a.date).sort();
        return ds[ds.length - 1] || null;
    };
    const quickCounts = {
        all: students.length,
        faol: students.filter(s => s.status === 'Faol').length,
        qarzdor: students.filter(s => (s.balance || 0) < 0).length,
        kelmayotgan: students.filter(s => s.status === 'Faol' && (lastSeen(s.id) ?? '') < twoWeeksAgo).length,
        arxiv: students.filter(s => s.status === 'Arxiv').length,
    };

    // Yuqori paneldagi "N qarzdor" tugmasi bu yerga ?filter=debt bilan olib keladi.
    const [searchParams] = useSearchParams();
    const [filters, setFilters] = useState({
        status: '',
        groupId: '',
        balanceStatus: searchParams.get('filter') === 'debt' ? 'debt' : 'all',
        dateRange: 'all',
        orgType: '',
        muassasaSearch: '',
        region: '',
        district: '',
        location: '',
        missingInfo: ''
    });

    // Ro'yxat allaqachon ochiq bo'lsa komponent qayta yaratilmaydi, shuning uchun
    // manzildagi filtrni alohida kuzatamiz.
    React.useEffect(() => {
        const wanted = searchParams.get('filter') === 'debt' ? 'debt' : null;
        if (wanted) setFilters(f => (f.balanceStatus === wanted ? f : { ...f, balanceStatus: wanted }));
    }, [searchParams]);

    // Filtr tugmasidagi raqam: nechta filtr sukutdan farq qiladi.
    const activeFilterCount = Object.entries(filters).filter(([k, v]) =>
        v !== '' && !(k === 'balanceStatus' && v === 'all') && !(k === 'dateRange' && v === 'all')).length;

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
            showNotification("O'chirishda xatolik yuz berdi", 'error');
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
                showNotification("Eksport qilish uchun o'quvchilar mavjud emas!", 'info');
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
            showNotification("Eksport qilishda xatolik yuz berdi", 'error');
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
                        showNotification("Fayl ichida ma'lumot topilmadi!", 'error');
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
                        showNotification("Import qilish uchun yaroqli ma'lumot topilmadi! (F.I.SH. va Telefon ustunlari bo'lishi shart)", 'error');
                        setIsImporting(false);
                        return;
                    }

                    if (await confirm(`${mappedStudents.length} ta o'quvchini import qilishni tasdiqlaysizmi?`)) {
                        await importStudents(mappedStudents);
                    }
                } catch (err: any) {
                    console.error("Error parsing excel", err);
                    showNotification("Faylni o'qishda xatolik: " + err.message, 'error');
                } finally {
                    setIsImporting(false);
                }
            };
            reader.readAsBinaryString(file);
        } catch (err: any) {
            console.error("FileReader error", err);
            showNotification("FileReader ishga tushirishda xatolik: " + err.message, 'error');
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
                showNotification("Xatolik: " + data.error, 'error');
            }
        } catch (err) {
            console.error("BG Removal failed", err);
            showNotification("Xatolik yuz berdi", 'error');
        } finally {
            setIsRemovingBg(false);
        }
    };

    // Telefonni o'qiladigan holga keltiradi: +998917309709 -> +998 91 730 97 09
    const phoneFmt = (raw?: string) => {
        const d = (raw || '').replace(/\D/g, '');
        if (d.length === 12 && d.startsWith('998'))
            return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
        return raw || '';
    };

    // Ism bosh harflari — surat yo'q o'quvchilar uchun. Ilgari bo'sh doira
    // turardi va ro'yxat teshik-teshik ko'rinardi.
    const initials = (name: string) =>
        displayName(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

    // Davomat foizi mavjud yozuvlardan. "Dars bo'lmadi" hisobga olinmaydi,
    // chunki bu o'quvchining aybi emas. Yozuvi yo'q o'quvchida foiz
    // ko'rsatilmaydi — nol deb yozish yolg'on bo'lardi.
    const attRate = useMemo(() => {
        const acc = new Map<number, { keldi: number; jami: number }>();
        for (const a of (attendances || [])) {
            if (a.status === 'Dars bo\'lmadi') continue;
            const e = acc.get(a.studentId) || { keldi: 0, jami: 0 };
            e.jami++;
            if (a.status === 'Keldi' || a.status === 'Kechikdi' || a.status === 'ErtaKetdi') e.keldi++;
            acc.set(a.studentId, e);
        }
        const out = new Map<number, number>();
        acc.forEach((v, k) => { if (v.jami) out.set(k, Math.round((v.keldi / v.jami) * 100)); });
        return out;
    }, [attendances]);

    const getStudentGroups = (studentGroupIds: number[]) => {
        return groups.filter(g => (studentGroupIds || []).includes(g.id)).map(g => {
            const teacher = teachers.find(t => t.id === g.teacherId);
            return {
                ...g, teacherName: teacher?.name || "Noma'lum"
            };
        });
    }

    // Memoised: with 266 students and eleven filters, re-running this on every render
    // (including every keystroke elsewhere on the page) was visible as input lag.
    const filteredStudents = React.useMemo(() => students.filter(s => {
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
        // Tez filtr chiplari asosiy filtrlardan mustaqil ishlaydi.
        let matchesQuick = true;
        if (quickFilter === 'qarzdor') matchesQuick = (s.balance || 0) < 0;
        else if (quickFilter === 'faol') matchesQuick = s.status === 'Faol';
        else if (quickFilter === 'arxiv') matchesQuick = s.status === 'Arxiv';
        else if (quickFilter === 'kelmayotgan') matchesQuick = s.status === 'Faol' && (lastSeen(s.id) ?? '') < twoWeeksAgo;
        if (!matchesQuick) return false;

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
    }), [students, search, filters]);

    // The table used to render every match at once — 266 rows, each with a photo.
    const PER_PAGE = 50;
    const pageCount = Math.max(1, Math.ceil(filteredStudents.length / PER_PAGE));
    const currentPage = Math.min(page, pageCount);
    const visibleStudents = filteredStudents.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    // Back to page one whenever the result set changes — filters, but also the list
    // itself shrinking (switching branch now keeps this screen mounted, so a stale page
    // number would otherwise survive into a shorter list).
    React.useEffect(() => { setPage(1); }, [search, filters, filteredStudents.length]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">{t('students_title')}</h1>
                            <p className="text-[13px] text-matn-sokin mt-1">
                                <span className="num">{quickCounts.faol}</span> faol
                                {quickCounts.qarzdor > 0 && <> · <span className="num">{quickCounts.qarzdor}</span> qarzdor</>}
                                {quickCounts.kelmayotgan > 0 && <> · <span className="num">{quickCounts.kelmayotgan}</span> tasi 2 haftadan beri kelmagan</>}
                            </p>
                        </div>
                    </div>
                    {/* Adding a student is the primary action here; export, import and the
                        QR link are occasional tools. They used to be four filled buttons in
                        four unrelated colours, all shouting equally — now only the primary
                        one is filled, and the rest read as the secondary actions they are. */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-2.5 bg-sirt border border-chiziq text-matn-2 hover:border-brand hover:text-brand rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            <FileSpreadsheet size={14} /> {t('export')}
                        </button>
                        <button
                            onClick={() => document.getElementById('import-excel-input')?.click()}
                            disabled={isImporting}
                            className="flex items-center gap-2 px-3 py-2.5 bg-sirt border border-chiziq text-matn-2 hover:border-brand hover:text-brand rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                            <FileSpreadsheet size={14} /> {t('import')}
                        </button>
                        <input type="file" id="import-excel-input" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportChange} />
                        {selectedSchoolId !== 0 && (
                            <button
                                onClick={() => setIsLinkModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-2.5 bg-sirt border border-chiziq text-matn-2 hover:border-brand hover:text-brand rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                <QrCode size={14} /> {t('create_link')}
                            </button>
                        )}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 ml-1 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-extrabold shadow-sm shadow-brand/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add')}
                        </button>
                    </div>
                </div>



            {/* Tez filtr chiplari. Pastdagi kengaytirilgan filtrlar joyida qoladi —
                bu qator eng ko'p ishlatiladigan to'rt kesimni bir bosishda beradi.
                Sanoqlar joriy filtrga bog'liq emas, aks holda bitta chip bosilgach
                qolganlari nolga tushib qolardi. */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {([
                    ['all', t('all'), quickCounts.all, false],
                    ['qarzdor', 'Qarzdor', quickCounts.qarzdor, true],
                    ['kelmayotgan', 'Kelmayotgan', quickCounts.kelmayotgan, false],
                    // "Faol" chipi jami bilan teng bo'lsa ko'rsatilmaydi — ikkita
                    // bir xil raqamli chip yonma-yon turishi chalkashtiradi.
                    ['faol', t('status_active'), quickCounts.faol === quickCounts.all ? 0 : quickCounts.faol, false],
                    ['arxiv', t('status_archive'), quickCounts.arxiv, false],
                ] as const).map(([key, label, count, warn]) => (
                    count > 0 || key === 'all' ? (
                        <button key={key} onClick={() => setQuickFilter(key as any)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-colors cursor-pointer shrink-0 ${quickFilter === key
                                ? (warn ? 'bg-rose-500 border-rose-500 text-white' : 'bg-brand border-brand text-white')
                                : warn
                                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 text-rose-500 hover:border-rose-300'
                                    : 'bg-sirt border-chiziq text-matn-sokin hover:text-brand hover:border-brand'}`}>
                            {label} <span className="num opacity-60">{count}</span>
                        </button>
                    ) : null
                ))}
            </div>
                <div className="px-6 pb-5 pt-3 border-t border-chiziq-mayin/50 space-y-3">
                    <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-matn-xira" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder_students')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn outline-none focus:border-brand transition-colors"
                        />
                    </div>
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${showFilters || activeFilterCount > 0
                                ? 'bg-brand border-brand text-white'
                                : 'bg-sirt border-chiziq text-matn-sokin hover:text-brand hover:border-brand'}`}
                        >
                            <SlidersHorizontal size={14} />
                            Filtrlar
                            {activeFilterCount > 0 && <span className="num opacity-80">{activeFilterCount}</span>}
                        </button>
                        {(activeFilterCount > 0 || search) && (
                            <button
                                onClick={() => { setSearch(''); setFilters(DEFAULT_FILTERS); }}
                                title={t('filter_clear')}
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] text-matn-xira hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                            >
                                <X size={14} /> {t('filter_clear')}
                            </button>
                        )}
                    </div>

                    {showFilters && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-3">
                        <div>
                            <label className={lbl}>{t('filter_status')}</label>
                            <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
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
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>{t('filter_balance')}</label>
                            <select value={filters.balanceStatus} onChange={e => setFilters({...filters, balanceStatus: e.target.value})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
                                <option value="all">{t('all')}</option>
                                <option value="debt">{t('debtors')}</option>
                                <option value="positive">{t('paid_students')}</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Muassasa turi</label>
                            <select value={filters.orgType} onChange={e => setFilters({...filters, orgType: e.target.value})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
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
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all"
                            />
                        </div>
                        <div>
                            <label className={lbl}>Viloyat</label>
                            <select value={filters.region} onChange={e => setFilters({...filters, region: e.target.value, district: ''})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {Object.keys(UZB_REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Tuman</label>
                            <select value={filters.district} onChange={e => setFilters({...filters, district: e.target.value})}
                                disabled={!filters.region}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer disabled:opacity-50">
                                <option value="">Barchasi</option>
                                {filters.region && UZB_REGIONS[filters.region]?.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`${lbl} text-rose-500`}>{t('filter_defects')}</label>
                            <select value={filters.missingInfo} onChange={e => setFilters({...filters, missingInfo: e.target.value})}
                                className="w-full px-3 py-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-xl text-[11px] font-bold text-rose-700 dark:text-rose-400 outline-none focus:border-rose-500 transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                <option value="fatherName">{t('defect_father_name').replace('{count}', String(students.filter(s => !s.fatherName || s.fatherName.trim() === '').length))}</option>
                                <option value="fatherPhone">{t('defect_father_phone').replace('{count}', String(students.filter(s => !s.fatherPhone || s.fatherPhone.trim() === '').length))}</option>
                                <option value="studentSchool">{t('defect_school').replace('{count}', String(students.filter(s => !s.studentSchool || s.studentSchool.trim() === '').length))}</option>
                                <option value="photo">{t('defect_photo').replace('{count}', String(students.filter(s => !s.photo || s.photo.trim() === '').length))}</option>
                                <option value="no_telegram">{t('defect_no_telegram').replace('{count}', String(students.filter(s => (!s.telegramId || s.telegramId.trim() === '') && (!s.fatherTelegramId || s.fatherTelegramId.trim() === '') && (!s.motherTelegramId || s.motherTelegramId.trim() === '')).length))}</option>
                                <option value="parent_no_telegram">{t('defect_parent_no_telegram').replace('{count}', String(students.filter(s => (!!s.fatherPhone && (!s.fatherTelegramId || s.fatherTelegramId.trim() === '')) || (!!s.motherPhone && (!s.motherTelegramId || s.motherTelegramId.trim() === ''))).length))}</option>
                            </select>
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* Table layout */}
            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">

                {/* Phone layout. The table below needs 900px, which is two and a half
                    screens of sideways scrolling on a 360px phone, so small screens get
                    cards carrying the same fields instead. */}
                <div className="md:hidden divide-y divide-chiziq-mayin">
                    {visibleStudents.map(student => {
                        const balance = student.balance || 0;
                        return (
                            <button key={student.id} onClick={() => navigate(`/students/${student.id}`)}
                                className="w-full flex items-center gap-3 p-4 text-left hover:hover:bg-ichki transition-colors cursor-pointer">
                                <div className="w-11 h-11 rounded-xl bg-ichki border border-chiziq flex items-center justify-center text-brand font-bold text-xs overflow-hidden shrink-0">
                                    {student.photo
                                        ? <img src={student.photo} alt={student.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                        : student.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-matn truncate">{student.name}</p>
                                    <p className="text-[12px] text-matn-xira tabular-nums mt-0.5">{student.phone || "telefon yo'q"}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`text-xs font-black tabular-nums ${balance < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                        {balance.toLocaleString()}
                                    </p>
                                    <p className="text-[11px] font-bold text-matn-xira mt-0.5">
                                        {balance < 0 ? 'qarz' : 'balans'}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                    {visibleStudents.length === 0 && (
                        <div className="py-14 px-6 text-center">
                            <p className="text-sm font-bold text-matn-2">
                                {students.length === 0 ? "Hali o'quvchi qo'shilmagan" : "Hech narsa topilmadi"}
                            </p>
                            <p className="text-xs text-matn-xira mt-1">
                                {students.length === 0
                                    ? "Yuqoridagi tugma orqali birinchi o'quvchini qo'shing."
                                    : `${students.length} ta o'quvchi ichidan mos keladigani yo'q.`}
                            </p>
                        </div>
                    )}
                </div>

                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="border-b border-chiziq">
                                <th className="px-4 py-2.5 text-[12px] font-normal text-matn-sokin w-[58px]">&#8470;</th>
                                <th className="px-4 py-2.5 text-[12px] font-normal text-matn-sokin">{t('student')}</th>
                                <th className="px-4 py-2.5 text-[12px] font-normal text-matn-sokin w-[172px]">{t('student_phone')}</th>
                                <th className="px-4 py-2.5 text-[12px] font-normal text-matn-sokin w-[180px]">{t('student_groups')}</th>
                                <th className="px-4 py-2.5 text-[12px] font-normal text-matn-sokin text-right w-[124px]">{t('student_balance')}</th>
                                <th className="px-4 py-2.5 text-[12px] font-normal text-matn-sokin text-right w-[82px]">Davomat</th>
                                <th className="px-2 py-2.5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-chiziq-mayin">
                            {visibleStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-ichki transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/students/${student.id}`)}>
                                    <td className="px-4 py-2.5 num text-[12px] text-matn-xira">{student.id}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="relative w-7 h-7 rounded-full bg-brand/12 flex items-center justify-center text-brand font-semibold text-[10px] overflow-hidden shrink-0">
                                                {initials(student.name)}
                                                {student.photo && (
                                                    <img src={student.photo} alt="" loading="lazy" decoding="async"
                                                        onError={e => { e.currentTarget.style.display = 'none'; }}
                                                        className="absolute inset-0 w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[13px] text-matn truncate group-hover:text-brand transition-colors">
                                                    {displayName(student.name)}
                                                    {/* Holat faqat "Faol" bo'lmaganda ko'rsatiladi: ilgari
                                                        har qatorda yashil "Faol" turardi va hech narsa
                                                        anglatmasdi. */}
                                                    {student.status !== 'Faol' && (
                                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] align-middle ${
                                                            student.status === 'Sinov' ? 'bg-ogoh-fon text-ogoh' :
                                                            student.status === 'Muzlatilgan' ? 'bg-brand/12 text-brand' :
                                                            student.status === 'Passiv' ? 'bg-xato-fon text-xato' :
                                                            'bg-ichki text-matn-sokin'
                                                        }`}>
                                                            {student.status === 'Arxiv' ? t('status_archive') :
                                                             student.status === 'Sinov' ? t('status_test') :
                                                             student.status === 'Muzlatilgan' ? t('status_frozen') :
                                                             student.status === 'Passiv' ? t('status_passive') :
                                                             student.status === 'Bitiruvchi' ? t('status_graduated') :
                                                             student.status === 'Sertifikatli' ? t('status_certified') :
                                                             student.status}
                                                        </span>
                                                    )}
                                                </p>
                                                {/* Qo'shilgan sana o'rniga maktab va sinf: ro'yxatda
                                                    o'quvchini aynan shu bilan farqlashadi. */}
                                                <span className="text-[11px] text-matn-xira block truncate">
                                                    {[student.studentSchool, student.orgType].filter(Boolean).join(' · ') || student.joinedDate}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="num text-[12px] text-matn-2">{phoneFmt(student.phone) || <span className="text-matn-xira">&#8212;</span>}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {/* Guruh nomi butun ustunni ko'k havolaga aylantirmasin —
                                            12 ta ko'k qator ko'zni charchatadi. */}
                                        <div className="flex flex-wrap gap-1">
                                            {getStudentGroups(student.groups || []).map(g => (
                                                <span key={g.id} className="px-2 py-0.5 border border-chiziq text-matn-2 rounded-md text-[11px] whitespace-nowrap">
                                                    {g.name}
                                                </span>
                                            ))}
                                            {(student.groups || []).length === 0 && <span className="text-[11px] text-matn-xira">{t('no_group')}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <span className={`num text-[13px] ${student.balance > 0 ? 'text-yaxshi' : student.balance < 0 ? 'text-xato' : 'text-matn-xira'}`}>
                                            {student.balance.toLocaleString('ru-RU')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        {attRate.has(student.id) ? (
                                            <span className={`num text-[13px] ${
                                                (attRate.get(student.id) as number) >= 85 ? 'text-yaxshi' :
                                                (attRate.get(student.id) as number) >= 70 ? 'text-ogoh' : 'text-xato'
                                            }`}>{attRate.get(student.id)}%</span>
                                        ) : (
                                            <span className="num text-[13px] text-matn-xira">&#8212;</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-2.5 text-center relative" onClick={(e) => e.stopPropagation()}>
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
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-matn-xira hover:bg-chiziq cursor-pointer">
                                            <MoreVertical size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {visibleStudents.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-16">
                                        <div className="flex flex-col items-center gap-3 text-center">
                                            <div className="w-14 h-14 rounded-2xl bg-ichki border border-chiziq flex items-center justify-center">
                                                <Search size={20} className="text-matn-xira" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-matn-2">
                                                    {students.length === 0 ? "Hali o'quvchi qo'shilmagan" : "Hech narsa topilmadi"}
                                                </p>
                                                <p className="text-xs text-matn-xira mt-1">
                                                    {students.length === 0
                                                        ? "Yuqoridagi tugma orqali birinchi o'quvchini qo'shing."
                                                        : `${students.length} ta o'quvchi ichidan qidiruv va filtrlarga mos keladigani yo'q.`}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredStudents.length > PER_PAGE && (
                    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-chiziq-mayin/50">
                        <p className="text-[12px] font-bold text-matn-xira tabular-nums">
                            {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filteredStudents.length)} / {filteredStudents.length} ta
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-extrabold bg-ichki text-matn-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-chiziq cursor-pointer transition-colors">
                                Oldingi
                            </button>
                            <span className="text-[12px] font-bold text-matn-sokin tabular-nums px-1">{currentPage} / {pageCount}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                                disabled={currentPage === pageCount}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-extrabold bg-ichki text-matn-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-chiziq cursor-pointer transition-colors">
                                Keyingi
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] overflow-y-auto">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

                    {/* Centering Wrapper */}
                    <div className="flex min-h-full items-center justify-center p-4">
                        {/* Modal Panel */}
                        <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8 transform transition-all">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                                <div className="text-left">
                                    <h3 className="text-lg font-black text-matn tracking-tight">{t('new_student_title')}</h3>
                                    <p className="text-[11px] font-bold text-brand mt-0.5">{t('student_details_subtitle')}</p>
                                </div>
                                <button aria-label="Yopish" type="button" onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
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
                                                className={`py-2.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${newStudent.gender === g ? 'bg-brand border-brand text-white shadow' : 'bg-ichki/30 border-chiziq text-matn-xira hover:text-gray-600'}`}>
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
                                    className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[11px] font-bold cursor-pointer transition-all ${newStudent.location ? 'bg-brand/10 text-brand border-brand' : 'bg-ichki border-gray-100 hover:bg-gray-100'}`}>
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
                                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all cursor-pointer ${
                                                        checked
                                                            ? 'bg-brand text-brand-ust border-brand shadow-lg shadow-[#1b6b6b]/30'
                                                            : 'bg-transparent text-matn-xira border-gray-300 dark:border-gray-600 hover:border-brand hover:text-brand'
                                                    }`}
                                                >
                                                    {checked ? '✓ ' : ''}{priv}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {newStudent.selectedPrivileges.includes('Sertifikat') && (
                                    <div className="space-y-3 p-3 bg-ichki rounded-2xl border border-chiziq">
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
                                        <div className="border-t border-dashed border-chiziq/50 pt-3 mt-3 space-y-3">
                                            <span className="block text-[11px] font-bold text-brand text-left">Qo'shimcha Sertifikatlar</span>
                                            {newStudent.certificates.map((cert, index) => (
                                                <div key={index} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-chiziq space-y-3 relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCertificate(index)}
                                                        className="absolute top-2 right-2 text-matn-xira hover:text-red-500 transition-colors"
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
                                                className="w-full py-2.5 bg-white dark:bg-slate-800 border border-dashed border-chiziq rounded-xl text-[11px] font-bold text-brand hover:bg-teal-50/10 dark:hover:bg-teal-900/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <Plus size={13} />
                                                Sertifikat qo'shish
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="border-t border-dashed border-chiziq/50 pt-4 mt-4 space-y-3">
                                    <span className="block text-[11px] font-bold text-brand text-left">Kursga qo'shish</span>
                                    {groups.length === 0 ? (
                                        <p className="text-[11px] text-matn-xira italic">Kurslar mavjud emas</p>
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
                                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all cursor-pointer ${
                                                            selected
                                                                ? 'bg-brand text-brand-ust border-brand shadow-lg shadow-[#1b6b6b]/30'
                                                                : 'bg-transparent text-matn-xira border-gray-300 dark:border-gray-600 hover:border-brand hover:text-brand'
                                                        }`}
                                                    >
                                                        {selected ? '✓ ' : '+ '}{g.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-dashed border-chiziq/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[11px] font-bold text-brand text-left">{t('parent_info')}</span>
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


                                <div className="border-t border-dashed border-chiziq/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[11px] font-bold text-brand text-left">{t('photo_label')}</span>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-2xl bg-ichki border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                            {newStudent.photo ? <img src={newStudent.photo} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-300" />}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                 <label className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-chiziq rounded-xl cursor-pointer hover:bg-gray-50 text-[11px] font-bold">
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
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-chiziq rounded-xl hover:bg-gray-55 text-[11px] font-bold cursor-pointer">
                                                    {t('photo_camera')}
                                                </button>
                                            </div>
                                            {newStudent.photo && (
                                                <button type="button" onClick={handleRemoveBg} disabled={isRemovingBg}
                                                    className="w-full py-2 bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400 rounded-xl border border-violet-100 dark:border-violet-900 text-[11px] font-bold disabled:opacity-50 cursor-pointer">
                                                    {t('clear_bg')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                        {t('cancel')}
                                    </button>
                                    <button type="submit" disabled={isAdding}
                                        className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer disabled:opacity-50">
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
                <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setStudentToDelete(null)} />
                    <div className="relative bg-sirt rounded-2xl p-4 shadow-2xl max-w-sm w-full text-center border border-chiziq">
                        <h4 className="text-sm font-black text-matn tracking-tight mb-2">{t('delete_confirm_title')}</h4>
                        <p className="text-[11px] font-bold text-matn-xira leading-relaxed mb-6">
                            {t('delete_confirm_desc').replace('{name}', studentToDelete.name)}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setStudentToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-[11px] font-extrabold rounded-xl cursor-pointer">
                                {t('cancel')}
                            </button>
                            <button onClick={confirmDeleteStudent} className="flex-1 py-2.5 bg-rose-600 text-white text-[11px] font-extrabold rounded-xl cursor-pointer">
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isLinkModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsLinkModalOpen(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq/50">
                            <h3 className="text-sm font-black text-matn tracking-tight">{t('reception_link')}</h3>
                            <button aria-label="Yopish" onClick={() => setIsLinkModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-gray-55 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-[11px] font-bold text-matn-xira leading-relaxed mb-2">
                            {t('reception_link_desc')}
                        </p>
                        <p className="text-[11px] font-bold text-amber-500 leading-relaxed mb-6 normal-case">
                            {t('reception_link_rotate')}
                        </p>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 dark:border-gray-200 w-fit mx-auto mb-6 shadow-sm">
                            {qrCodeDataUrl ? (
                                <img src={qrCodeDataUrl} alt="QR Code" className="w-[180px] h-[180px] block" />
                            ) : (
                                <div className="w-[180px] h-[180px] flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 bg-ichki p-3 rounded-2xl border border-gray-100 dark:border-gray-750">
                                <span className="text-[11px] font-bold text-brand shrink-0">{t('link')}:</span>
                                <input
                                    readOnly
                                    type="text"
                                    value={applyUrl || t('loading')}
                                    className="bg-transparent border-none text-[11px] font-extrabold text-gray-700 dark:text-white outline-none w-full select-all"
                                />
                            </div>
                            <button
                                onClick={copyLinkToClipboard}
                                className={`w-full py-3.5 rounded-2xl text-[11px] font-black transition-all cursor-pointer ${
                                    copySuccess
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/10'
                                        : 'bg-brand hover:bg-brand-dark text-white shadow-lg shadow-[#1b6b6b]/15'
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
                        className="bg-sirt border border-chiziq rounded-xl shadow-xl py-1 w-32 z-50 text-left animate-in slide-in-from-top-1 duration-150"
                    >
                        <button onClick={() => { setActiveMenu(null); navigate(`/students/${activeMenu.id}`); }}
                            className="w-full text-left px-4 py-2 text-[11px] font-bold text-matn-2 hover:bg-gray-55 dark:hover:bg-gray-700 cursor-pointer">
                            {t('details')}
                        </button>
                        <button onClick={() => { setActiveMenu(null); handleDeleteStudent(activeMenu.id, students.find(s => s.id === activeMenu.id)?.name || ''); }}
                            className="w-full text-left px-4 py-2 text-[11px] font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer">
                            {t('delete')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
