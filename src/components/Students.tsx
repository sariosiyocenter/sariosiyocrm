import React, { useState, useEffect } from 'react';
import { Search, Plus, FileSpreadsheet, MoreVertical, X, Filter, Camera, Sparkles, Image as ImageIcon, MapPin, SlidersHorizontal, GraduationCap, Link as LinkIcon, QrCode } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import PhotoCapture from './PhotoCapture';
import MapPicker from './MapPicker';
import { compressImage } from '../lib/image';
import * as XLSX from 'xlsx';

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function Students() {
    const { students, groups, teachers, transports, addStudent, deleteStudent, importStudents, selectedSchoolId } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ 
        name: '', phone: '', address: '', birthDate: '', location: '', photo: '', 
        fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
        transportId: '' as string | number,
        studentSchool: ''
    });
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    
    // Link creation states
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [generatedToken, setGeneratedToken] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        if (isLinkModalOpen && selectedSchoolId) {
            const fetchToken = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/public/schools/${selectedSchoolId}/tokens`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setGeneratedToken(data.token);

                        const QRCodeLib = await import('qrcode');
                        const QRCode = QRCodeLib.default || QRCodeLib;
                        const applyUrl = `${window.location.origin}/apply/${selectedSchoolId}?token=${data.token}`;
                        const qrUrl = await QRCode.toDataURL(applyUrl, { width: 200, margin: 2 });
                        setQrCodeDataUrl(qrUrl);
                    } else {
                        console.error('Failed to create registration token');
                    }
                } catch (err) {
                    console.error(err);
                }
            };
            fetchToken();
        } else {
            setGeneratedToken('');
            setQrCodeDataUrl('');
        }
    }, [isLinkModalOpen, selectedSchoolId]);

    const copyLinkToClipboard = () => {
        if (!generatedToken) return;
        const applyUrl = `${window.location.origin}/apply/${selectedSchoolId}?token=${generatedToken}`;
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
        balanceStatus: 'all', // all, debtor, positive
        dateRange: 'all', // all, today, week, month
        rating: '',
        location: '',
        missingInfo: ''
    });

    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
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
                groups: [],
                transportId: newStudent.transportId ? Number(newStudent.transportId) : null,
                studentSchool: newStudent.studentSchool
            });
            setIsModalOpen(false);
            setNewStudent({ 
                name: '', phone: '', address: '', birthDate: '', location: '', photo: '', 
                fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
                transportId: '',
                studentSchool: ''
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
                    "Tug'ilgan sana": student.birthDate || '',
                    "Maktab/Bog'cha": student.studentSchool || '',
                    "Yashash manzili": student.address || '',
                    "Holati": student.status || 'Faol',
                    "A'zo bo'lgan sana": student.joinedDate || '',
                    "Balans (UZS)": student.balance || 0,
                    "Guruhlar": groupNames || 'Guruhsiz',
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
                        const studentSchool = row["Maktab/Bog'cha"] || row["Maktab"] || row["Bog'cha"] || row["studentSchool"] || row["School"];
                        const address = row["Yashash manzili"] || row["address"] || row["Address"] || row["Manzil"];
                        const status = row["Holati"] || row["status"] || row["Status"] || "Faol";
                        const joinedDate = row["A'zo bo'lgan sana"] || row["joinedDate"] || row["Joined Date"] || new Date().toISOString().split('T')[0];
                        const balance = row["Balans (UZS)"] || row["balance"] || row["Balance"] || 0;
                        const fatherName = row["Otasining ismi"] || row["fatherName"] || row["Father Name"];
                        const fatherPhone = row["Otasining telefoni"] || row["fatherPhone"] || row["Father Phone"];
                        const motherName = row["Onasining ismi"] || row["motherName"] || row["Mother Name"];
                        const motherPhone = row["Onasining telefoni"] || row["motherPhone"] || row["Mother Phone"];

                        return {
                            name,
                            phone,
                            birthDate: birthDate ? String(birthDate) : '',
                            studentSchool: studentSchool ? String(studentSchool) : '',
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
               (s.phone || '').toLowerCase().includes(lowerSearch);
        
        const matchesStatus = !filters.status || s.status === filters.status;
        const matchesGroup = !filters.groupId || (s.groups || []).includes(Number(filters.groupId));
        const matchesRating = !filters.rating || s.rating === Number(filters.rating);
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
        }

        return matchesSearch && matchesStatus && matchesGroup && matchesBalance && matchesDate && matchesRating && matchesLocation && matchesMissingInfo;
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
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">O'quvchilar</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                Jami {students.length} ta o'quvchi • Topildi: {filteredStudents.length} ta
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text" placeholder="Ism yoki telefon..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all w-52"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-[#1b6b6b] hover:text-[#1b6b6b]'}`}
                        >
                            <SlidersHorizontal size={15} />
                        </button>
                        <button 
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer"
                        >
                            <FileSpreadsheet size={14} /> Eksport
                        </button>
                        <button 
                            onClick={() => document.getElementById('import-excel-input')?.click()}
                            disabled={isImporting}
                            className="flex items-center gap-2 px-3 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                        >
                            <FileSpreadsheet size={14} /> Import
                        </button>
                        <input type="file" id="import-excel-input" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportChange} />
                        {selectedSchoolId !== 0 && (
                            <button
                                onClick={() => setIsLinkModalOpen(true)}
                                className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                            >
                                <QrCode size={14} /> Link Yaratish
                            </button>
                        )}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> Qo'shish
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="px-6 pb-5 pt-4 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
                        <div>
                            <label className={lbl}>Holati</label>
                            <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                <option value="Faol">Faol</option>
                                <option value="Arxiv">Arxiv</option>
                                <option value="Sinov">Sinov</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Guruh</label>
                            <select value={filters.groupId} onChange={e => setFilters({...filters, groupId: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Balans</label>
                            <select value={filters.balanceStatus} onChange={e => setFilters({...filters, balanceStatus: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                <option value="debt">Qarzdorlar</option>
                                <option value="positive">To'laganlar</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Reyting</label>
                            <select value={filters.rating} onChange={e => setFilters({...filters, rating: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} yulduz</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Manzil</label>
                            <select value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {Array.from(new Set(students.map(s => s.location).filter(Boolean))).map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={`${lbl} text-rose-500`}>⚠️ Kamchiliklar</label>
                            <select value={filters.missingInfo} onChange={e => setFilters({...filters, missingInfo: e.target.value})}
                                className="w-full px-3 py-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-xl text-[10px] font-bold text-rose-700 dark:text-rose-400 outline-none focus:border-rose-500 transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                <option value="fatherName">Otasining ismi ({students.filter(s => !s.fatherName || s.fatherName.trim() === '').length} ta)</option>
                                <option value="fatherPhone">Otasining telefoni ({students.filter(s => !s.fatherPhone || s.fatherPhone.trim() === '').length} ta)</option>
                                <option value="studentSchool">Maktabi ({students.filter(s => !s.studentSchool || s.studentSchool.trim() === '').length} ta)</option>
                                <option value="photo">Rasmi ({students.filter(s => !s.photo || s.photo.trim() === '').length} ta)</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => setFilters({status: '', groupId: '', balanceStatus: 'all', dateRange: 'all', rating: '', location: '', missingInfo: ''})}
                                className="w-full py-2 text-[10px] font-extrabold uppercase text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer">
                                <X size={12} /> Tozalash
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Table layout */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">ID</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">O'quvchi</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Telefon</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Guruhlar</th>
                                <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Balans</th>
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
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[#1b6b6b] font-bold text-xs shadow-inner overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                                                {student.photo ? (
                                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                                ) : student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors">{student.name}</p>
                                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wider">A'zo: {student.joinedDate}</span>
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
                                            {(student.groups || []).length === 0 && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Guruhsiz</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${student.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-gray-900/50'}`}>
                                                {student.status}
                                            </span>
                                            <span className={`text-xs font-extrabold tabular-nums ${student.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {student.balance.toLocaleString()} UZS
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => setActiveMenuId(activeMenuId === student.id ? null : student.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                            <MoreVertical size={16} />
                                        </button>
                                        {activeMenuId === student.id && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                                                <div className="absolute right-4 top-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl py-1 w-32 z-20 text-left">
                                                    <button onClick={() => { setActiveMenuId(null); navigate(`/students/${student.id}`); }}
                                                        className="w-full text-left px-4 py-2 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 uppercase tracking-widest cursor-pointer">
                                                        Batafsil
                                                    </button>
                                                    <button onClick={() => { setActiveMenuId(null); handleDeleteStudent(student.id, student.name); }}
                                                        className="w-full text-left px-4 py-2 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 uppercase tracking-widest cursor-pointer">
                                                        O'chirish
                                                    </button>
                                                </div>
                                            </>
                                        )}
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
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi O'quvchi</h3>
                                    <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">O'quvchi ma'lumotlari</p>
                                </div>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleAddStudent} className="space-y-4 text-left">
                                <div>
                                    <label className={lbl}>To'liq Ism *</label>
                                    <input required type="text" placeholder="Jasur Alimov" className={inp} value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl}>Telefon *</label>
                                        <input required type="tel" placeholder="+998" className={inp} value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Tug'ilgan Sana</label>
                                        <input type="date" className={inp} value={newStudent.birthDate} onChange={e => setNewStudent({ ...newStudent, birthDate: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className={lbl}>Maktab / Bog'cha</label>
                                    <input type="text" placeholder="42-maktab" className={inp} value={newStudent.studentSchool} onChange={e => setNewStudent({ ...newStudent, studentSchool: e.target.value })} />
                                </div>

                                <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">Ota-ona ma'lumotlari</span>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={lbl}>Otasining ismi</label>
                                            <input type="text" placeholder="FISH" className={inp} value={newStudent.fatherName} onChange={e => setNewStudent({ ...newStudent, fatherName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={lbl}>Otasining telefoni</label>
                                            <input type="tel" placeholder="+998" className={inp} value={newStudent.fatherPhone} onChange={e => setNewStudent({ ...newStudent, fatherPhone: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={lbl}>Onasining ismi</label>
                                            <input type="text" placeholder="FISH" className={inp} value={newStudent.motherName} onChange={e => setNewStudent({ ...newStudent, motherName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={lbl}>Onasining telefoni</label>
                                            <input type="tel" placeholder="+998" className={inp} value={newStudent.motherPhone} onChange={e => setNewStudent({ ...newStudent, motherPhone: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">Logistika & Manzil</span>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={lbl}>Transport</label>
                                            <select className={inp} value={newStudent.transportId} onChange={e => setNewStudent({...newStudent, transportId: e.target.value})}>
                                                <option value="">Kerak emas</option>
                                                {transports.map(t => <option key={t.id} value={t.id}>{t.name} ({t.number})</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={lbl}>Manzil</label>
                                            <input type="text" placeholder="Sariosiyo" className={inp} value={newStudent.address} onChange={e => setNewStudent({ ...newStudent, address: e.target.value })} />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setIsMapOpen(true)}
                                        className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${newStudent.location ? 'bg-[#1b6b6b]/10 text-[#1b6b6b] border-[#1b6b6b]' : 'bg-gray-55 dark:bg-gray-900 border-gray-100 hover:bg-gray-100'}`}>
                                        <MapPin size={14} /> {newStudent.location ? 'Kartada belgilandi' : 'Kartadan tanlash'}
                                    </button>
                                </div>

                                <div className="border-t border-dashed border-gray-150 dark:border-gray-700/50 pt-4 mt-4 space-y-4">
                                    <span className="block text-[9px] font-black uppercase text-[#1b6b6b] tracking-wider text-left">Rasm</span>
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
                                                    Fayldan
                                                </label>
                                                <button type="button" onClick={() => setIsPhotoModalOpen(true)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-55 text-[10px] font-bold uppercase tracking-wider cursor-pointer">
                                                    Kamera
                                                </button>
                                            </div>
                                            {newStudent.photo && (
                                                <button type="button" onClick={handleRemoveBg} disabled={isRemovingBg}
                                                    className="w-full py-2 bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400 rounded-xl border border-violet-100 dark:border-violet-900 text-[9px] font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer">
                                                    Fonni tozalash (AI)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                        Bekor
                                    </button>
                                    <button type="submit" disabled={isAdding}
                                        className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer disabled:opacity-50">
                                        {isAdding ? "Saqlanmoqda..." : "Saqlash"}
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
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">O'chirishni tasdiqlang</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-6">
                            {studentToDelete.name}ni o'chirmoqchimisiz?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setStudentToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer">
                                Bekor
                            </button>
                            <button onClick={confirmDeleteStudent} className="flex-1 py-2.5 bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer">
                                O'chirish
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
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Qabul Havolasi</h3>
                            <button onClick={() => setIsLinkModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-6">
                            Yangi kelgan o'quvchilar ushbu QR-kodni skanerlab yoki quyidagi havola orqali o'z arizalarini mustaqil to'ldirishlari mumkin.
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
                                <span className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-wider shrink-0">Havola:</span>
                                <input 
                                    readOnly 
                                    type="text" 
                                    value={generatedToken ? `${window.location.origin}/apply/${selectedSchoolId}?token=${generatedToken}` : "Yuklanmoqda..."} 
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
                                {copySuccess ? "Nusxalandi!" : "Havolani nusxalash"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
