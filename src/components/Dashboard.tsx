import React from 'react';
import { Eye, UserCheck, Layers, AlertTriangle, GraduationCap, Users, Calendar, Clock, Presentation, FileEdit } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export default function Dashboard() {
  const { students, teachers, groups, leads } = useCRM();

  const activeLeads = leads.filter(l => l.status !== "To'lov qildi").length;
  const activeGroups = groups.length;
  const debtors = students.filter(s => s.balance < 0);
  const totalDebt = Math.abs(debtors.reduce((acc, s) => acc + s.balance, 0));
  const activeStudents = students.filter(s => s.status === 'Faol').length;
  const totalInGroups = groups.reduce((acc, g) => acc + g.studentIds.length, 0);
  const activeTeachers = teachers.filter(t => t.status === 'Faol').length;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <StatCard icon={<UserCheck className="w-6 h-6 text-emerald-500" />} label="Faol Lidlar" value={activeLeads.toString()} />
        <StatCard icon={<Layers className="w-6 h-6 text-orange-400" />} label="Guruhlar" value={activeGroups.toString()} />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-red-400" />} label="Jami qarz" value={totalDebt.toLocaleString() + " s."} />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-red-400" />} label="Qarzdorlar" value={debtors.length.toString()} />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-orange-400" />} label="To'lovi yaqinlar" value="0" />
        <StatCard icon={<GraduationCap className="w-6 h-6 text-cyan-400" />} label="Faol talabalar" value={activeStudents.toString()} />
        <StatCard icon={<Users className="w-6 h-6 text-blue-400" />} label="Jami guruhdagilar" value={totalInGroups.toString()} />
        <StatCard icon={<Calendar className="w-6 h-6 text-indigo-400" />} label="Sinov darsida" value="0" />
        <StatCard icon={<Clock className="w-6 h-6 text-red-500" />} label="Kelib ketganlar" value="0" />
        <StatCard icon={<Presentation className="w-6 h-6 text-emerald-500" />} label="O'qituvchilar" value={activeTeachers.toString()} />
        <StatCard icon={<FileEdit className="w-6 h-6 text-orange-400" />} label="Imtihonlar" value="0" />
      </div>

      {/* Profitability Badge */}
      <div className="flex justify-end pt-8">
        <div className="bg-[#FF4D4F] text-white px-5 py-2.5 rounded-lg font-bold text-sm tracking-wider shadow-sm">
          MARKAZ FOYDALILIGI {totalDebt > 0 ? "85%" : "100%"}
        </div>
      </div>

      {/* Schedule Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-6">
          <div className="flex gap-8">
            <button className="py-5 text-[13px] font-semibold text-slate-400 hover:text-slate-700 uppercase tracking-wider transition-colors">JUFT KUNLAR</button>
            <button className="py-5 text-[13px] font-semibold text-slate-400 hover:text-slate-700 uppercase tracking-wider transition-colors">TOQ KUNLAR</button>
            <button className="py-5 text-[13px] font-semibold text-[#5C67F2] border-b-2 border-[#5C67F2] uppercase tracking-wider">BOSHQA</button>
          </div>
          <div className="flex items-center gap-2 py-3 sm:py-0">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-slate-400">Vaqt oralig'i</label>
              <select className="appearance-none bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer">
                <option>15 Daqiqa</option>
                <option>30 Daqiqa</option>
                <option>1 Soat</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                <th className="p-4 border-b border-r border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50 w-40 sticky left-0 z-10">Xonalar / Soat</th>
                {['08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00'].map(time => (
                  <th key={time} className="p-3 border-b border-r border-slate-200 text-xs font-medium text-slate-500 text-center min-w-[60px]">{time}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 border-b border-r border-slate-200 text-sm font-medium text-slate-600 bg-white sticky left-0 z-10">1-xona</td>
                {Array.from({ length: 25 }).map((_, i) => (
                  <td key={i} className="p-2 border-b border-r border-slate-100 h-[72px]"></td>
                ))}
              </tr>
              <tr>
                <td className="p-4 border-b border-r border-slate-200 text-sm font-medium text-slate-600 bg-white sticky left-0 z-10">2-xona</td>
                {Array.from({ length: 25 }).map((_, i) => (
                  <td key={i} className="p-2 border-b border-r border-slate-100 h-[72px]"></td>
                ))}
              </tr>
              <tr>
                <td className="p-4 border-b border-r border-slate-200 text-sm font-medium text-slate-600 bg-white sticky left-0 z-10">3-xona</td>
                {Array.from({ length: 25 }).map((_, i) => (
                  <td key={i} className="p-2 border-b border-r border-slate-100 h-[72px]"></td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
      <div className="p-3 bg-slate-50/80 rounded-2xl">
        {icon}
      </div>
      <div className="text-center w-full">
        <p className="text-[13px] font-medium text-slate-400 mb-1 truncate w-full px-2">{label}</p>
        <p className="text-lg font-bold text-slate-700">{value}</p>
      </div>
    </div>
  );
}
