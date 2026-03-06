/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Teachers from './components/Teachers';
import TeacherDetails from './components/TeacherDetails';
import Groups from './components/Groups';
import GroupDetails from './components/GroupDetails';
import Students from './components/Students';
import Leads from './components/Leads';
import Finance from './components/Finance';
import Settings from './components/Settings';
import Reports from './components/Reports';
import StudentDetails from './components/StudentDetails';

export default function App() {
  const [currentPage, setCurrentPage] = useState('Bosh sahifa');
  const [currentViewId, setCurrentViewId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('is_logged_in') === 'true');

  const navigate = (page: string, id: number | null = null) => {
    setCurrentPage(page);
    setCurrentViewId(id);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggedIn(true);
    localStorage.setItem('is_logged_in', 'true');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('is_logged_in');
  };

  const renderPage = () => {
    if (currentPage === "Lidlar") {
      return <Leads />;
    }
    if (currentPage === "O'qituvchilar") {
      if (currentViewId) return <TeacherDetails id={currentViewId} onBack={() => navigate("O'qituvchilar")} />;
      return <Teachers onNavigate={navigate} />;
    }
    if (currentPage === "Guruhlar") {
      if (currentViewId) return <GroupDetails id={currentViewId} onBack={() => navigate("Guruhlar")} />;
      return <Groups onNavigate={navigate} />;
    }
    if (currentPage === "O'quvchilar") {
      return <Students onNavigate={navigate} />;
    }
    if (currentPage === "O'quvchi profili" && currentViewId) {
      return <StudentDetails id={currentViewId} onBack={() => navigate("O'quvchilar")} />;
    }
    if (currentPage === "Sozlamalar") {
      return <Settings />;
    }
    if (currentPage === "Moliya") {
      return <Finance />;
    }
    if (currentPage === "Hisobotlar") {
      return <Reports />;
    }
    return <Dashboard />;
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl border border-slate-100">
          <div className="flex flex-col items-center gap-6 mb-10">
            <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white font-bold overflow-hidden shadow-xl">
              <img src="https://api.dicebear.com/7.x/shapes/svg?seed=SARIOSIYO&backgroundColor=000000" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">SARIOSIYO CRM</h1>
              <p className="text-slate-500 font-medium text-sm">Tizimga xush kelibsiz!</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Login</label>
              <input
                type="text"
                defaultValue="admin"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5C67F2] focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Parol</label>
              <input
                type="password"
                defaultValue="admin123"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5C67F2] focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-[#5C67F2] text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all mt-4 uppercase tracking-widest text-sm"
            >
              KIRISH
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout currentPage={currentPage} onNavigate={(page) => navigate(page, null)} onLogout={handleLogout}>
      {renderPage()}
    </Layout>
  );
}
